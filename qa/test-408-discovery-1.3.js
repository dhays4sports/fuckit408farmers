'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
let assertions = 0;
const check = (condition, message) => { assertions += 1; if (!condition) throw new Error(message); };
const words = value => String(value).trim().split(/\s+/).filter(Boolean).length;

const html = read('home/index.html');
const engagement = read('shared/home-engagement.js');
const bridge = read('shared/discovery-brand-bridge-1.3.js');
const launcher = read('shared/coveragefit-launch.js');
const contract = JSON.parse(read('408-DISCOVERY-1.3_UX_CLARITY_CONTRACT.json'));

check(html.includes('Keep building your Snapshot.'), 'payoff leads with value');
check(html.includes('Next: CoverageFit. Your answers are already connected.'), 'brand bridge is concise');
check(html.includes('Continue to my Snapshot'), 'primary CTA is outcome-first');
check(words(contract.approved_copy.primary_action) <= contract.clarity_rules.primary_cta_max_words, 'primary CTA stays within word budget');
check(!/CoverageFit/.test(contract.approved_copy.primary_action), 'brand explanation stays outside the CTA');
check(!/guided review experience Dylan uses/.test(html + engagement + bridge), 'superseded long explanation is absent from active runtime');
check(html.includes('Save your first name and mobile so Dylan can recover your review if you leave.'), 'checkpoint helper explains only the payoff');
check(words(contract.approved_copy.checkpoint_helper) <= 16, 'checkpoint helper stays concise');
check(html.includes('Continue without saving'), 'anonymous continuation remains obvious');
check(html.includes('data-checkpoint-required-fields="first_name,phone,consent"'), 'minimum checkpoint remains bounded');
check(html.includes('data-ux-clarity-build="408-DISCOVERY-1.3"'), 'page declares the forward clarity contract');
check(bridge.includes("build: '408-DISCOVERY-1.3'"), 'runtime bridge is versioned');
check(!/pvx-green|#26ae60|#158a48|coveragefit-logo|coveragefit-mark/i.test(bridge + html), 'no CoverageFit reskin is introduced');
check(launcher.includes("bootstrapUrl: 'https://coveragefit.com/api/pvx/web-bootstrap'"), 'secure bootstrap endpoint remains authoritative');
check(contract.protected_boundaries.sms_permission_inferred === false, 'SMS permission remains uninferred');
check(contract.protected_boundaries.protection_score_changed === false, 'Protection Score remains unchanged');

console.log(JSON.stringify({ ok: true, build: '408-DISCOVERY-1.3', assertions }, null, 2));
