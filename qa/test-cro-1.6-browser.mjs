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

const mime = {
  '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8', '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp'
};
const server = http.createServer((request, response) => {
  const requestPath = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  let relative = requestPath.replace(/^\/+/, '');
  if (!relative || relative.endsWith('/')) relative += 'index.html';
  const target = path.resolve(root, relative);
  if (!target.startsWith(`${root}${path.sep}`) || !fs.existsSync(target) || !fs.statSync(target).isFile()) {
    response.writeHead(404).end('Not found'); return;
  }
  response.writeHead(200, { 'content-type': mime[path.extname(target).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' });
  fs.createReadStream(target).pipe(response);
});

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const routes = ['/', '/home/', '/auto-bundle/', '/healthcare/', '/teachers/', '/tech/', '/engineers/', '/buyer/', '/contact/', '/neighbor/', '/score/'];
const prohibited = ['Check My Eligibility', 'reach out shortly', 'follow up with you shortly', 'Fast follow-up', 'personally prepare your options', 'personally evaluated by Dylan'];
const checks = [];
const check = (name, condition) => { assert.ok(condition, name); checks.push(name); };

try {
  for (const route of routes) {
    const context = await browser.newContext({ viewport: { width: 320, height: 568 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${base}${route}`, { waitUntil: 'load', timeout: 30000 });
    const text = await page.locator('body').innerText();
    check(`${route}: promise contract is rendered`, await page.locator('[data-promise-contract="coverage-review-v1"]').count() >= 1);
    check(`${route}: does not render prohibited promises`, prohibited.every(item => !text.toLowerCase().includes(item.toLowerCase())));
    check(`${route}: remains reflow-safe at 320px`, await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
    check(`${route}: retains one primary heading`, await page.locator('h1').count() === 1);
    check(`${route}: has no runtime exception`, errors.length === 0);
    await context.close();
  }

  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto(`${base}/healthcare/`, { waitUntil: 'load' });
  await page.waitForFunction(() => document.querySelector('form[data-progressive-ready="true"]'));
  page.__professionalCtaText = await page.locator('button[type="submit"]').textContent();
  check('professional CTA renders as a Coverage Review', ['Start My Professional Coverage Review', 'Review My Professional Discount Eligibility', 'See Which Professional Discounts May Apply'].some(label => (page.__professionalCtaText || '').includes(label)));
  page.__professionalBodyText = await page.locator('body').innerText();
  check('professional route renders verified-discount disclosure', ['Discount availability is verified during quoting and underwriting.', 'Dylan verifies availability during quoting and underwriting.'].some(copy => (page.__professionalBodyText || '').includes(copy)));
  check('progressive handoff describes CoverageFit before Dylan options', (await page.locator('.cro-handoff-note').innerText()).includes('educational Protection Snapshot'));
  check('progressive form retains the zero-repeat property field', await page.locator('form [name="property_address"]').count() === 1);
  await context.close();

  const fallbackContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const fallback = await fallbackContext.newPage();
  await fallback.goto(`${base}/home/thank-you.html`, { waitUntil: 'load' });
  const fallbackText = await fallback.locator('main').innerText();
  check('fallback page truthfully identifies the failed continuation path', fallbackText.includes('local fallback') && fallbackText.includes('guided CoverageFit continuation'));
  check('fallback page makes no response-time promise', !/shortly|within|same day|minutes/i.test(fallbackText));
  await fallbackContext.close();
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}

console.log(JSON.stringify({ sprint: '408-CRO-1.6-browser', passed: checks.length, failed: 0, checks }, null, 2));
