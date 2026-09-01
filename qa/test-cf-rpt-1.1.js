#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const receiverRoot = process.env.COVERAGEFIT_ROOT || path.resolve(root, '../coveragefit');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const checks = [];
const check = (name, condition) => { assert.ok(condition, name); checks.push(name); };

const contract = JSON.parse(read('CF_RPT1_1_SENDER_CONTRACT.json'));
const manifest = JSON.parse(read('handoff-manifest.json'));
const invitation = read('shared/coveragefit-invitation.js');
const styles = read('shared/coveragefit-invitation.css');

check('sender preserves 408-CF-RPT-1.1 through FLOW-2.5 certification', ['408-CF-RPT-1.1','408-FLOW-2.5'].includes(read('VERSION').trim()) && manifest.runtime === read('VERSION').trim());
check('sender contract is packaged', contract.runtime === '408-CF-RPT-1.1' && fs.existsSync(path.join(root, 'SPRINT-408-CF-RPT-1.1.md')));
check('manifest synchronizes CoverageFit 3.20.62', manifest.receiver === 'CoverageFit v3.20.62' && manifest.optionalCoverageFitInvitation.receiver === 'CoverageFit v3.20.62');
check('manifest publishes the concrete report promise', /saved as PDF or printed/.test(manifest.optionalCoverageFitInvitation.acceptedPromise));

check('invitation promises a free saveable report', invitation.includes('free Home Protection Snapshot you can save as a PDF or print'));
check('benefit list repeats the concrete action', invitation.includes('Save the finished Snapshot as a PDF or print it'));
check('vague downloadable-only promise is retired', !invitation.includes('downloadable Home Protection Snapshot') && !invitation.includes('Download your completed Home Protection Snapshot'));
check('accept and defer choices remain separate', invitation.includes('Continue to CoverageFit') && invitation.includes('Finish for Now'));
check('invitation has no automatic or timed launch', !invitation.includes('setTimeout') && !invitation.includes('setInterval'));
check('invitation creates no network request', !/\bfetch\s*\(/.test(invitation));
check('renter branch still skips Home assessment', invitation.includes('View Renters Options') && invitation.includes('Skip the homeowner assessment'));
check('invitation retains accessibility and mobile styles', invitation.includes('aria-live="polite"') && invitation.includes('role="group"') && styles.includes('@media(max-width:620px)'));

for (const route of contract.routes) {
  const html = read(`${route}/index.html`);
  const form = html.match(/<form\b[\s\S]*?<\/form>/)?.[0] || '';
  check(`${route} publishes the synchronized invitation build`, html.includes('coveragefit-invitation.js?v=408-CF-RPT-1.1') && html.includes('coveragefit-invitation.css?v=408-CF-RPT-1.1'));
  check(`${route} remains form-first and explicit-choice enabled`, form.includes('data-journey-stage="pre_review_intake"') && form.includes('data-coveragefit-invitation="true"') && form.includes('data-coveragefit-invitation-build="408-CF-RPT-1.1"'));
  check(`${route} retains one required consent`, (form.match(/name=["']consent["']/g) || []).length === 1 && /name=["']consent["'][^>]*required|<input[^>]*required[^>]*name=["']consent["']/.test(form));
}

check('LIFE remains outside CoverageFit invitation', !read('life/index.html').includes('coveragefit-invitation'));
check('receiver runtime is CoverageFit 3.20.62', fs.readFileSync(path.join(receiverRoot, 'VERSION'), 'utf8').trim() === '3.20.62');
const receiverReport = fs.readFileSync(path.join(receiverRoot, 'home/report/index.html'), 'utf8');
check('receiver delivers the exact promised action', receiverReport.includes('Save as PDF / Print') && receiverReport.includes('choose a printer for a paper copy'));
check('Protection Score remains byte-certified', crypto.createHash('sha256').update(fs.readFileSync(path.join(receiverRoot, 'assets/js/protection-score.js'))).digest('hex') === contract.preserved.protectionScoreSha256);

console.log(JSON.stringify({ sprint: '408-CF-RPT-1.1', passed: checks.length, failed: 0, checks }, null, 2));
