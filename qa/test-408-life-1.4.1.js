#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const exists = rel => fs.existsSync(path.join(root, rel));
const checks = [];
function check(name, value) { assert.ok(value, name); checks.push(name); }

const version = read('VERSION').trim();
const life = read('life/index.html');
const thanks = read('life/thank-you.html');
const client = read('shared/life-secure-submit.js');
const worker = read('_worker.js');
const headers = read('_headers');
const deployment = read('LIFE-SECURE-SUBMISSION-DEPLOYMENT.md');
const manifest = JSON.parse(read('handoff-manifest.json'));

check('LIFE-1.4.1 Cloudflare alignment is preserved by current release', ['408-LIFE-1.4.1','408-LIFE-1.5','408-LIFE-1.6','408-LIFE-1.7','408-FLOW-1.5','408-HOME-2.1','408-HOME-2.2','408-HOME-2.3','408-HOME-2.4','408-HOME-2.5','408-HOME-2.6','408-HOME-2.7','408-HOME-2.8','408-HOME-2.9','408-FLOW-2.1','408-FLOW-2.2','408-FLOW-2.3','408-FLOW-2.4','408-CF-RPT-1.1','408-FLOW-2.5'].includes(version) && ['408-LIFE-1.4.1','408-LIFE-1.5','408-LIFE-1.6','408-LIFE-1.7','408-FLOW-1.5','408-HOME-2.1','408-HOME-2.2','408-HOME-2.3','408-HOME-2.4','408-HOME-2.5','408-HOME-2.6','408-HOME-2.7','408-HOME-2.8','408-HOME-2.9','408-FLOW-2.1','408-FLOW-2.2','408-FLOW-2.3','408-FLOW-2.4','408-CF-RPT-1.1','408-FLOW-2.5'].includes(manifest.runtime));
for (const rel of ['_worker.js','_headers','shared/life-secure-submit.js','LIFE-SECURE-SUBMISSION-DEPLOYMENT.md','SPRINT-408-LIFE-1.4.1.md']) check(`exists:${rel}`, exists(rel));
check('Netlify runtime remains removed', !exists('netlify.toml') && !exists('netlify') && !/netlify\/functions/i.test(worker));
check('life surfaces carry current LIFE build', life.includes(`data-life-build="${manifest.lifeCampaignFoundation.build}"`) && thanks.includes(`data-life-build="${manifest.lifeCampaignFoundation.build}"`));
check('client endpoint remains same-origin and stable', client.includes("var ENDPOINT = '/api/life/application-init';") && !/https?:\/\//i.test(client));
check('Cloudflare worker still owns exact LIFE API route', worker.includes("const API_PATH = '/api/life/application-init';") && worker.includes('url.pathname === API_PATH'));
check('non-API traffic still falls through to Pages assets', worker.includes('env.ASSETS.fetch(request)'));
check('Cloudflare runtime still uses env bindings not process.env', !/process\.env|require\s*\(/.test(worker));
check('Worker still uses native Web Crypto', worker.includes('crypto.subtle.importKey') && !/node:crypto|require\(['"]crypto/.test(worker));
check('static LIFE headers remain Cloudflare-compatible', headers.includes('/life/*') && headers.includes('Cache-Control: no-store') && headers.includes("connect-src 'self'") && headers.includes("frame-ancestors 'none'"));
check('API still sets no-store and anti-framing headers', worker.includes("'Cache-Control': 'no-store, max-age=0'") && worker.includes("'X-Frame-Options': 'DENY'"));
check('deployment documentation remains Cloudflare-specific', /Cloudflare Pages/i.test(deployment) && /_worker\.js/.test(deployment));
check('server source contains no request-body logging', !/console\./i.test(worker));
check('server source contains no Formspree CoverageFit email or Slack transport', !/formspree|coveragefit|slack|mailto:|smtp|sendgrid|resend/i.test(worker));
check('public server still limits body size', worker.includes('MAX_BODY_BYTES = 16 * 1024') && worker.includes('encoder.encode(rawBody).byteLength'));
check('public server still validates origin and fetch metadata', worker.includes('validOrigin(request, env)') && worker.includes("fetchSite === 'same-origin'"));
check('public server still exact-key allowlists payload groups', worker.includes('exactKeys(payload') && worker.includes('exactKeys(payload.applicant'));
check('public server still validates last4 exactly four digits', worker.includes("/^\\d{4}$/.test(applicant.ssn_last4)"));
check('manifest still declares Cloudflare Advanced Mode', manifest.lifeCampaignFoundation?.secureSubmissionPlatform === 'cloudflare_pages_advanced_mode' && manifest.lifeCampaignFoundation?.secureSubmissionRuntimeFile === '_worker.js');
check('LIFE-1.5 supersedes relay with Cloudflare queue without regressing secure boundary', ['408-LIFE-1.5','408-LIFE-1.6','408-LIFE-1.7','408-FLOW-1.5','408-HOME-2.1','408-HOME-2.2','408-HOME-2.3','408-HOME-2.4','408-HOME-2.5','408-HOME-2.6','408-HOME-2.7','408-HOME-2.8','408-HOME-2.9','408-FLOW-2.1','408-FLOW-2.2','408-FLOW-2.3','408-FLOW-2.4','408-CF-RPT-1.1','408-FLOW-2.5'].includes(version) ? manifest.lifeCampaignFoundation?.producerQueueEnabled === true : true);

const report = { sprint: '408-LIFE-1.4.1-regression', passed: checks.length, failed: 0, checks };
fs.writeFileSync(path.join(root, 'LIFE1_4_1_REGRESSION_QA.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
