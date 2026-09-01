'use strict';

const assert = require('assert');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { runSmoke, ROUTES } = require('./production-handoff-smoke');

const root = path.resolve(__dirname, '..');
const fixtureRoot = path.join(__dirname, 'fixtures', 'coveragefit-v3.20.7');

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve(`http://127.0.0.1:${address.port}`);
    });
  });
}

function contentType(file) {
  if (file.endsWith('.html')) return 'text/html; charset=utf-8';
  if (file.endsWith('.js')) return 'application/javascript; charset=utf-8';
  if (file.endsWith('.json')) return 'application/json; charset=utf-8';
  if (file.endsWith('.css')) return 'text/css; charset=utf-8';
  return 'application/octet-stream';
}

function safeStaticPath(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0]);
  const rel = clean.endsWith('/') ? `${clean.slice(1)}index.html` : clean.slice(1);
  const resolved = path.resolve(root, rel || 'index.html');
  return resolved.startsWith(root) ? resolved : '';
}

async function main() {
  let submissionCount = 0;
  const submittedRoutes = [];

  const farmersServer = http.createServer((req, res) => {
    const file = safeStaticPath(req.url || '/');
    if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType(file) });
    fs.createReadStream(file).pipe(res);
  });

  const coverageServer = http.createServer((req, res) => {
    const pathname = new URL(req.url || '/', 'http://localhost').pathname;
    const routes = {
      '/home/': path.join(fixtureRoot, 'home.html'),
      '/transition/': path.join(fixtureRoot, 'transition.html'),
      '/assets/js/prefill-intake.js': path.join(fixtureRoot, 'prefill-intake.js'),
      '/assets/js/attribution.js': path.join(fixtureRoot, 'attribution.js'),
      '/assets/js/personalization-context.js': path.join(fixtureRoot, 'personalization-context.js'),
      '/assets/js/transition-route.js': path.join(fixtureRoot, 'transition-route.js')
    };
    const file = routes[pathname];
    if (!file) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType(file) });
    fs.createReadStream(file).pipe(res);
  });

  const formspreeServer = http.createServer((req, res) => {
    if (req.method !== 'POST' || req.url !== '/f/mock') {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false }));
      return;
    }
    let body = '';
    req.setEncoding('utf8');
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      submissionCount += 1;
      const match = body.match(/name="smoke_route"\r\n\r\n([^\r]+)/);
      if (match) submittedRoutes.push(match[1]);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    });
  });

  const servers = [farmersServer, coverageServer, formspreeServer];
  try {
    const [farmersBase, coverageFitBase, formspreeBase] = await Promise.all(servers.map(listen));
    const report = await runSmoke({
      farmersBase,
      coverageFitBase,
      formspreeEndpoint: `${formspreeBase}/f/mock`,
      submit: true,
      acknowledgeLeads: true,
      timeoutMs: 5000
    });

    if (report.status !== 'CERTIFIED') console.error(JSON.stringify(report.checks.filter(check => !check.passed), null, 2));
    assert.equal(report.status, 'CERTIFIED');
    assert.equal(report.failures, 0);
    assert(report.total >= 90, `expected a comprehensive smoke run, got ${report.total}`);
    assert.equal(report.routes.length, ROUTES.length);
    assert.equal(submissionCount, ROUTES.length);
    assert.deepEqual(submittedRoutes.sort(), ROUTES.map(route => route.path).sort());
    for (const route of report.routes) {
      assert.equal(route.formspree, 'passed');
      assert(route.handoffUrl.endsWith('?<redacted>'));
      assert(route.checks.every(check => check.passed), `${route.path} contains a failed check`);
    }

    console.log(`408-CONV-1.1 legacy-fixture QA: ${report.passed}/${report.total} checks passed; ${submissionCount}/${ROUTES.length} mock Formspree submissions accepted`);
  } finally {
    await Promise.all(servers.map(server => new Promise(resolve => server.close(resolve))));
  }
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
