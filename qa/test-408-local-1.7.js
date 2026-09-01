const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const files = {
  index: path.join(root, 'local', 'index.html'),
  detail: path.join(root, 'local', 'detail', 'index.html'),
  join: path.join(root, 'local', 'join', 'index.html'),
  catalog: path.join(root, 'local', 'data', 'catalog.json'),
  schema: path.join(root, 'local', 'data', 'catalog.schema.json'),
  model: path.join(root, 'shared', 'local-data-model.js'),
  attribution: path.join(root, 'shared', 'local-attribution.js'),
  directory: path.join(root, 'shared', 'local-directory.js'),
  merchant: path.join(root, 'shared', 'local-merchant.js'),
  joinRuntime: path.join(root, 'shared', 'local-join.js'),
  css: path.join(root, 'shared', 'local.css'),
  leadRuntime: path.join(root, 'shared', 'script.js'),
  cfLauncher: path.join(root, 'shared', 'coveragefit-launch.js'),
  worker: path.join(root, '_worker.js'),
  contract: path.join(root, 'LOCAL1_7_BRIDGE_CONTRACT.json'),
  sprint: path.join(root, 'SPRINT-408-LOCAL-1.7.md'),
  roadmap: path.join(root, '408-LOCAL-ROADMAP.md'),
  rootRoadmap: path.join(root, 'ROADMAP.md'),
  changelog: path.join(root, 'CHANGELOG.md'),
  readme: path.join(root, 'README.txt'),
  version: path.join(root, 'VERSION'),
  release16: path.join(root, 'LOCAL1_6_RELEASE_CERTIFICATION.json')
};
for (const [name, file] of Object.entries(files)) assert(fs.existsSync(file), `missing ${name}: ${file}`);

const LocalAttribution = require(files.attribution);
const LocalMerchant = require(files.merchant);
const detailHtml = fs.readFileSync(files.detail, 'utf8');
const indexHtml = fs.readFileSync(files.index, 'utf8');
const joinHtml = fs.readFileSync(files.join, 'utf8');
const merchantSource = fs.readFileSync(files.merchant, 'utf8');
const css = fs.readFileSync(files.css, 'utf8');
const roadmap = fs.readFileSync(files.roadmap, 'utf8');
const rootRoadmap = fs.readFileSync(files.rootRoadmap, 'utf8');
const changelog = fs.readFileSync(files.changelog, 'utf8');
const readme = fs.readFileSync(files.readme, 'utf8');
const contract = JSON.parse(fs.readFileSync(files.contract, 'utf8'));
const release16 = JSON.parse(fs.readFileSync(files.release16, 'utf8'));
const catalog = JSON.parse(fs.readFileSync(files.catalog, 'utf8'));

function hashFile(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}
function storage() {
  const map = new Map();
  return {
    getItem: key => map.has(key) ? map.get(key) : null,
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: key => map.delete(key)
  };
}
const checks = [];
function check(name, condition) {
  checks.push({ name, passed: Boolean(condition) });
  assert(condition, name);
}

const merchant = {
  merchant_id: 'merchant-stevies-test',
  name: "Stevie's Test Merchant",
  slug: 'stevies-test',
  category: 'eat-drink',
  neighborhood: 'Willow Glen',
  city: 'San Jose',
  address_display: 'Willow Glen, San Jose, CA',
  description_short: 'A participating South Bay test merchant.',
  description_long: 'Fixture-like merchant content used only for renderer certification.',
  website_url: 'https://example.com',
  instagram_url: 'https://instagram.com/example',
  image: '',
  logo: '',
  status: 'active',
  featured: true,
  sort_order: 1
};
const perk = {
  perk_id: 'perk-stevies-test',
  merchant_id: merchant.merchant_id,
  headline: 'A merchant-owned test perk',
  summary: 'Show the current published perk at the participating merchant.',
  terms: 'Merchant terms apply.',
  independent_offer_text: 'No insurance purchase or quote required.',
  redemption_method: 'show_screen',
  status: 'active'
};
const activeVm = { merchant, perk, program: { merchant_relationship_text: 'Participation does not imply endorsement.' } };
const noPerkVm = { merchant, perk: null, program: activeVm.program };

const bridge = LocalMerchant.renderInsuranceBridge(activeVm);
const full = LocalMerchant.renderMerchantDetail(activeVm);
const fullNoPerk = LocalMerchant.renderMerchantDetail(noPerkVm);

