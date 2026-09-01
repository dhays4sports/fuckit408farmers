'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.resolve(__dirname, '..');
const rel = p => path.join(root,p);
const read = p => fs.readFileSync(rel(p),'utf8');
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(rel(p))).digest('hex');
const Model = require(rel('shared/local-data-model.js'));
const Merchant = require(rel('shared/local-merchant.js'));
const Directory = require(rel('shared/local-directory.js'));
const catalog = JSON.parse(read('local/data/catalog.json'));
const release19 = JSON.parse(read('LOCAL1_9_RELEASE_CERTIFICATION.json'));
const contract = JSON.parse(read('LOCAL1_10_CONVERSION_COMPLIANCE_CONTRACT.json'));
const launch = JSON.parse(read('local/pilot/pilot-launch.json'));
const qrManifest = JSON.parse(read('local/pilot/stevies-qr-campaigns.json'));
const checks=[];
function check(name,cond){checks.push({name,passed:Boolean(cond)}); assert(cond,name);}

// Required certification artifacts.
[
 'SPRINT-408-LOCAL-1.10.md','LOCAL1_10_CONVERSION_COMPLIANCE_CONTRACT.json',
 'LOCAL1_10_COMPLIANCE_PREFLIGHT.md','LOCAL1_10_EXTERNAL_CLOSEOUT.md'
].forEach(p=>check(`required ${p}`,fs.existsSync(rel(p))));

// Certification state is honest about the current one-merchant pilot.
check('contract identifies 1.10',contract.build==='408-LOCAL-1.10');
check('technical source certification passes',contract.technical_source_certification==='pass');
check('production activation is NO-GO',contract.production_activation==='no_go');
check('three merchant target preserved',contract.pilot.target_merchants===3);
check('only one active real merchant claimed',contract.pilot.active_real_merchants===1);
check('Auto and Home remain remaining slots',contract.pilot.remaining_slots.includes('auto') && contract.pilot.remaining_slots.includes('home'));
check('Generation 2 remains blocked',contract.generation2Blocked===true);

// Catalog/model validation and actual public state.
check('catalog validates',Model.validateCatalog(catalog).length===0);
const realMerchants=catalog.merchants.filter(m=>m.fixture!==true);
const realPerks=catalog.perks.filter(p=>p.fixture!==true);
check('exactly one real merchant exists',realMerchants.length===1);
check('Stevies is active',realMerchants[0].merchant_id==='stevies-bar-grill-sj' && realMerchants[0].status==='active');
check('exactly one real perk exists',realPerks.length===1);
check('Stevies perk is active',realPerks[0].perk_id==='stevies-food-na-20' && realPerks[0].status==='active');
check('Stevies perk independent offer sentence',realPerks[0].independent_offer_text.includes('No insurance purchase or quote required.'));
check('Stevies terms repeat independence',realPerks[0].terms.includes('No insurance purchase or quote required.'));
check('Stevies redemption remains show-screen',realPerks[0].redemption_method==='show_screen');

// Lifecycle matrix: public merchant visibility must fail closed.
function clone(v){return JSON.parse(JSON.stringify(v));}
function publicVM(c, now='2026-08-16T12:00:00Z'){return Model.getMerchantViewModels(c,{now:new Date(now)});}
for (const status of ['draft','paused','inactive']) {
  const c=clone(catalog); c.merchants.find(m=>m.merchant_id==='stevies-bar-grill-sj').status=status;
  check(`merchant ${status} is hidden`,publicVM(c).length===0);
}
{
  const c=clone(catalog); c.merchants.find(m=>m.merchant_id==='stevies-bar-grill-sj').fixture=true;
  check('fixture merchant is hidden',publicVM(c).length===0);
}

// Offer timing matrix: merchant may remain discoverable, but perk/redeem must disappear when not active.
for (const status of ['draft','paused','inactive']) {
  const c=clone(catalog); c.perks.find(p=>p.perk_id==='stevies-food-na-20').status=status;
  const vm=publicVM(c)[0];
  check(`perk ${status} is not active`,vm && vm.perk===null);
  check(`perk ${status} has no redemption button`,!Merchant.renderMerchantDetail(Merchant.getMerchantDetailViewModel(c,'stevies-bar-grill',new Date('2026-08-16T12:00:00Z'))).includes('Use This Perk'));
}
{
  const c=clone(catalog), p=c.perks.find(p=>p.perk_id==='stevies-food-na-20');
  p.evergreen=false; p.start_at='2026-09-01T00:00:00Z'; p.end_at='2026-10-01T00:00:00Z';
  const vm=publicVM(c)[0];
  check('scheduled perk is not active before start',vm.perk===null && vm.all_perk_states.some(x=>x.state==='scheduled'));
}
{
  const c=clone(catalog), p=c.perks.find(p=>p.perk_id==='stevies-food-na-20');
  p.evergreen=false; p.start_at='2026-07-01T00:00:00Z'; p.end_at='2026-08-01T00:00:00Z';
  const vm=publicVM(c)[0];
  check('expired perk is not active after end',vm.perk===null && vm.all_perk_states.some(x=>x.state==='expired'));
}
{
  const c=clone(catalog), p=c.perks.find(p=>p.perk_id==='stevies-food-na-20');
  p.evergreen=false; p.start_at='2026-08-01T00:00:00Z'; p.end_at='2026-09-01T00:00:00Z';
  const vm=publicVM(c)[0];
  check('in-window dated perk is active',vm.perk && vm.perk.perk_id==='stevies-food-na-20');
}

