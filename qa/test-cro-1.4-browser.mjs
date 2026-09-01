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
  ['/auto-bundle/', 'housing_context'],
  ['/healthcare/', 'occupation_segment'],
  ['/teachers/', 'occupation_segment'],
  ['/tech/', 'occupation_segment'],
  ['/engineers/', 'occupation_segment']
];
const viewports = [
  { width: 390, height: 844, name: 'mobile' },
  { width: 1440, height: 1000, name: 'desktop' }
];
const checks = [];
const check = (name, condition) => { assert.ok(condition, name); checks.push(name); };

async function inspectRoute(route, contextField, viewport) {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto(`${base}${route}`, { waitUntil: 'load', timeout: 30000 });

  const form = page.locator('form[data-cro-progressive="true"]');
  await form.waitFor({ state: 'visible' });
  await page.waitForFunction(() => document.querySelector('form[data-progressive-ready="true"]'));
  const contextControl = form.locator(`[name="${contextField}"]`);
  const contactControl = form.locator('[name="first_name"]');

  check(`${route} ${viewport.name}: starts at Step 1 of 2`, await form.getAttribute('data-progressive-step') === '0' && await form.locator('[data-cro-progress-current]').textContent() === 'Step 1 of 2');
  check(`${route} ${viewport.name}: shows context only`, await contextControl.isVisible() && !await contactControl.isVisible());
  check(`${route} ${viewport.name}: no initial horizontal overflow`, await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));

  await form.locator('[data-cro-next]').click();
  check(`${route} ${viewport.name}: empty Step 1 recovers in place`, await form.getAttribute('data-progressive-step') === '0' && (await form.locator('[data-cro-step-status]').textContent()).includes('Please choose'));
  check(`${route} ${viewport.name}: empty Step 1 focuses context`, await contextControl.evaluate(control => document.activeElement === control));

  await contextControl.selectOption({ index: 1 });
  const selectedContext = await contextControl.inputValue();
  await form.locator('[data-cro-next]').click();
  check(`${route} ${viewport.name}: advances to Step 2 of 2`, await form.getAttribute('data-progressive-step') === '1' && await form.locator('[data-cro-progress-current]').textContent() === 'Step 2 of 2');
  check(`${route} ${viewport.name}: shows contact and hides context`, await contactControl.isVisible() && !await contextControl.isVisible());
  check(`${route} ${viewport.name}: Step 2 focus starts at first name`, await contactControl.evaluate(control => document.activeElement === control));
  check(`${route} ${viewport.name}: explains address continuation`, (await form.locator('.cro-handoff-note').textContent()).includes('property address again'));
  check(`${route} ${viewport.name}: Step 2 has no horizontal overflow`, await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));

  await form.locator('[data-cro-back]').click();
  check(`${route} ${viewport.name}: Back restores Step 1 and retains context`, await form.getAttribute('data-progressive-step') === '0' && await contextControl.inputValue() === selectedContext);
  await form.locator('[data-cro-next]').click();

  await contactControl.fill('Jordan');
  await form.locator('[name="last_name"]').fill('Test');
  await form.locator('button[type="submit"]').click();
  check(`${route} ${viewport.name}: invalid Step 2 stays visible`, await form.getAttribute('data-progressive-step') === '1' && await form.locator('[name="phone"]').isVisible());
  check(`${route} ${viewport.name}: invalid Step 2 focuses first missing field`, await form.locator('[name="phone"]').evaluate(control => document.activeElement === control));

  await form.locator('[name="phone"]').fill('(408) 555-1212');
  await form.locator('[name="email"]').fill('jordan@example.com');
  await form.locator('[name="property_address"]').fill('123 Main St, Fremont, CA');
  await form.locator('[name="consent"]').check();
  await page.evaluate(() => {
    window.__cro14Launch = null;
    window.__cro14LaunchCount = 0;
    window.fetch = () => Promise.resolve({ ok: true });
    window.CoverageFitLauncher.launch = options => {
      window.__cro14Launch = options;
      window.__cro14LaunchCount += 1;
    };
  });
  await form.locator('button[type="submit"]').click();
  await page.waitForFunction(() => window.__cro14Launch !== null);
  const launch = await page.evaluate(() => ({ options: window.__cro14Launch, count: window.__cro14LaunchCount, events: window.dataLayer || [] }));
  check(`${route} ${viewport.name}: submits through the original launcher once`, launch.count === 1 && launch.options.next === '/assessment/' && launch.options.assessment === 'home');
  check(`${route} ${viewport.name}: carries contact, property, and consent`, launch.options.profile.firstName === 'Jordan' && launch.options.profile.propertyAddress === '123 Main St, Fremont, CA' && launch.options.extra.contact_consent === 'true');
  check(`${route} ${viewport.name}: carries campaign context`, contextField === 'housing_context' ? launch.options.profile.housingContext === selectedContext : launch.options.profile.occupationSegment === selectedContext);
  check(`${route} ${viewport.name}: emits bounded funnel events`, ['cro_form_start', 'cro_form_step_complete', 'cro_form_validation_error', 'cro_form_submit_attempt'].every(name => launch.events.some(event => event.event === name)));
  check(`${route} ${viewport.name}: has no runtime exception`, pageErrors.length === 0);
  await context.close();
}

async function inspectNoScriptFallback() {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(`${base}/healthcare/`, { waitUntil: 'load' });
  const form = page.locator('#leadForm');
  check('no-script fallback keeps campaign context visible', await form.locator('[name="occupation_segment"]').isVisible());
  check('no-script fallback keeps contact and property visible', await form.locator('[name="first_name"]').isVisible() && await form.locator('[name="property_address"]').isVisible());
  check('no-script fallback keeps consent and submit visible', await form.locator('[name="consent"]').isVisible() && await form.locator('button[type="submit"]').isVisible());
  await context.close();
}

try {
  for (const [route, contextField] of routes) {
    for (const viewport of viewports) await inspectRoute(route, contextField, viewport);
  }
  await inspectNoScriptFallback();
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}

console.log(JSON.stringify({ sprint: '408-CRO-1.4-browser', passed: checks.length, failed: 0, checks }, null, 2));
