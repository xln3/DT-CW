/** Retry only the failed users from the previous run with longer timeouts. */
import { chromium } from 'playwright-core';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHROMIUM_PATH = path.join(os.homedir(),
  '.cache/ms-playwright/chromium-1208/chrome-linux64/chrome');
const BASE = 'https://thudance.top';
const DIR = path.join(__dirname, 'e2e-all-students');

const report = JSON.parse(fs.readFileSync(path.join(DIR, 'report.json'), 'utf8'));
const retryUsers = report.results.filter(r => r.status === 'FAIL');
console.log(`Retrying ${retryUsers.length} failed users…`);

const browser = await chromium.launch({ headless: true, executablePath: CHROMIUM_PATH });
const newResults = [];

for (const u of retryUsers) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    try {
      await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.locator('input[type="text"]').first().fill(u.username);
      await page.locator('input[type="password"]').first().fill(u.password);
      const navPromise = page.waitForURL(url => !url.toString().endsWith('/login'),
        { timeout: 20000 }).catch(() => null);
      await page.locator('button[type="submit"]').click();
      await navPromise;
      const finalUrl = page.url();
      if (finalUrl.includes('/member')) {
        await page.waitForSelector('[data-testid="my-attendance-loaded"]', { timeout: 15000 }).catch(() => null);
      } else if (finalUrl.includes('/admin')) {
        await page.waitForSelector('h1, h2', { timeout: 15000 }).catch(() => null);
      }
      await page.waitForFunction(
        () => document.querySelectorAll('.animate-spin').length === 0,
        { timeout: 10000 },
      ).catch(() => null);
      await new Promise(r => setTimeout(r, 400));
      const ok = !finalUrl.endsWith('/login') && (finalUrl.includes('/admin') || finalUrl.includes('/member'));
      const safeName = `${String(u.id).padStart(3, '0')}-${u.username.replace(/[\/\\:*?"<>|]/g, '_')}`;
      await page.screenshot({ path: path.join(DIR, `${safeName}.png`), fullPage: false });
      if (ok) {
        console.log(`  ✓ ${u.username} (attempt ${attempt}) → ${finalUrl}`);
        newResults.push({ ...u, status: 'PASS', reason: finalUrl, attempt });
        await ctx.close();
        break;
      } else {
        let errText = '';
        try { errText = (await page.locator('.text-red-700').first().textContent({ timeout: 1000 })) || ''; } catch {}
        console.log(`  ✗ ${u.username} attempt ${attempt}: at ${finalUrl}: ${errText.trim()}`);
        if (attempt === 3) newResults.push({ ...u, status: 'FAIL', reason: `at ${finalUrl}: ${errText.trim()}`, attempt });
      }
    } catch (e) {
      console.log(`  ✗ ${u.username} attempt ${attempt} threw: ${e.message.slice(0, 100)}`);
      if (attempt === 3) newResults.push({ ...u, status: 'FAIL', reason: e.message.slice(0, 200), attempt });
    } finally {
      await ctx.close();
    }
  }
}

await browser.close();
const passed = newResults.filter(r => r.status === 'PASS').length;
console.log(`\nRetry result: ${passed}/${retryUsers.length} now PASS`);
fs.writeFileSync(path.join(DIR, 'retry-report.json'), JSON.stringify(newResults, null, 2));
process.exit(newResults.filter(r => r.status === 'FAIL').length > 0 ? 1 : 0);