// Current public rendering.
const vms=publicVM(catalog);
check('public directory exposes only Stevies',vms.length===1 && vms[0].merchant.merchant_id==='stevies-bar-grill-sj');
const dir=Directory.renderDirectory(vms,'all');
check('directory contains merchant',dir.includes('Stevie&#39;s Bar &amp; Grill'));
check('directory contains active perk',dir.includes('20% off food + non-alcoholic drinks'));
const detailVM=Merchant.getMerchantDetailViewModel(catalog,'stevies-bar-grill',new Date('2026-08-16T12:00:00Z'));
const detail=Merchant.renderMerchantDetail(detailVM);
check('detail contains redemption action',detail.includes('Use This Perk'));
check('detail states no quote/purchase requirement',detail.includes('No insurance purchase or quote required.'));
check('detail includes post-value insurance bridge',detail.includes('local-insurance-bridge'));
check('bridge says perk already available',detail.includes('Your merchant perk is already available.'));
check('bridge says insurance does not change perk',detail.includes('Using or skipping an insurance review does not change the offer'));
check('bridge offers existing home route',detail.includes('href="/home/"'));
check('bridge offers existing bundle route',detail.includes('href="/auto-bundle/"'));

// Public boundary and no policyholder-only gate.
const publicFiles=['local/index.html','local/detail/index.html','local/join/index.html','local/join/thank-you.html'];
for (const f of publicFiles) {
  const html=read(f);
  check(`${f}:contains agency license`,html.includes('CA License #4528400'));
  check(`${f}:does not claim policyholder-only access`,!/policyholders?\s+only|customers?\s+only|Farmers customers? only/i.test(html));
}
check('Local directory explicitly says no insurance purchase',read('local/index.html').includes('No insurance purchase required.'));
check('Local directory explicitly says no quote required',read('local/index.html').includes('No quote required.'));
check('Local directory explicitly says no pricing/eligibility effect',read('local/index.html').includes('No effect on insurance pricing or eligibility.'));
check('program relationship text disclaims endorsement',catalog.program.merchant_relationship_text.includes('does not imply endorsement, certification, or recommendation'));

// Printable placard compliance safeguard.
const placard=read('local/assets/pilot/stevies/stevies-local-perk-placard.svg');
check('placard contains exact active offer',placard.includes('20% off food + non-alcoholic drinks'));
check('placard contains no insurance gate',placard.includes('No insurance purchase or quote required.'));
check('placard says Local is not insurance discount program',placard.includes('not an insurance discount program'));
check('placard includes agency name disclosure',placard.includes('Virginia Tam Insurance Agency, Inc.'));
check('placard includes CA license disclosure',placard.includes('CA License #4528400'));

