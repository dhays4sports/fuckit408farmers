const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'handoff-manifest.json'), 'utf8'));
const checks = [];
function check(name, condition) { if (!condition) throw new Error(`FAIL: ${name}`); checks.push(name); }
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }

check('public runtime remains the buyer release', ['408-BUY-1.1','408-BUY-1.2','408-BUY-1.3','408-BUY-1.4','408-BUY-1.5','408-BUY-1.4','408-BUY-1.5','408-BUY-1.4','408-BUY-1.4','408-BUY-1.5','408-CRO-1.1','408-CRO-1.2','408-CRO-1.3','408-CRO-1.4', '408-CRO-1.5', '408-CRO-1.6', '408-CRO-1.6.1', '408-CRO-1.6.2', '408-CRO-1.6.2.1','408-LIFE-1.1','408-LIFE-1.2','408-LIFE-1.3','408-LIFE-1.4','408-LIFE-1.4.1','408-LIFE-1.5','408-LIFE-1.6','408-LIFE-1.7','408-FLOW-1.5','408-HOME-2.1','408-HOME-2.2','408-HOME-2.3','408-HOME-2.4','408-HOME-2.5','408-HOME-2.6','408-HOME-2.7','408-HOME-2.8','408-HOME-2.9','408-FLOW-2.1','408-FLOW-2.2','408-FLOW-2.3','408-FLOW-2.4','408-CF-RPT-1.1','408-FLOW-2.5'].includes(read('VERSION').trim()));
check('manifest remains compatible after RC-SMS-1.4', ['RC-SMS-1.4','RC-SMS-1.5','RC-SMS-1.6','RC-SMS-1.7','RC-SMS-1.8','RC-SMS-1.9','RC-SMS-1.9.1'].includes(manifest.smsSimulator?.build) && ['CoverageFit v3.20.22','CoverageFit v3.20.23','CoverageFit v3.20.24','CoverageFit v3.20.25','CoverageFit v3.20.26','CoverageFit v3.20.27','CoverageFit v3.20.54','CoverageFit v3.20.55','CoverageFit v3.20.56','CoverageFit v3.20.57','CoverageFit v3.20.58','CoverageFit v3.20.59','CoverageFit v3.20.60','CoverageFit v3.20.61','CoverageFit v3.20.62'].includes(manifest.smsSimulator?.receiver));
check('manifest records complete homebuyer intake', manifest.smsSimulator?.homebuyerIntake === true && ['property_address','closing_date','occupancy','auto_review','priority'].every(value => manifest.smsSimulator?.buyerFields?.includes(value)));
check('manifest records RUSH control and bounded policy', manifest.smsSimulator?.supportedCommands?.includes('RUSH') && /operational priority/i.test(manifest.smsSimulator?.rushPolicy || '') && /no coverage/i.test(manifest.smsSimulator?.rushPolicy || ''));
check('manifest defers personalized CoverageFit continuation', /RC-SMS-1.5/.test(manifest.smsSimulator?.coverageFitContinuation || ''));
check('public runtime changed flag remains false', manifest.smsSimulator?.publicRuntimeChanged === false);
check('public buyer scripts contain no RingCentral credentials', !read('shared/buyer-flow.js').includes('RINGCENTRAL_CLIENT_SECRET') && !read('shared/buyer-referral.js').includes('RINGCENTRAL_JWT_TOKEN'));
check('sprint documentation records the protected boundary and buyer fields', ['public 408farmers','coveragefit','address','closing date','occupancy','auto','rush','no ringcentral'].every(term => read('SPRINT-408-RC-SMS-1.4.md').toLowerCase().includes(term)));
check('changelog records RC-SMS-1.4 synchronization', read('CHANGELOG.md').includes('## RC-SMS-1.4 — Complete Homebuyer SMS Intake Synchronization'));
console.log(JSON.stringify({ sprint: '408-RC-SMS-1.4', passed: checks.length, failed: 0, checks }, null, 2));
