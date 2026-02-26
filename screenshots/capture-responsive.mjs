import { chromium } from 'playwright-core';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHROMIUM_PATH = path.join(os.homedir(), '.cache/ms-playwright/chromium-1208/chrome-linux64/chrome');
const BASE = 'http://localhost:3001';
const DIR = path.join(__dirname, 'responsive');

const VIEWPORTS = [
  { name: '320x568-iPhoneSE', width: 320, height: 568 },
  { name: '375x812-iPhone13', width: 375, height: 812 },
  { name: '768x1024-iPadPortrait', width: 768, height: 1024 },
  { name: '1024x768-iPadLandscape', width: 1024, height: 768 },
  { name: '1280x800-Laptop', width: 1280, height: 800 },
  { name: '1920x1080-FullHD', width: 1920, height: 1080 },
  { name: '3840x2160-4K', width: 3840, height: 2160 },
];

const PUBLIC_PAGES = [
  { url: '/', name: '01-public-home' },
  { url: '/attendance', name: '02-public-attendance' },
  { url: '/attendance/search', name: '03-public-search' },
  { url: '/login', name: '04-login' },
];

const ADMIN_PAGES = [
  { url: '/admin', name: '05-admin-dashboard' },
  { url: '/admin/members', name: '06-admin-members' },
  { url: '/admin/teachers', name: '07-admin-teachers' },
  { url: '/admin/programs', name: '08-admin-programs' },
  { url: '/admin/rehearsals', name: '09-admin-rehearsals' },
  { url: '/admin/settings', name: '10-admin-settings' },
];

const browser = await chromium.launch({ headless: true, executablePath: CHROMIUM_PATH });
let errors = [];
let total = 0;

// Step 1: Login at 1280 viewport to get auth tokens from localStorage
console.log('Logging in to get auth tokens...');
const authCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const authPage = await authCtx.newPage();
await authPage.goto(BASE + '/login', { waitUntil: 'networkidle', timeout: 15000 });
await authPage.locator('input[type="text"]').first().fill('admin');
await authPage.locator('input[type="password"]').first().fill('admin123');
await authPage.locator('button[type="submit"]').click();
await authPage.waitForURL('**/admin**', { timeout: 15000 });
await new Promise(r => setTimeout(r, 2000));

// Extract localStorage auth data
const storageState = await authPage.evaluate(() => {
  const data = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    data[key] = localStorage.getItem(key);
  }
  return data;
});
console.log('Auth tokens captured. Keys:', Object.keys(storageState).join(', '));
await authCtx.close();

// Step 2: For each viewport, capture all pages
for (const vp of VIEWPORTS) {
  console.log(`\n=== Viewport: ${vp.name} (${vp.width}x${vp.height}) ===`);

  // Public pages (no auth needed)
  const pubCtx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.width >= 3840 ? 1 : (vp.width <= 375 ? 2 : 1),
  });
  const pubPage = await pubCtx.newPage();
  pubPage.on('pageerror', err => errors.push({ viewport: vp.name, url: pubPage.url(), msg: err.message }));

  for (const pg of PUBLIC_PAGES) {
    const filename = `${pg.name}_${vp.name}.png`;
    console.log(`  ${pg.name}...`);
    await pubPage.goto(BASE + pg.url, { waitUntil: 'networkidle', timeout: 15000 });
    await new Promise(r => setTimeout(r, 800));
    await pubPage.screenshot({ path: path.join(DIR, filename), fullPage: true });
    total++;
  }
  await pubCtx.close();

  // Admin pages (inject auth tokens)
  const adminCtx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.width >= 3840 ? 1 : (vp.width <= 375 ? 2 : 1),
  });
  const adminPage = await adminCtx.newPage();
  adminPage.on('pageerror', err => errors.push({ viewport: vp.name, url: adminPage.url(), msg: err.message }));

  // Inject auth tokens into localStorage before navigating
  await adminPage.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await adminPage.evaluate((tokens) => {
    for (const [key, value] of Object.entries(tokens)) {
      localStorage.setItem(key, value);
    }
  }, storageState);

  for (const pg of ADMIN_PAGES) {
    const filename = `${pg.name}_${vp.name}.png`;
    console.log(`  ${pg.name}...`);
    await adminPage.goto(BASE + pg.url, { waitUntil: 'networkidle', timeout: 15000 });
    await new Promise(r => setTimeout(r, 1000));
    await adminPage.screenshot({ path: path.join(DIR, filename), fullPage: true });
    total++;
  }
  await adminCtx.close();
}

console.log(`\n=== Results ===`);
console.log(`Total screenshots: ${total}`);
if (errors.length > 0) {
  console.log(`JS ERRORS (${errors.length}):`);
  errors.forEach(e => console.log(`  [${e.viewport}] [${e.url}] ${e.msg}`));
} else {
  console.log('No JS errors.');
}

await browser.close();
