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
const axePath = process.env.AXE_PATH;

if (!executablePath || !fs.existsSync(executablePath)) {
  console.error('CHROMIUM_PATH must identify an installed Chromium executable.');
  process.exit(2);
}
if (!axePath || !fs.existsSync(axePath)) {
  console.error('AXE_PATH must identify axe.min.js.');
  process.exit(2);
}

const axeSource = fs.readFileSync(axePath, 'utf8');
const mime = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.webp': 'image/webp'
};

const server = http.createServer((request, response) => {
  const requestPath = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  let relative = requestPath.replace(/^\/+/, '');
  if (!relative || relative.endsWith('/')) relative += 'index.html';
  const target = path.resolve(root, relative);
  if (!target.startsWith(`${root}${path.sep}`) || !fs.existsSync(target) || !fs.statSync(target).isFile()) {
    response.writeHead(404).end('Not found');
    return;
  }
  response.writeHead(200, {
    'content-type': mime[path.extname(target).toLowerCase()] || 'application/octet-stream',
    'cache-control': 'no-store'
  });
  fs.createReadStream(target).pipe(response);
});

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address();
const base = `http://127.0.0.1:${port}`;
const browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const routes = [
  '/',
  '/privacy.html',
  '/terms.html',
  '/home/',
  '/home/thank-you.html',
  '/auto-bundle/',
  '/auto-bundle/thank-you.html',
  '/healthcare/',
  '/healthcare/thank-you.html',
  '/teachers/',
  '/teachers/thank-you.html',
  '/tech/',
  '/tech/thank-you.html',
  '/engineers/',
  '/engineers/thank-you.html',
  '/buyer/',
  '/buyer/thank-you.html',
  '/contact/',
  '/neighbor/',
  '/score/'
];
const checks = [];
const check = (name, condition) => { assert.ok(condition, name); checks.push(name); };

async function inspectPublicRoute(route) {
  const context = await browser.newContext({ viewport: { width: 320, height: 568 }, reducedMotion: 'reduce', forcedColors: 'none' });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto(`${base}${route}`, { waitUntil: 'load', timeout: 30000 });
  await page.addScriptTag({ content: axeSource });

  check(`${route}: one h1 at 320px`, await page.locator('h1').count() === 1);
  check(`${route}: no horizontal overflow at 320px`, await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
  check(`${route}: shared accessibility stylesheet applied`, await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--a11y-focus').trim() === '#005fcc'));

  await page.keyboard.press('Tab');
  await page.waitForTimeout(30);
  const focusedSkip = await page.evaluate(() => ({
    isSkip: document.activeElement?.classList.contains('skip-link') || false,
    visible: document.activeElement ? document.activeElement.getBoundingClientRect().top >= 0 : false,
    shadow: document.activeElement ? getComputedStyle(document.activeElement).boxShadow : 'none'
  }));
  check(`${route}: keyboard starts on a visible skip link`, focusedSkip.isSkip && focusedSkip.visible);
  check(`${route}: focus indicator is visibly dual contrast`, focusedSkip.shadow !== 'none' && focusedSkip.shadow.includes('rgb'));
  await page.keyboard.press('Enter');
  await page.waitForTimeout(30);
  check(`${route}: skip link focuses the main landmark`, await page.evaluate(() => document.activeElement?.tagName === 'MAIN'));

  const inputFonts = await page.locator('input:not([type="hidden"]), select, textarea').evaluateAll(controls => controls.filter(control => {
    const style = getComputedStyle(control);
    return style.display !== 'none' && style.visibility !== 'hidden';
  }).map(control => Number.parseFloat(getComputedStyle(control).fontSize)));
  check(`${route}: visible mobile form controls do not trigger iOS zoom`, inputFonts.every(size => size >= 16));

  const shortTargets = await page.evaluate(() => {
    const selector = [
      'button', '.primary-button', '.buyer-button', '.contact-method',
      '.header-contact', '.buyer-header-contact', '.score-contact',
      '.brand', '.buyer-brand', '.score-brand'
    ].join(',');
    return Array.from(document.querySelectorAll(selector)).filter(element => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0 && (rect.width < 44 || rect.height < 44);
    }).map(element => element.outerHTML.slice(0, 120));
  });
  check(`${route}: primary touch targets are at least 44px`, shortTargets.length === 0);

  const axeResult = await page.evaluate(async () => axe.run(document, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }
  }));
  check(`${route}: automated WCAG A/AA scan has zero violations`, axeResult.violations.length === 0);
  check(`${route}: has no runtime exception`, pageErrors.length === 0);
  await context.close();
}

async function inspectProgressiveValidation() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto(`${base}/healthcare/`, { waitUntil: 'load' });
  const form = page.locator('form[data-cro-progressive="true"]');
  await page.waitForFunction(() => document.querySelector('form[data-progressive-ready="true"]'));
  const role = form.locator('[name="occupation_segment"]');
  await form.locator('[data-cro-next]').click();
  const describedBy = await role.getAttribute('aria-describedby');
  check('CRO intake exposes invalid state to assistive technology', await role.getAttribute('aria-invalid') === 'true');
  check('CRO intake connects invalid control to its live error', Boolean(describedBy) && await form.locator(`#${describedBy.split(/\s+/).pop()}`).count() === 1);
  await role.selectOption({ index: 1 });
  check('CRO intake clears invalid state after correction', await role.getAttribute('aria-invalid') === null);
  await form.locator('[data-cro-next]').click();
  check('CRO intake announces the active step', (await form.locator('[data-cro-step-announcer]').textContent()).includes('Step 2 of 2'));
  await context.close();
}

async function inspectBuyerValidation() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto(`${base}/buyer/`, { waitUntil: 'load' });
  const form = page.locator('#leadForm');
  const property = form.locator('[name="property_address"]');
  await form.locator('[data-buyer-next]').click();
  check('Buyer exposes invalid state through its established engine', await property.getAttribute('aria-invalid') === 'true');
  check('Buyer connects invalid control to the live status', (await property.getAttribute('aria-describedby') || '').includes('formStatus'));
  await property.fill('123 Main St, Fremont, CA');
  check('Buyer clears invalid state after correction', await property.getAttribute('aria-invalid') === null);
  check('Buyer announces the current step', (await form.locator('[data-buyer-step-announcer]').textContent()).includes('Step 1 of 2'));
  await context.close();
}

async function inspectScoreCta() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto(`${base}/score/`, { waitUntil: 'load' });
  const tray = page.locator('.mobile-cta');
  const button = tray.locator('button');
  check('hidden mobile score CTA starts unfocusable', await tray.getAttribute('aria-hidden') === 'true' && await button.isDisabled());
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(300);
  check('visible mobile score CTA becomes focusable', await tray.getAttribute('aria-hidden') === 'false' && !await button.isDisabled());
  await context.close();
}

try {
  for (const route of routes) await inspectPublicRoute(route);
  await inspectProgressiveValidation();
  await inspectBuyerValidation();
  await inspectScoreCta();
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}

console.log(JSON.stringify({ sprint: '408-CRO-1.5-browser', passed: checks.length, failed: 0, checks }, null, 2));
