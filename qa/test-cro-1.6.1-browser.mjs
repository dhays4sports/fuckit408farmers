#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const executablePath = process.env.CHROMIUM_PATH;
if (!executablePath || !fs.existsSync(executablePath)) {
  console.error('CHROMIUM_PATH must identify an installed Chromium executable.');
  process.exit(2);
}

const mime = { '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8', '.ico': 'image/x-icon', '.jpg': 'image/jpeg', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp' };
const server = http.createServer((request, response) => {
  const requestPath = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  let relative = requestPath.replace(/^\/+/, '');
  if (!relative || relative.endsWith('/')) relative += 'index.html';
  const target = path.resolve(root, relative);
  if (!target.startsWith(`${root}${path.sep}`) || !fs.existsSync(target) || !fs.statSync(target).isFile()) { response.writeHead(404).end('Not found'); return; }
  response.writeHead(200, { 'content-type': mime[path.extname(target).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' });
  fs.createReadStream(target).pipe(response);
});

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const routes = ['/healthcare/', '/teachers/', '/tech/', '/engineers/'];
const checks = [];
const check = (name, condition) => { assert.ok(condition, name); checks.push(name); };

try {
  for (const route of routes) {
    const context = await browser.newContext({ viewport: { width: 320, height: 568 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${base}${route}`, { waitUntil: 'load', timeout: 30000 });
    await page.waitForFunction(() => document.querySelector('form[data-progressive-ready="true"]'));
    const body = await page.locator('body').innerText();
    check(`${route}: renders conditional eligibility intent`, body.includes('may qualify') && body.includes('professional discounts'));
    check(`${route}: renders the corrected CTA`, (await page.locator('button[type="submit"]').innerText()).match(/Review My Professional Discount Eligibility|See Which Professional Discounts May Apply/));
    check(`${route}: names licensed verification`, body.includes('Dylan verifies availability during quoting and underwriting.'));
    check(`${route}: keeps CoverageFit non-decisional`, (await page.locator('.cta-reassurance').textContent()).includes('CoverageFit is educational, not a quote or eligibility decision.'));
    check(`${route}: remains reflow-safe at 320px`, await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
    check(`${route}: retains one h1 and no runtime error`, await page.locator('h1').count() === 1 && errors.length === 0);
    await context.close();
  }

  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto(`${base}/healthcare/`, { waitUntil: 'load' });
  await page.waitForFunction(() => document.querySelector('form[data-progressive-ready="true"]'));
  check('role-first step is the first progressive step', (await page.locator('.cro-step-heading').first().innerText()).includes('Your healthcare role'));
  await page.selectOption('[name="occupation_segment"]', { index: 1 });
  await page.locator('[data-cro-next]').click();
  check('flow advances to contact and property once', await page.locator('[name="property_address"]:visible').count() === 1);
  const handoff = await page.locator('.cro-handoff-note').innerText();
  check('handoff retains educational Snapshot before licensed verification', handoff.includes('educational Protection Snapshot') && /Dylan.*verify/.test(handoff));
  await context.close();

  const rootContext = await browser.newContext({ viewport: { width: 320, height: 568 }, reducedMotion: 'reduce' });
  const rootPage = await rootContext.newPage();
  await rootPage.goto(`${base}/`, { waitUntil: 'load' });
  const professional = await rootPage.locator('#professionals').innerText();
  check('homepage routes visitors into an eligibility review', professional.includes('may qualify you for additional discounts') && (professional.match(/Review my eligibility|See which discounts may apply/g) || []).length === 4);
  check('homepage remains reflow-safe at 320px', await rootPage.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
  await rootContext.close();
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}

console.log(JSON.stringify({ sprint: '408-CRO-1.6.1-browser', passed: checks.length, failed: 0, checks }, null, 2));
