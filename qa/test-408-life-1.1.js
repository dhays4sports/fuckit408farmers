#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const exists = rel => fs.existsSync(path.join(root, rel));
const checks = [];
const check = (name, value) => { assert.ok(value, name); checks.push(name); };

const life = read('life/index.html');
const thanks = read('life/thank-you.html');
const css = read('shared/life.css');
const js = read('shared/life-intake.js');
const index = read('index.html');
const redirects = read('_redirects');
const manifest = JSON.parse(read('handoff-manifest.json'));
const contactJs = read('shared/contact-choice.js');

check('public runtime preserves LIFE-1.1 after later life releases', ['408-LIFE-1.1','408-LIFE-1.2','408-LIFE-1.3','408-LIFE-1.4','408-LIFE-1.4.1','408-LIFE-1.5','408-LIFE-1.6','408-LIFE-1.7','408-FLOW-1.5','408-HOME-2.1','408-HOME-2.2','408-HOME-2.3','408-HOME-2.4','408-HOME-2.5','408-HOME-2.6','408-HOME-2.7','408-HOME-2.8','408-HOME-2.9','408-FLOW-2.1','408-FLOW-2.2','408-FLOW-2.3','408-FLOW-2.4','408-CF-RPT-1.1','408-FLOW-2.5'].includes(read('VERSION').trim()) && ['408-LIFE-1.1','408-LIFE-1.2','408-LIFE-1.3','408-LIFE-1.4','408-LIFE-1.4.1','408-LIFE-1.5','408-LIFE-1.6','408-LIFE-1.7','408-FLOW-1.5','408-HOME-2.1','408-HOME-2.2','408-HOME-2.3','408-HOME-2.4','408-HOME-2.5','408-HOME-2.6','408-HOME-2.7','408-HOME-2.8','408-HOME-2.9','408-FLOW-2.1','408-FLOW-2.2','408-FLOW-2.3','408-FLOW-2.4','408-CF-RPT-1.1','408-FLOW-2.5'].includes(manifest.runtime));
for (const rel of ['life/index.html','life/thank-you.html','shared/life.css','shared/life-intake.js','SPRINT-408-LIFE-1.1.md']) {
  check(`exists:${rel}`, exists(rel));
}
check('canonical life route is declared', life.includes('https://408farmers.com/life/') && read('_worker.js').includes("'/life'") && !redirects.includes('/life/index.html')); 
check('homepage life entry now routes to dedicated page', /href="life\/"[\s\S]*?<span class="intent-label">Life insurance<\/span>/.test(index));
check('homepage keeps life direct contact out of the primary life card', !/href="contact\/\?intent=life"[\s\S]{0,180}<span class="intent-label">Life insurance<\/span>/.test(index));
check('existing life contact fallback remains supported', contactJs.includes("life: {") && life.includes('../contact/?intent=life'));
check('campaign headline matches approved foundation', life.toLowerCase().includes('before<br/>anything<br/><span>changes.</span>'));
check('application timing claim remains qualified', life.includes('Application may take') && life.includes('ABOUT 20 MINUTES') && life.includes('Application time and underwriting outcomes vary'));
check('same-day decision claim remains qualified', life.includes('POTENTIAL SAME-DAY DECISION') && life.includes('Eligible applicants may receive a'));
check('three light questions are represented', life.includes('What would you most want life insurance to protect?') && (life.includes('How long could your household comfortably continue without your income?') || life.includes('If something happened to you, how long could your household comfortably continue without your income?')) && life.includes('What life insurance do you already have today?'));
check('life route preserves bounded progression as secure submit is added later', !/type=["']submit["']/i.test(life) || life.includes('data-life-secure-submit'));
check('later application-init UI preserves foundation network boundary', !/fetch\s*\(|XMLHttpRequest|formspree|sendBeacon/i.test(js));
check('foundation script performs no network submission', !/fetch\s*\(|XMLHttpRequest|formspree|sendBeacon/i.test(js));
check('foundation script stores no applicant state', !/localStorage|sessionStorage|indexedDB/i.test(js));
check('foundation script is bounded to same-page navigation', js.includes('scrollIntoView') && js.includes("window.location.search + '#life-start'"));
check('life route does not invoke CoverageFit runtime', !/coveragefit-launch\.js|CoverageFitLauncher|coveragefit-launch/i.test(life) && !/CoverageFitLauncher|coveragefit-launch/i.test(js));
check('life CSS has mobile and reduced-motion coverage', css.includes('@media(max-width:760px)') && css.includes('@media(prefers-reduced-motion:reduce)') && css.includes('@media(forced-colors:active)'));
check('thank-you surface preserves accurate submission/binding language', ((thanks.includes('No application information was submitted by visiting this page.') || thanks.includes('does not submit application information to this page.')) || (thanks.includes('secure application-start details have been received') && thanks.includes('No coverage is in force'))) && thanks.includes('noindex,nofollow'));
check('manifest records paid-traffic state across LIFE sequence', ['408-LIFE-1.1','408-LIFE-1.2','408-LIFE-1.3','408-LIFE-1.4','408-LIFE-1.4.1','408-LIFE-1.5','408-LIFE-1.6','408-LIFE-1.7','408-FLOW-1.5','408-HOME-2.1','408-HOME-2.2','408-HOME-2.3','408-HOME-2.4','408-HOME-2.5','408-HOME-2.6','408-HOME-2.7','408-HOME-2.8','408-HOME-2.9','408-FLOW-2.1','408-FLOW-2.2','408-FLOW-2.3','408-FLOW-2.4','408-CF-RPT-1.1','408-FLOW-2.5'].includes(manifest.lifeCampaignFoundation?.build) && (manifest.lifeCampaignFoundation?.build==='408-LIFE-1.7' ? manifest.lifeCampaignFoundation?.paidTrafficReady===true : manifest.lifeCampaignFoundation?.paidTrafficReady===false));
check('CoverageFit route contract remains seven routes', Array.isArray(manifest.routes) && manifest.routes.length === 7 && manifest.coverageFit?.zeroRepeat === true);
check('existing Formspree path remains unchanged', manifest.formspree?.host === 'formspree.io' && manifest.formspree?.path === '/f/mojgnegn');

console.log(JSON.stringify({ sprint: '408-LIFE-1.1', passed: checks.length, failed: 0, checks }, null, 2));
