#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const receiverRoot = process.env.COVERAGEFIT_ROOT ? path.resolve(process.env.COVERAGEFIT_ROOT) : null;
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const bytes = relative => fs.statSync(path.join(root, relative)).size;
const checks = [];
const check = (name, value) => { assert.ok(value, name); checks.push(name); };
const homeRelative = value => {
  const clean = value.split('?')[0];
  return clean.startsWith('/') ? clean.replace(/^\/+/, '') : path.normalize(path.join('home', clean));
};

const html = read('home/index.html');
const contract = JSON.parse(read('HOME2_9_MOBILE_ACCESSIBILITY_PERFORMANCE_CONTRACT.json'));
const manifest = JSON.parse(read('handoff-manifest.json'));
const certificationCss = read('shared/home-certification.css');
const engagementJs = read('shared/home-engagement.js');
const certificationJs = read('shared/home-certification.js');

check('release preserves the HOME-2.9 certification', ['408-HOME-2.9', '408-FLOW-2.1','408-FLOW-2.2','408-FLOW-2.3','408-FLOW-2.4','408-CF-RPT-1.1','408-FLOW-2.5'].includes(read('VERSION').trim()) && manifest.runtime === read('VERSION').trim() && ['CoverageFit v3.20.60', 'CoverageFit v3.20.61','CoverageFit v3.20.62'].includes(manifest.receiver));
check('route exposes safe viewport and skip navigation', html.includes('viewport-fit=cover') && /class="skip-link"[^>]+href="#main-content"/.test(html) && /id="main-content"[^>]+tabindex="-1"/.test(html));
check('hero uses responsive WebP with intrinsic fallback dimensions', html.includes('/shared/assets/home-420.webp 420w, /shared/assets/home-653.webp 653w') && html.includes('width="653" height="1254"') && bytes('shared/assets/home-653.webp') < bytes('shared/assets/home.jpg'));
check('header logo uses optimized WebP with intrinsic dimensions', html.includes('408-farmers-logo-506.webp') && html.includes('width="506" height="107"') && bytes('shared/assets/408-farmers-logo-506.webp') < bytes('shared/assets/408-farmers-logo.png'));

const scripts = [...html.matchAll(/<script\b([^>]*)\bsrc="([^"]+)"[^>]*>/g)];
check('all ordered Home route scripts use deferred fetching', scripts.length >= 13 && scripts.every(match => /\bdefer\b/.test(match[1]) || /\bdefer\b/.test(match[0])));
check('engagement and lead progress expose programmatic state', (html.match(/role="progressbar"/g) || []).length === 2 && html.includes('aria-valuetext') === false && engagementJs.includes("setAttribute('aria-valuetext'") && read('shared/home-lead-progressive.js').includes("setAttribute('aria-valuetext'"));
check('engagement validation is connected to its active question', html.includes('id="home-engagement-error"') && (html.match(/aria-describedby="home-engagement-error"/g) || []).length === 3 && engagementJs.includes("setAttribute('aria-invalid', 'true')"));
check('lead validation exposes invalid state and description', certificationJs.includes("addEventListener('invalid'") && certificationJs.includes("setAttribute('aria-invalid', 'true')") && certificationJs.includes('formStatus.id'));
check('mobile controls avoid iOS form zoom', certificationCss.includes('font-size: 16px !important'));
check('touch target, safe-area, narrow-phone and landscape guards exist', certificationCss.includes('min-height: 44px') && certificationCss.includes('env(safe-area-inset-top)') && certificationCss.includes('@media (max-width: 380px)') && certificationCss.includes('(orientation: landscape)'));
check('reduced motion and forced colors are supported', certificationCss.includes('prefers-reduced-motion: reduce') && certificationCss.includes('forced-colors: active'));
check('viewport certification matrix spans narrow phone through desktop', contract.viewportMatrix[0].width === 320 && contract.viewportMatrix.some(item => item.width === 768) && contract.viewportMatrix.some(item => item.width === 1440));

const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
check('Home route contains no duplicate IDs', new Set(ids).size === ids.length);

const senderInitialBytes = bytes('home/index.html')
  + [...html.matchAll(/<link[^>]+href="([^"]+\.css(?:\?[^"]*)?)"/g)].reduce((sum, match) => sum + bytes(homeRelative(match[1])), 0)
  + scripts.reduce((sum, match) => sum + bytes(homeRelative(match[2])), 0)
  + bytes('shared/assets/home-653.webp')
  + bytes('shared/assets/408-farmers-logo-506.webp');
check('optimized Home initial transfer is below 500 KB', senderInitialBytes < contract.performance.initialTransferBudgetBytesPerRoute);

let receiverInitialBytes = null;
if (receiverRoot) {
  const receiverVersion = fs.readFileSync(path.join(receiverRoot, 'VERSION'), 'utf8').trim();
  const receiverHtml = fs.readFileSync(path.join(receiverRoot, 'assessment/index.html'), 'utf8');
  const receiverSize = relative => fs.statSync(path.join(receiverRoot, relative)).size;
  const receiverScripts = [...receiverHtml.matchAll(/<script\b([^>]*)\bsrc="([^"]+)"[^>]*>/g)];
  const receiverStyles = [...receiverHtml.matchAll(/<link[^>]+href="([^"]+\.css)"/g)];
  receiverInitialBytes = receiverSize('assessment/index.html')
    + receiverScripts.reduce((sum, match) => sum + receiverSize(match[2].replace(/^\//, '')), 0)
    + receiverStyles.reduce((sum, match) => sum + receiverSize(match[1].replace(/^\//, '')), 0)
    + receiverSize('assets/images/coveragefit-logo.svg')
    + receiverSize('assets/illustrations/default.svg');
  check('synchronized CoverageFit release and budget are certified', ['3.20.60', '3.20.61','3.20.62'].includes(receiverVersion) && receiverInitialBytes < contract.performance.initialTransferBudgetBytesPerRoute);
}

check('conversion, branching, recovery and scoring guarantees remain explicit', contract.unchanged.branchDestinations && contract.unchanged.campaignAttribution && contract.unchanged.assessmentQuestions && contract.unchanged.protectionScoreFormula && contract.unchanged.leadPoints === 2);

console.log(`408-HOME-2.9 QA: ${checks.length}/${checks.length} passed; sender_initial_bytes=${senderInitialBytes}${receiverInitialBytes === null ? '' : `; receiver_initial_bytes=${receiverInitialBytes}`}`);
