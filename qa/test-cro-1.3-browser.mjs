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
  '.svg': 'image/svg+xml',
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
  ['/auto-bundle/', 'auto-bundle'],
  ['/healthcare/', 'healthcare'],
  ['/teachers/', 'teachers'],
  ['/tech/', 'tech'],
  ['/engineers/', 'engineers']
];
const checks = [];
const check = (name, condition) => { assert.ok(condition, name); checks.push(name); };

async function inspectRoute(route, asset, viewport, expectedCandidate, throttle = false) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  if (throttle) {
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 150,
      downloadThroughput: 200000,
      uploadThroughput: 75000,
      connectionType: 'cellular3g'
    });
  }

  await page.goto(`${base}${route}`, { waitUntil: 'load', timeout: 30000 });
  const hero = page.locator('.campaign-hero-media img');
  await hero.waitFor({ state: 'visible' });
  const state = await hero.evaluate(image => ({
    currentSrc: image.currentSrc,
    complete: image.complete,
    naturalWidth: image.naturalWidth,
    priority: image.getAttribute('fetchpriority'),
    pictureSource: image.parentElement?.querySelector('source[type="image/webp"]')?.getAttribute('srcset') || '',
    fallback: image.getAttribute('src') || ''
  }));

  check(`${route} ${viewport.width}px selects ${expectedCandidate}`, state.currentSrc.endsWith(`/shared/assets/${asset}-${expectedCandidate}.webp`));
  check(`${route} ${viewport.width}px hero decodes`, state.complete && state.naturalWidth > 0);
  check(`${route} ${viewport.width}px source remains typed and responsive`, state.pictureSource.includes(`${asset}-480.webp 480w`) && state.pictureSource.includes(`${asset}-800.webp 800w`));
  check(`${route} ${viewport.width}px retains PNG fallback`, state.fallback.endsWith(`/shared/assets/${asset}.png`));
  check(`${route} ${viewport.width}px keeps hero priority`, state.priority === 'high');
  check(`${route} ${viewport.width}px has no horizontal overflow`, await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
  check(`${route} ${viewport.width}px has no runtime exception`, pageErrors.length === 0);

  if (viewport.width >= 1000) {
    const headshot = page.locator('.responsive-headshot img').first();
    await headshot.scrollIntoViewIfNeeded();
    await page.waitForFunction(element => element.complete && element.naturalWidth > 0, await headshot.elementHandle());
    check(`${route} deferred headshot resolves to WebP`, (await headshot.evaluate(image => image.currentSrc)).endsWith('.webp'));

    const carrier = page.locator('.carrier-mark img').first();
    await carrier.scrollIntoViewIfNeeded();
    await page.waitForFunction(element => element.complete && element.naturalWidth > 0, await carrier.elementHandle());
    check(`${route} deferred carrier resolves to WebP`, (await carrier.evaluate(image => image.currentSrc)).endsWith('farmers-authorized-agency-320.webp'));
  }

  const fallbackState = await hero.evaluate(async image => {
    image.parentElement?.querySelectorAll('source').forEach(source => source.remove());
    image.src = image.getAttribute('src');
    if (image.decode) await image.decode();
    return { currentSrc: image.currentSrc, width: image.naturalWidth, height: image.naturalHeight };
  });
  check(`${route} PNG fallback decodes`, fallbackState.currentSrc.endsWith(`/shared/assets/${asset}.png`) && fallbackState.width > 0 && fallbackState.height > 0);

  await context.close();
}

try {
  for (const [route, asset] of routes) {
    await inspectRoute(route, asset, { width: 390, height: 844 }, '480', true);
    await inspectRoute(route, asset, { width: 1440, height: 1000 }, '800');
  }
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}

console.log(JSON.stringify({ sprint: '408-CRO-1.3-browser', passed: checks.length, failed: 0, checks }, null, 2));