check('1.7 bridge renderer is exported', typeof LocalMerchant.renderInsuranceBridge === 'function');
check('bridge renders only for merchant with active view-model perk', bridge.includes('data-local-insurance-bridge'));
check('bridge does not render when merchant perk is unavailable', LocalMerchant.renderInsuranceBridge(noPerkVm) === '');
check('full merchant detail has no bridge without active perk', !fullNoPerk.includes('data-local-insurance-bridge'));
check('bridge identifies itself as optional insurance review', /Optional insurance review/i.test(bridge));
check('bridge homeowner headline is exact', bridge.includes('Own a home in the South Bay?'));
check('bridge explicitly says insurance review is separate from perk', /insurance review is separate from the Local perk above/i.test(bridge));
check('bridge says perk is already available', /Your merchant perk is already available/i.test(bridge));
check('bridge says using or skipping review does not change offer', /Using or skipping an insurance review does not change the offer/i.test(bridge));
check('bridge repeats no quote or purchase requirement', /No obligation\. No quote or policy purchase is required to use the Local perk\./i.test(bridge));
check('bridge contains Home + Auto route', /href="\/auto-bundle\/"/.test(bridge));
check('bridge contains Home-only route', /href="\/home\/"/.test(bridge));
check('Home + Auto route uses certified attribution CTA marker', /data-local-insurance-cta="merchant_bridge_bundle"/.test(bridge));
check('Home + Auto route uses auto_bundle destination token', /data-local-insurance-destination="auto_bundle"/.test(bridge));
check('Home-only route uses certified attribution CTA marker', /data-local-insurance-cta="merchant_bridge_home"/.test(bridge));
check('Home-only route uses home destination token', /data-local-insurance-destination="home"/.test(bridge));
check('bridge contains no form', !/<form\b/i.test(bridge));
check('bridge contains no input controls', !/<(?:input|select|textarea)\b/i.test(bridge));
check('bridge contains no CoverageFit launcher', !/coveragefit|data-coveragefit-launch/i.test(bridge));
check('bridge contains no rate/savings promise', !/rates? (?:have )?dropped|save \$|save money|lower your rate|cheapest|lowest price|most competitive/i.test(bridge));

const idxPerk = full.indexOf('local-detail-perk');
const idxUse = full.indexOf('data-local-use-perk');
const idxTerms = full.indexOf('Merchant terms');
const idxIndependent = full.indexOf('No insurance purchase or quote required.');
const idxBoundary = full.indexOf('local-detail-boundary');
const idxBridge = full.indexOf('data-local-insurance-bridge');
check('merchant perk renders before bridge', idxPerk >= 0 && idxPerk < idxBridge);
check('redemption action renders before bridge', idxUse >= 0 && idxUse < idxBridge);
check('merchant terms render before bridge', idxTerms >= 0 && idxTerms < idxBridge);
check('independent-offer language renders before bridge', idxIndependent >= 0 && idxIndependent < idxBridge);
check('explicit Local/insurance boundary renders before bridge', idxBoundary >= 0 && idxBoundary < idxBridge);
check('program boundary says Local perks do not affect insurance economics', /Local perks do not affect insurance pricing, discounts, eligibility, underwriting or coverage\./.test(full));

const store = storage();
const t0 = Date.parse('2026-08-16T08:00:00Z');
LocalAttribution.capture({
  pathname: '/local/stevies-test/',
  search: '?source=local&partner_id=merchant-stevies-test&perk_id=perk-stevies-test&merchant_slug=stevies-test&surface=coaster_table&campaign=local_perks&variant=coaster_v1&utm_source=stevies&utm_medium=coaster&utm_campaign=local_perks&utm_content=coaster_v1'
}, { storage: store, now: t0 });
const bundleUrl = LocalAttribution.decorateUrl('/auto-bundle/', {}, { storage: store, origin: 'https://408farmers.com' });
const homeUrl = LocalAttribution.decorateUrl('/home/', {}, { storage: store, origin: 'https://408farmers.com' });
const bundleParsed = new URL(bundleUrl, 'https://408farmers.com');
const homeParsed = new URL(homeUrl, 'https://408farmers.com');
check('bundle bridge can carry source=local', bundleParsed.searchParams.get('source') === 'local');
check('bundle bridge can carry partner id', bundleParsed.searchParams.get('partner_id') === 'merchant-stevies-test');
check('bundle bridge can carry perk id', bundleParsed.searchParams.get('perk_id') === 'perk-stevies-test');
check('bundle bridge can carry merchant slug', bundleParsed.searchParams.get('merchant_slug') === 'stevies-test');
check('bundle bridge can carry physical surface', bundleParsed.searchParams.get('surface') === 'coaster_table');
check('bundle bridge can carry campaign/variant', bundleParsed.searchParams.get('campaign') === 'local_perks' && bundleParsed.searchParams.get('variant') === 'coaster_v1');
check('bundle bridge can carry UTM context', bundleParsed.searchParams.get('utm_medium') === 'coaster' && bundleParsed.searchParams.get('utm_source') === 'stevies');
check('home bridge can carry same Local origin', homeParsed.searchParams.get('source') === 'local' && homeParsed.searchParams.get('partner_id') === 'merchant-stevies-test');
check('attribution event set remains unchanged from 1.6', JSON.stringify(LocalAttribution.EVENT_NAMES) === JSON.stringify(['local_view','merchant_view','perk_open','perk_redeem_intent','insurance_cta_click']));
check('bridge uses existing insurance click event rather than new event', contract.attribution.event === 'insurance_cta_click' && contract.attribution.newAnalyticsEventAdded === false);

