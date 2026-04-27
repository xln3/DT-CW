/**
 * Full-roster login audit.
 *
 * For every non-admin user with a student_id, attempt to log in via the live
 * site using "last 6 of student_id" as the password. Capture a screenshot of
 * the post-login page for each user. Print a PASS/FAIL summary.
 *
 * Concurrency: N independent browser contexts share one chromium process.
 *
 * Reads fixtures from screenshots/e2e-all-students/fixtures.csv produced by
 * the SQL query in the parent step. Format per line:
 *   id|username|role|student_id
 */
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
const FIXTURES = path.join(DIR, 'fixtures.csv');
const CONCURRENCY = 8;

if (!fs.existsSync(FIXTURES)) {
  console.error(`fixtures not found: ${FIXTURES}`);
  process.exit(1);
}

const users = fs.readFileSync(FIXTURES, 'utf8')
  .split('\n')
  .filter(Boolean)
  .map(line => {
    const [id, username, role, sid] = line.split('|');
    return {
      id: Number(id),
      username,
      role,
      student_id: sid,
      password: sid.slice(-6),
    };
  });

console.log(`Loaded ${users.length} users from fixtures.`);

// Sanitize username for filenames: keep CJK, replace path-separators.
function safeName(u) {
  return `${String(u.id).padStart(3, '0')}-${u.username.replace(/[\/\\:*?"<>|]/g, '_')}`;
}

const browser = await chromium.launch({
  headless: true,
  executablePath: CHROMIUM_PATH,
});

const results = []; // {id, username, status, reason, durationMs}
let completed = 0;

async function tryLogin(user) {
  const t0 = Date.now();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  let pageErrors = [];
  page.on('pageerror', e => pageErrors.push(e.message));

  try {
    await page.goto(BASE + '/login', { waitUntil: 'networkidle', timeout: 25000 });
    await page.locator('input[type="text"]').first().fill(user.username);
    await page.locator('input[type="password"]').first().fill(user.password);

    const navPromise = page.waitForURL(
      url => !url.toString().endsWith('/login'),
      { timeout: 12000 },
    ).catch(() => null);
    await page.locator('button[type="submit"]').click();
    await navPromise;
    const finalUrl = page.url();

    // Wait for actual page content, not just network idle. Different roles
    // land on different routes — match the data-testid we placed on each
    // top-level page wrapper. Falls through after timeout (still screenshots).
    if (finalUrl.includes('/member')) {
      await page.waitForSelector('[data-testid="my-attendance-loaded"]', {
        timeout: 15000,
      }).catch(() => null);
    } else if (finalUrl.includes('/admin')) {
      // Admin dashboard: wait for any heading to render
      await page.waitForSelector('h1, h2', { timeout: 15000 }).catch(() => null);
    }
    // After the page wrapper renders, the inner attendance fetch may still
    // be in flight. Wait for any remaining spinner to leave.
    await page.waitForFunction(
      () => document.querySelectorAll('.animate-spin').length === 0,
      { timeout: 10000 },
    ).catch(() => null);
    await new Promise(r => setTimeout(r, 400));

    const isLoggedIn = !finalUrl.endsWith('/login') &&
      (finalUrl.includes('/admin') || finalUrl.includes('/member'));

    await page.screenshot({
      path: path.join(DIR, `${safeName(user)}.png`),
      fullPage: false,
    });

    completed++;
    const ms = Date.now() - t0;
    if (isLoggedIn) {
      console.log(`  [${completed}/${users.length}] ✓ ${user.username} (${user.password}) → ${finalUrl}  ${ms}ms`);
      results.push({ ...user, status: 'PASS', reason: finalUrl, durationMs: ms });
    } else {
      // Try to extract the inline error message
      let errText = '';
      try {
        errText = (await page.locator('.text-red-700, [role="alert"]').first().textContent({ timeout: 1000 })) || '';
      } catch {}
      console.log(`  [${completed}/${users.length}] ✗ ${user.username} (${user.password}) at ${finalUrl}: ${errText.trim()}`);
      results.push({ ...user, status: 'FAIL', reason: `at ${finalUrl}: ${errText.trim()}`, durationMs: ms });
    }
  } catch (e) {
    completed++;
    console.log(`  [${completed}/${users.length}] ✗ ${user.username} threw: ${e.message.slice(0, 120)}`);
    results.push({ ...user, status: 'FAIL', reason: e.message.slice(0, 200), durationMs: Date.now() - t0 });
  } finally {
    await ctx.close();
  }
}

async function worker(queue, workerId) {
  while (queue.length > 0) {
    const u = queue.shift();
    if (!u) return;
    await tryLogin(u);
  }
}

const queue = [...users];
const t0 = Date.now();
await Promise.all(
  Array.from({ length: CONCURRENCY }, (_, i) => worker(queue, i)),
);
const totalMs = Date.now() - t0;

await browser.close();

// Summary
const passed = results.filter(r => r.status === 'PASS').length;
const failed = results.filter(r => r.status === 'FAIL').length;
console.log('');
console.log(`=== Summary ===`);
console.log(`PASS: ${passed}/${users.length}`);
console.log(`FAIL: ${failed}`);
console.log(`Total: ${(totalMs / 1000).toFixed(1)}s, avg ${(totalMs / users.length).toFixed(0)}ms/user`);

if (failed) {
  console.log('\nFailures:');
  results.filter(r => r.status === 'FAIL').forEach(r =>
    console.log(`  ${r.username} (sid=${r.student_id}, pwd=${r.password}): ${r.reason}`));
}

// Persist a JSON report alongside screenshots
fs.writeFileSync(
  path.join(DIR, 'report.json'),
  JSON.stringify({ totalMs, passed, failed, results }, null, 2),
);
console.log(`\nReport: ${path.join(DIR, 'report.json')}`);
console.log(`Screenshots: ${DIR}/`);

process.exit(failed > 0 ? 1 : 0);
