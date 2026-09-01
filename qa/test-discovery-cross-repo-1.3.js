'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const senderRoot = path.resolve(__dirname, '..');
const receiverRoot = path.resolve(process.env.COVERAGEFIT_ROOT || path.join(senderRoot, '..', 'CoverageFit_v3.20.208'));
const read = (root, file) => fs.readFileSync(path.join(root, file), 'utf8');
const sha256 = (root, file) => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');
let assertions = 0;
const check = (condition, message) => { assertions += 1; if (!condition) throw new Error(message); };

const sender = JSON.parse(read(senderRoot, '408-DISCOVERY-1.3_UX_CLARITY_CONTRACT.json'));
const receiver = JSON.parse(read(receiverRoot, 'CF-DISCOVERY-1.3_UX_CLARITY_CONTRACT.json'));
const senderPage = read(senderRoot, 'home/index.html');
const senderBridge = read(senderRoot, 'shared/discovery-brand-bridge-1.3.js');
const launcher = read(senderRoot, 'shared/coveragefit-launch.js');
const receiverOpening = read(receiverRoot, 'pvx/web/index.html');
const receiverDiscovery = read(receiverRoot, 'pvx/discovery/index.html');
const receiverRuntime = read(receiverRoot, 'assets/js/pvx-discovery.js');

check(sender.receiver === 'CoverageFit v3.20.208 / CF-DISCOVERY-1.3', 'sender targets the certified receiver');
check(receiver.release === 'CoverageFit v3.20.208' && receiver.build === 'CF-DISCOVERY-1.3', 'receiver release and build are synchronized');
check(senderPage.includes(sender.approved_copy.payoff_title), '408 payoff uses certified copy');
check(senderPage.includes(sender.approved_copy.primary_action), '408 primary action uses certified copy');
check(senderBridge.includes(sender.approved_copy.bridge), 'forward runtime preserves the concise brand bridge');
check(receiverOpening.includes(receiver.approved_copy.secure_connection), 'secure opening confirms the agency relationship');
check(receiverOpening.includes(receiver.approved_copy.secure_title), 'secure opening states one obvious purpose');
check(receiverDiscovery.includes(receiver.approved_copy.completion_title), 'discovery completion names the outcome');
check(receiverDiscovery.includes(receiver.approved_copy.primary_completion_action), 'completion primary action is outcome-first');
check(receiver.approved_copy.carried_copy_pattern.includes('quick questions left') && receiverRuntime.includes("'question' : 'questions'"), 'receiver expresses remaining work plainly for singular and plural counts');
check(receiverRuntime.includes('repeatedQuestions: 0'), 'receiver certifies zero repeated discovery questions');
check(launcher.includes("bootstrapUrl: 'https://coveragefit.com/api/pvx/web-bootstrap'"), 'secure POST receiver endpoint remains authoritative');
check(!/coveragefit-logo|coveragefit-mark/i.test(senderPage), 'CoverageFit visual identity is not duplicated on the acquisition page');
check(!/408farmers-logo|farmers-logo/i.test(receiverOpening + receiverDiscovery), '408 or Farmers visual identity is not duplicated in CoverageFit');
check(sender.protected_boundaries.sms_permission_inferred === false && receiver.protected_boundaries.automated_sms_permission_inferred === false, 'SMS permission remains uninferred across the handoff');
check(sender.protected_boundaries.professional_eligibility_inferred === false && receiver.protected_boundaries.professional_eligibility_inferred === false, 'professional eligibility remains uninferred');
check(sender.protected_boundaries.protection_score_changed === false && receiver.protected_boundaries.protection_score_changed === false, 'Protection Score remains unchanged');
check(sender.protected_boundaries.bind_authority === false && receiver.protected_boundaries.bind_authority === false, 'no bind authority is introduced');
for (const [file, expected] of Object.entries(receiver.reference_surface.protected_hashes)) {
  check(sha256(receiverRoot, file) === expected, `${file} remains byte-for-byte protected`);
}

console.log(JSON.stringify({ ok: true, build: 'DISCOVERY-1.3', assertions }, null, 2));
