#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');

const root = path.resolve(__dirname, '..');
const homePath = path.join(root, 'home/index.html');
const home = fs.readFileSync(homePath, 'utf8');
const redirects = fs.readFileSync(path.join(root, '_redirects'), 'utf8');
const checks = [];
const check = (name, condition, detail = '') => {
  assert.ok(condition, `${name}${detail ? ` — ${detail}` : ''}`);
  checks.push(name);
};

const deepBases = [
  'https://408farmers.com/home/qr/95118/rate/',
  'https://408farmers.com/home/qr/95118/fit/',
  'https://408farmers.com/home/qr/10001/rate/',
  'https://408farmers.com/home/qr/99999/fit/'
];

check('Advanced Mode owns deep QR routing without static index rewrites',
  fs.readFileSync(path.join(root, '_worker.js'), 'utf8').includes("path.startsWith('/home/qr/')") &&
  !redirects.includes('/home/index.html'));

check('Home document has no parent-relative references', !home.includes('../'));
check('core Home stylesheet is root-relative', home.includes('href="/shared/styles.css'));
check('flyer campaign runtime is root-relative', home.includes('src="/shared/flyer-campaign.js'));
check('main form runtime is root-relative', home.includes('src="/shared/script.js'));
check('hero image is root-relative', home.includes('src="/shared/assets/home.jpg"'));
check('footer legal links are root-relative', home.includes('href="/privacy.html"') && home.includes('href="/terms.html"'));

function localPathExists(urlString) {
  const parsed = new URL(urlString);
  if (parsed.origin !== 'https://408farmers.com') return true;
  let pathname = decodeURIComponent(parsed.pathname);
  if (pathname.endsWith('/')) pathname += 'index.html';
  const local = path.join(root, pathname.replace(/^\/+/, ''));
  return fs.existsSync(local);
}

function collectAttributeValues(markup) {
  const values = [];
  const attrPattern = /\b(?:href|src|srcset|imagesrcset)\s*=\s*["']([^"']+)["']/gi;
  let match;
  while ((match = attrPattern.exec(markup))) {
    const raw = match[1].trim();
    if (!raw || raw.startsWith('#') || raw.startsWith('data:') || raw.startsWith('mailto:') || raw.startsWith('tel:') || raw.startsWith('sms:') || raw.startsWith('javascript:')) continue;
    if (/^https?:\/\//i.test(raw) || raw.startsWith('//')) continue;
    if (raw.includes(',') || /\s+\d+(?:\.\d+)?[wx](?:\s|$)/.test(raw)) {
      raw.split(',').forEach(part => {
        const candidate = part.trim().split(/\s+/)[0];
        if (candidate) values.push(candidate);
      });
    } else {
      values.push(raw);
    }
  }
  return values;
}

const localRefs = collectAttributeValues(home);
check('Home exposes local asset/link references for regression coverage', localRefs.length >= 20, String(localRefs.length));

for (const base of deepBases) {
  const failures = [];
  for (const value of localRefs) {
    const resolved = new URL(value, base).toString();
    if (!localPathExists(resolved)) failures.push(`${value} -> ${new URL(resolved).pathname}`);
  }
  check(`all Home references resolve from ${new URL(base).pathname}`, failures.length === 0, failures.slice(0, 5).join('; '));
}

console.log(`408-HOME-2.7 deep-route asset QA: ${checks.length}/${checks.length} passed`);
