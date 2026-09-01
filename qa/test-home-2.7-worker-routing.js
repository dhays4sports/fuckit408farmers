#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
let source = fs.readFileSync(path.join(root, '_worker.js'), 'utf8');
source = source.replace('export default {', 'globalThis.__worker = {');

const runner = new Function(
  'TextEncoder','TextDecoder','URL','Request','Response','Headers','crypto','btoa','atob',
  `${source}\nreturn globalThis.__worker;`
);
const worker = runner(
  TextEncoder, TextDecoder, URL, Request, Response, Headers, globalThis.crypto,
  globalThis.btoa || ((value) => Buffer.from(value, 'binary').toString('base64')),
  globalThis.atob || ((value) => Buffer.from(value, 'base64').toString('binary'))
);

const seen = [];
const env = {
  ASSETS: {
    fetch: async (request) => {
      const url = new URL(request.url);
      seen.push(url.pathname);
      // Model Cloudflare Pages' documented pretty-path behavior: direct
      // requests for */index.html redirect to the corresponding pretty path.
      if (url.pathname.endsWith('/index.html')) {
        const pretty = new URL(url.toString());
        pretty.pathname = url.pathname.slice(0, -'index.html'.length);
        return Response.redirect(pretty.toString(), 308);
      }
      return new Response(`asset:${url.pathname}`, { status: 200, headers: { 'Content-Type': 'text/plain' } });
    }
  }
};

async function routed(input, expectedAsset) {
  seen.length = 0;
  const response = await worker.fetch(new Request(`https://408farmers.com${input}`), env);
  assert.equal(response.status, 200, `${input} should be served without an external redirect`);
  assert.equal(seen.at(-1), expectedAsset, `${input} should internally serve ${expectedAsset}`);
  assert.equal(response.headers.get('location'), null, `${input} must not leak an asset redirect to the browser`);
}

(async () => {
  // Deep campaign paths internally resolve to pretty routes.
  await routed('/home/qr/95118/rate/', '/home/');
  await routed('/home/qr/95118/fit/', '/home/');
  await routed('/home/qr/10001/rate/', '/home/');
  await routed('/home/campaign/home_flyer_95118_rate/', '/home/');
  await routed('/neighbor/r/ref_ABCDEFGHIJKLMNOP', '/neighbor/');

  // Canonical pretty routes pass straight through and cannot loop.
  await routed('/home/', '/home/');
  await routed('/contact/', '/contact/');
  await routed('/buyer/', '/buyer/');
  await routed('/life/', '/life/');
  await routed('/score/', '/score/');

  // Static assets remain untouched.
  await routed('/shared/styles.css', '/shared/styles.css');
  await routed('/shared/flyer-campaign.js', '/shared/flyer-campaign.js');

  // Regression guard: the Worker must never internally ask ASSETS for the
  // non-pretty /home/index.html path for a QR request.
  seen.length = 0;
  const qr = await worker.fetch(new Request('https://408farmers.com/home/qr/95118/rate/'), env);
  assert.equal(qr.status, 200);
  assert(!seen.includes('/home/index.html'), 'QR route must never request /home/index.html');

  seen.length = 0;
  const redirect = await worker.fetch(new Request('https://408farmers.com/home/Wowindex.html'), env);
  assert.equal(redirect.status, 301);
  assert.equal(redirect.headers.get('location'), 'https://408farmers.com/home/');
  assert.equal(seen.length, 0, 'legacy redirect should not hit static assets');

  console.log('408-HOME-2.7 Advanced Mode pretty-path routing QA: 16/16 passed');
})().catch((error) => {
  console.error(error.stack || error);
  process.exit(1);
});
