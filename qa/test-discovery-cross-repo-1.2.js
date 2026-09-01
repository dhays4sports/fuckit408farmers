'use strict';
const fs = require('fs');
const path = require('path');
const senderRoot = path.resolve(__dirname, '..');
const receiverRoot = path.resolve(process.env.COVERAGEFIT_ROOT || path.join(senderRoot, '..', 'CoverageFit_v3.20.207'));
const read = (root, file) => fs.readFileSync(path.join(root, file), 'utf8');
let assertions = 0;
const check = (condition, message) => { assertions += 1; if (!condition) throw new Error(message); };

const sender = JSON.parse(read(senderRoot, '408-DISCOVERY-1.2_CONTRACT.json'));
const receiver = JSON.parse(read(receiverRoot, 'CF-DISCOVERY-1.2_CONTRACT.json'));
const senderPage = read(senderRoot, 'home/index.html');
const receiverOpening = read(receiverRoot, 'pvx/web/index.html');
const receiverDiscovery = read(receiverRoot, 'pvx/discovery/index.html');
const receiverRuntime = read(receiverRoot, 'assets/js/pvx-discovery.js');
const launcher = read(senderRoot, 'shared/coveragefit-launch.js');

check(sender.receiver === 'CoverageFit v3.20.207', 'sender targets the certified receiver');
check(receiver.build === 'CF-DISCOVERY-1.2', 'receiver brand-bridge build is synchronized');
check(senderPage.includes('Your review continues in CoverageFit'), 'sender introduces CoverageFit at the handoff');
check(senderPage.includes('Continue to my Snapshot in CoverageFit'), 'sender preserves Snapshot payoff and names the destination');
check(receiverOpening.includes('Virginia Tam Insurance Agency → CoverageFit'), 'secure opening confirms the agency relationship');
check(receiverDiscovery.includes('Connected from Virginia Tam Insurance Agency.'), 'discovery confirms the source relationship');
check(receiverRuntime.includes('so you won’t have to start over'), 'receiver explains carried-answer continuity');
check(receiverRuntime.includes('continuity.hidden = carriedCount === 0'), 'receiver does not fabricate continuity for direct entry');
check(launcher.includes("bootstrapUrl: 'https://coveragefit.com/api/pvx/web-bootstrap'"), 'secure POST receiver endpoint remains authoritative');
check(!/coveragefit-logo|coveragefit-mark/i.test(senderPage), 'CoverageFit visual identity is not duplicated in the sender header');
check(!/408farmers-logo|farmers-logo/i.test(receiverOpening + receiverDiscovery), '408 or Farmers visual identity is not duplicated in CoverageFit');
check(sender.handoff_guardrails.pii_in_visible_url === false && receiver.security_and_semantic_boundaries.pii_in_visible_url === false, 'both contracts prohibit PII in visible URLs');
check(sender.protected_boundaries.sms_permission_inferred === false && receiver.security_and_semantic_boundaries.automated_sms_permission_inferred === false, 'SMS permission remains uninferred across the handoff');
check(sender.protected_boundaries.protection_score_changed === false && receiver.security_and_semantic_boundaries.protection_score_changed === false, 'Protection Score remains unchanged across the handoff');

console.log(JSON.stringify({ ok: true, build: 'DISCOVERY-1.2', assertions }, null, 2));
