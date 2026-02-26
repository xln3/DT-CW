import { chromium } from 'playwright-core';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHROMIUM_PATH = path.join(os.homedir(), '.cache/ms-playwright/chromium-1208/chrome-linux64/chrome');
const BASE = 'http://localhost:3001';
const DIR = __dirname;

const browser = await chromium.launch({ headless: true, executablePath: CHROMIUM_PATH });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

let errors = [];
page.on('pageerror', err => errors.push({ url: page.url(), msg: err.message }));

// 1. Public home page
console.log('1. Public home...');
await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 15000 });
await page.screenshot({ path: path.join(DIR, '01-public-home.png'), fullPage: true });

// 2. Public attendance
console.log('2. Public attendance...');
await page.goto(BASE + '/attendance', { waitUntil: 'networkidle', timeout: 15000 });
await page.screenshot({ path: path.join(DIR, '02-public-attendance.png'), fullPage: true });

// 3. Login page
console.log('3. Login page...');
await page.goto(BASE + '/login', { waitUntil: 'networkidle', timeout: 15000 });
await page.screenshot({ path: path.join(DIR, '03-login.png'), fullPage: true });

// 4. Login as admin
console.log('4. Logging in...');
await page.locator('input[type="text"]').first().fill('admin');
await page.locator('input[type="password"]').first().fill('admin123');
await page.locator('button[type="submit"]').click();
await page.waitForURL('**/admin**', { timeout: 10000 });
await new Promise(r => setTimeout(r, 2000));
await page.screenshot({ path: path.join(DIR, '04-admin-dashboard.png'), fullPage: true });

// Admin pages
const adminPages = [
  ['/admin/members', '05-admin-members'],
  ['/admin/teachers', '06-admin-teachers'],
  ['/admin/programs', '07-admin-programs'],
  ['/admin/rehearsals', '08-admin-rehearsals'],
  ['/admin/calendar', '09-admin-calendar'],
  ['/admin/venues', '10-admin-venues'],
  ['/admin/budget', '11-admin-budget'],
  ['/admin/settings', '12-admin-settings'],
  ['/admin/settings/semesters', '13-admin-semesters'],
  ['/admin/settings/users', '14-admin-users'],
  ['/admin/settings/profile', '15-admin-profile'],
];

for (const [url, name] of adminPages) {
  console.log('  ' + name + '...');
  await page.goto(BASE + url, { waitUntil: 'networkidle', timeout: 15000 });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(DIR, name + '.png'), fullPage: true });
}

console.log('\n=== Results ===');
console.log('Screenshots: ' + (4 + adminPages.length));
if (errors.length > 0) {
  console.log('JS ERRORS (' + errors.length + '):');
  errors.forEach(e => console.log('  [' + e.url + '] ' + e.msg));
} else {
  console.log('No JS errors.');
}

await browser.close();