// QR routing/attribution contract.
check('Stevies QR manifest has three surfaces',qrManifest.campaigns.length===3);
const expectedSurfaces=new Set(['merchant_table','merchant_counter','merchant_placard']);
for (const c of qrManifest.campaigns) {
  const u=new URL(c.url);
  check(`${c.surface}:known surface`,expectedSurfaces.has(c.surface));
  check(`${c.surface}:https host`,u.protocol==='https:' && u.hostname==='408farmers.com');
  check(`${c.surface}:canonical path`,u.pathname==='/local/stevies-bar-grill/');
  check(`${c.surface}:source local`,u.searchParams.get('source')==='local');
  check(`${c.surface}:partner`,u.searchParams.get('partner_id')==='stevies-bar-grill-sj');
  check(`${c.surface}:perk`,u.searchParams.get('perk_id')==='stevies-food-na-20');
  check(`${c.surface}:slug`,u.searchParams.get('merchant_slug')==='stevies-bar-grill');
  check(`${c.surface}:surface`,u.searchParams.get('surface')===c.surface);
  check(`${c.surface}:PNG exists`,fs.existsSync(rel(c.png.replace(/^\//,''))));
  check(`${c.surface}:SVG exists`,fs.existsSync(rel(c.svg.replace(/^\//,''))));
}

// Privacy-safe telemetry source boundary.
const worker=read('_worker.js');
check('Local event endpoint remains same-origin worker path',worker.includes("const LOCAL_EVENT_PATH = '/api/local/event'"));
check('Local event names remain exactly bounded',worker.includes("new Set(['local_view','merchant_view','perk_open','perk_redeem_intent','insurance_cta_click'])"));
check('event schema does not store name field',!/CREATE TABLE IF NOT EXISTS local_attribution_events[\s\S]*\bname\s+TEXT\b/.test(worker));
check('event schema does not store email field',!/CREATE TABLE IF NOT EXISTS local_attribution_events[\s\S]*\bemail\s+TEXT\b/.test(worker));
check('event schema does not store phone field',!/CREATE TABLE IF NOT EXISTS local_attribution_events[\s\S]*\bphone\s+TEXT\b/.test(worker));
check('event schema does not store street address field',!/CREATE TABLE IF NOT EXISTS local_attribution_events[\s\S]*\baddress\s+TEXT\b/.test(worker));
check('Local event context exact-key allowlist exists',worker.includes("if (!exactKeys(payload.context, contextKeys)) return null;"));
check('event route is restricted to Local paths',worker.includes("/^\\/local\\/[a-z0-9]+(?:-[a-z0-9]+)*\\/?$/"));

// Attribution implementation still uses bounded storage and does not introduce identity keys.
const attr=read('shared/local-attribution.js');
check('attribution storage key unchanged',attr.includes("const STORAGE_KEY = '408farmers_local_attribution_v1'"));
check('attribution uses 30-day first touch',/30\s*\*\s*24\s*\*\s*60\s*\*\s*60\s*\*\s*1000/.test(attr));
for(const pii of ['first_name','last_name','email','phone','address','property_address']) check(`attribution source excludes ${pii}`,!new RegExp(`['\"]${pii}['\"]`).test(attr));

// Preservation: all core 1.9 runtime files remain byte-identical to the 1.9 certified source.
for (const [file,expected] of Object.entries(release19.preservedCoreHashes || {})) {
  check(`${file}:core hash preserved from 1.9`,hash(file)===expected);
}
for (const file of ['local/data/catalog.json','local/index.html','local/detail/index.html','local/pilot/pilot-launch.json','local/pilot/stevies-qr-campaigns.json']) {
  check(`${file}:1.9 source preserved`,hash(file)===release19.sourceHashes[file]);
}

// Homepage internet-advertising disclosure preflight.
const homepage=read('index.html');
check('homepage names Dylan Haysbert',homepage.includes('Dylan Haysbert'));
check('homepage names Virginia Tam Insurance Agency',homepage.includes('Virginia Tam Insurance Agency'));
check('homepage contains CA license number',homepage.includes('CA License #4528400'));
check('homepage contains California principal-place context',homepage.includes('Fremont, CA 94539'));
check('homepage contains word insurance',/insurance/i.test(homepage));

// Documentation/status consistency.
check('VERSION identifies 1.10 NO-GO certification',read('VERSION').trim()==='408-LOCAL-1.10-CERTIFIED-NO-GO');
check('README identifies current 1.10 certification',read('README.txt').startsWith('CURRENT LOCAL CERTIFICATION: 408-LOCAL-1.10'));
check('CHANGELOG starts with 1.10',read('CHANGELOG.md').startsWith('# 408-LOCAL-1.10 — Conversion + Compliance Certification'));
check('roadmap marks 1.10 complete with no-go finding',/408-LOCAL-1\.10 — Conversion \+ Compliance Certification — COMPLETE \(NO-GO FINDING\)/.test(read('408-LOCAL-ROADMAP.md')));
check('roadmap blocks Local 2.x',read('408-LOCAL-ROADMAP.md').includes('Do not start 408-LOCAL-2.x until a 1.10 GO closeout is recorded.'));
check('external checklist includes carrier review',read('LOCAL1_10_EXTERNAL_CLOSEOUT.md').includes('agency/Farmers advertising-compliance process'));
check('preflight says not legal opinion',read('LOCAL1_10_COMPLIANCE_PREFLIGHT.md').includes('Not a legal opinion'));
check('contract does not claim internal carrier approval',contract.compliance_preflight.carrierInternalApprovalClaimed===false);

// 1.9 launch manifest remains honest.
check('launch manifest target is three',launch.target_merchants===3);
check('launch manifest reports one active',launch.public_merchants_active===1);
check('Auto remains pending recruitment',launch.slots.find(s=>s.slot==='auto').status==='pending_recruitment');
check('Home remains pending recruitment',launch.slots.find(s=>s.slot==='home').status==='pending_recruitment');

const failed=checks.filter(c=>!c.passed);
const result={sprint:'408-LOCAL-1.10',total:checks.length,passed:checks.length-failed.length,failed:failed.length,checks};
fs.writeFileSync(rel('LOCAL1_10_QA.json'),JSON.stringify(result,null,2)+'\n');
console.log(`408-LOCAL-1.10 QA: ${result.passed}/${result.total} passed`);
if(failed.length) process.exit(1);