check('directory shell advances to 1.7 marker', /data-local-build="408-LOCAL-1\.7"/.test(indexHtml));
check('merchant detail shell advances to 1.7 marker', /data-local-build="408-LOCAL-1\.7"/.test(detailHtml));
check('merchant join remains independently versioned at 1.5', /data-local-build="408-LOCAL-1\.5"/.test(joinHtml));
check('directory does not add dedicated 1.7 bridge', !indexHtml.includes('data-local-insurance-bridge'));
check('detail still loads Local attribution before merchant runtime', detailHtml.indexOf('local-attribution.js') >= 0 && detailHtml.indexOf('local-attribution.js') < detailHtml.indexOf('local-merchant.js'));
check('merchant detail header keeps prominent action inside Local', /<a class="local-insurance-link" href="\/local\/">Browse Local/.test(detailHtml));
check('merchant detail header has no pre-value insurance CTA marker', !detailHtml.slice(detailHtml.indexOf('<header'), detailHtml.indexOf('</header>')).includes('data-local-insurance-cta='));
check('bridge styling exists', css.includes('/* 408-LOCAL-1.7 — optional insurance conversion bridge */') && css.includes('.local-insurance-bridge{'));
check('bridge has responsive mobile layout', /@media \(max-width:760px\)\{\.local-insurance-bridge\{grid-template-columns:1fr/.test(css));
check('bridge actions maintain at least 48px touch targets', /local-insurance-bridge-actions[\s\S]*min-height:48px/.test(css));

// 1.7 must reuse—not fork—the certified 1.6 attribution and existing insurance transport.
check('Local attribution runtime unchanged from certified 1.6', hashFile(files.attribution) === release16.sourceHashes['shared/local-attribution.js']);
check('directory runtime unchanged from certified 1.6', hashFile(files.directory) === release16.sourceHashes['shared/local-directory.js']);
check('shared insurance lead runtime unchanged from certified 1.6', hashFile(files.leadRuntime) === release16.sourceHashes['shared/script.js']);
check('CoverageFit launcher unchanged from certified 1.6', hashFile(files.cfLauncher) === release16.sourceHashes['shared/coveragefit-launch.js']);
check('Cloudflare Worker unchanged from certified 1.6', hashFile(files.worker) === release16.sourceHashes['_worker.js']);
check('merchant catalog unchanged from certified 1.6', hashFile(files.catalog) === release16.preservedCoreHashes['local/data/catalog.json']);
check('merchant catalog schema unchanged from certified 1.6', hashFile(files.schema) === release16.preservedCoreHashes['local/data/catalog.schema.json']);
check('Local data model unchanged from certified 1.6', hashFile(files.model) === release16.preservedCoreHashes['shared/local-data-model.js']);
check('merchant join page unchanged from certified 1.6', hashFile(files.join) === release16.preservedCoreHashes['local/join/index.html']);
check('merchant join runtime unchanged from certified 1.6', hashFile(files.joinRuntime) === release16.preservedCoreHashes['shared/local-join.js']);
check('all fixture merchants remain draft/non-public', catalog.merchants.length === 3 && catalog.merchants.every(m => m.fixture === true && m.status === 'draft'));
check('all fixture perks remain draft/non-public', catalog.perks.length === 3 && catalog.perks.every(p => p.fixture === true && p.status === 'draft'));

check('contract build is 1.7', contract.build === '408-LOCAL-1.7');
check('contract says merchant value first', contract.merchantValueFirst === true);
check('contract keeps merchant-detail header action inside Local', contract.merchantDetailHeaderAction === 'local_directory');
check('contract forbids insurance CTA before merchant value', contract.insuranceCtaBeforeMerchantValue === false);
check('contract placement is after perk/terms/redemption/boundary', contract.bridgePlacement === 'after_merchant_perk_terms_redemption_and_program_boundary');
check('contract requires an active perk', contract.requiresActivePerk === true);
check('contract contains exactly two certified destinations', Array.isArray(contract.destinations) && contract.destinations.length === 2);
check('contract points only to existing Home and Home + Auto routes', JSON.stringify(contract.destinations.map(d => d.path).sort()) === JSON.stringify(['/auto-bundle/','/home/'].sort()));
check('contract says no Local lead form was added', contract.leadBoundary.localLeadFormAdded === false);
check('contract says no duplicate lead capture', contract.leadBoundary.duplicateLeadCaptureAdded === false);
check('contract says existing insurance forms only', contract.leadBoundary.existingInsuranceFormsOnly === true);
check('contract says no automatic CoverageFit launch', contract.leadBoundary.automaticCoverageFitLaunch === false);
check('contract says quote not required for perk', contract.perkBoundary.quoteRequired === false);
check('contract says purchase not required for perk', contract.perkBoundary.purchaseRequired === false);
check('contract says lead submission not required for perk', contract.perkBoundary.leadSubmissionRequired === false);
check('contract says CoverageFit not required for perk', contract.perkBoundary.coverageFitRequired === false);
check('contract says insurance review cannot change perk', contract.perkBoundary.insuranceReviewChangesPerk === false);
check('contract says catalog unchanged', contract.catalogMutation === false);
check('contract says no real merchant activation', contract.realMerchantActivation === false);
check('contract locks next sprint as 1.8', contract.nextSprint === '408-LOCAL-1.8');

check('roadmap marks 1.7 complete', /408-LOCAL-1\.7 — Insurance Conversion Bridge — COMPLETE/.test(roadmap));
check('roadmap current build is 1.7', roadmap.includes('**Current Local build:** `408-LOCAL-1.7`'));
check('roadmap continuation locks 1.8', /Immediate continuation point[\s\S]*408-LOCAL-1\.8 — 408FARMERS Site Integration/.test(roadmap));
check('root roadmap marks 1.7 complete', /\[x\] 408-LOCAL-1\.7 — Insurance Conversion Bridge/.test(rootRoadmap));
check('root roadmap leaves 1.8 incomplete', /\[ \] 408-LOCAL-1\.8 — 408FARMERS Site Integration/.test(rootRoadmap));
check('CHANGELOG starts with 1.7', changelog.startsWith('# 408-LOCAL-1.7 — Insurance Conversion Bridge'));
check('README identifies 1.7 as current Local release', readme.startsWith('CURRENT LOCAL RELEASE: 408-LOCAL-1.7 — Insurance Conversion Bridge'));
check('VERSION advanced to 1.7', fs.readFileSync(files.version, 'utf8').trim() === '408-LOCAL-1.7');
check('sprint documentation is substantive', fs.statSync(files.sprint).size > 3500);

// Source-level safety assertions for the bridge implementation.
check('merchant renderer invokes bridge after program boundary', merchantSource.indexOf("'<section class=\"local-detail-boundary\"") < merchantSource.lastIndexOf('renderInsuranceBridge(viewModel)'));
check('bridge renderer explicitly requires perk', /function renderInsuranceBridge\(viewModel\)[\s\S]*!viewModel\.perk/.test(merchantSource));
check('bridge does not bind a new submit handler', !/local-insurance-bridge[\s\S]{0,1400}addEventListener\(['"]submit/.test(merchantSource));
check('existing attribution decoration still happens after merchant render', /root\.innerHTML = renderMerchantDetail\(viewModel\)[\s\S]*LocalAttribution\.decorateScope\(documentRef\)/.test(merchantSource));

const failed = checks.filter(item => !item.passed);
const result = { total: checks.length, passed: checks.length - failed.length, failed: failed.length, checks };
fs.writeFileSync(path.join(root, 'LOCAL1_7_QA.json'), JSON.stringify(result, null, 2));
console.log(`408-LOCAL-1.7 QA: ${result.passed}/${result.total} passed`);
if (failed.length) {
  for (const item of failed) console.error('FAIL', item.name);
  process.exit(1);
}
