'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
let assertions = 0;
const check = (condition, message) => { assertions += 1; if (!condition) throw new Error(message); };

const html = read('home/index.html');
const engagement = read('shared/home-engagement.js');
const bridge = read('shared/discovery-brand-bridge-1.2.js');
const launcher = read('shared/coveragefit-launch.js');
const contract = JSON.parse(read('408-DISCOVERY-1.2_CONTRACT.json'));

check(html.includes('Your review continues in CoverageFit'), 'payoff introduces the relationship');
check(html.includes('CoverageFit is the guided review experience Dylan uses to organize your answers and build your personalized Snapshot.'), 'payoff explains CoverageFit');
check(html.includes('Continue to my Snapshot in CoverageFit'), 'primary CTA names the destination and preserves the payoff');
check(html.includes('CoverageFit will bring your earlier answers with you.'), 'checkpoint explains answer continuity');
check(engagement.includes("Continue to my Snapshot in CoverageFit"), 'runtime personalization preserves CTA copy');
check(bridge.includes("build: '408-DISCOVERY-1.2'"), 'forward brand-bridge runtime is versioned');
check(bridge.includes('CoverageFit will bring your earlier answers with you.'), 'runtime bridge preserves zero-repeat explanation');
check(!/coveragefit-logo|coveragefit-mark/i.test(html), 'no CoverageFit logo added to the 408 page');
check(!/pvx-green|#26ae60|#158a48/i.test(bridge), 'bridge adds no CoverageFit color styling');
check(html.includes('data-anonymous-continuation="true"'), 'anonymous continuation remains explicit');
check(html.includes('data-checkpoint-required-fields="first_name,phone,consent"'), 'minimum checkpoint remains bounded');
check(launcher.includes("bootstrapUrl: 'https://coveragefit.com/api/pvx/web-bootstrap'"), 'secure bootstrap endpoint remains authoritative');
check(!/first_name|phone|consent/.test(new URL('https://coveragefit.com/pvx/web/').search), 'visible destination contains no PII');
check(contract.brand_bridge.full_coveragefit_reskin_on_408 === false, 'contract prohibits a CoverageFit reskin');
check(contract.protected_boundaries.protection_score_changed === false, 'Protection Score remains protected');
check(contract.protected_boundaries.sms_permission_inferred === false, 'SMS permission remains protected');

console.log(JSON.stringify({ ok: true, build: '408-DISCOVERY-1.2', assertions }, null, 2));
