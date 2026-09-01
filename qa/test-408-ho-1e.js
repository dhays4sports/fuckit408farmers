'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const launcher = read('shared/coveragefit-launch.js');
const home = read('home/index.html');
const manifest = JSON.parse(read('handoff-manifest.json'));
const smoke = read('qa/production-handoff-smoke.js');
function storage() { const map = new Map(); return { getItem:k=>map.has(k)?map.get(k):null, setItem:(k,v)=>map.set(k,String(v)), removeItem:k=>map.delete(k) }; }
function runtime(search) {
  const window = { location:{ origin:'https://408farmers.com', pathname:'/home/', search }, sessionStorage:storage(), localStorage:storage(), crypto:{randomUUID:()=> 'ho1e-session'}, LANDING_PAGE_CONFIG:{coverageFitHomeUrl:'https://coveragefit.com/home/'}, dataLayer:[], CustomEvent:function(){} };
  const document = { readyState:'complete', querySelectorAll:()=>[], addEventListener(){}, dispatchEvent(){} };
  const context = vm.createContext({window, document, URL, URLSearchParams, Object, Date, Math, String, JSON, console});
  vm.runInContext(launcher, context);
  return window;
}
const checks=[]; const check=(name,fn)=>{ fn(); checks.push(name); console.log('PASS',name); };
check('stable contract is exposed by every personalized form', () => {
  for (const rel of ['home/index.html','tech/index.html','engineers/index.html','healthcare/index.html','teachers/index.html']) {
    const html=read(rel); assert(/data-sender-build="408-(?:CONV-1\.1|HOME-2\.[123456789])"/.test(html)); assert(html.includes('data-handoff-contract="coveragefit-handoff-v1"'));
  }
});
check('legacy referral query maps to canonical ref only', () => {
  const url = new URL(runtime('?referral=realtor-partner').CoverageFitLauncher.buildUrl({entry:'home_lander_form'}));
  assert.equal(url.searchParams.get('ref'),'realtor-partner'); assert.equal(url.searchParams.has('referral'),false);
});
check('canonical ref query remains canonical', () => {
  const url = new URL(runtime('?ref=lender-partner&referral=legacy-value').CoverageFitLauncher.buildUrl({entry:'home_lander_form'}));
  assert.equal(url.searchParams.get('ref'),'lender-partner'); assert.equal(url.searchParams.has('referral'),false);
});
check('Home form exposes both new TX-1.4 review reasons', () => {
  assert(home.includes('<option>Non-renewal or cancellation</option>')); assert(home.includes('<option>Premium increased</option>'));
});
check('manifest identifies stable schema and current CoverageFit receiver', () => {
  assert.equal(manifest.build,'408-CONV-1.1'); assert.equal(manifest.handoffContract,'coveragefit-handoff-v1'); assert.ok(['CoverageFit v3.20.51','CoverageFit v3.20.52','CoverageFit v3.20.53','CoverageFit v3.20.54','CoverageFit v3.20.55','CoverageFit v3.20.56','CoverageFit v3.20.57','CoverageFit v3.20.58','CoverageFit v3.20.59','CoverageFit v3.20.60','CoverageFit v3.20.61','CoverageFit v3.20.62'].includes(manifest.receiver)); assert.equal(manifest.minimumCompatibleReceiver,'CoverageFit v3.20.13');
});
check('smoke runner uses exact CoverageFit v3.20.7 fixture assets', () => {
  assert(smoke.includes('coveragefit-v3.20.7') || read('qa/test-408-ho-1c.js').includes('coveragefit-v3.20.7'));
  assert(smoke.includes('/assets/js/attribution.js')); assert(smoke.includes('/assets/js/personalization-context.js'));
  assert(!fs.existsSync(path.join(root,'qa/fixtures/coveragefit-tx1.1')));
});
check('CoverageFit handoff is no longer blocked by Formspree delivery', () => {
  const script=read('shared/script.js');
  assert(script.includes("keepalive:true"));
  assert(script.includes("Promise.race"));
  assert(script.includes("lead_capture_status"));
  assert(script.includes("continueToCoverageFit(leadCaptureStatus)"));
  assert(script.includes("location.href=form.dataset.success||'thank-you.html'"));
});
console.log(`\n408-CONV-1.1 QA: ${checks.length}/${checks.length} passed`);
