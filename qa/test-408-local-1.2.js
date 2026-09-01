#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..');
const catalogPath = path.join(root, 'local', 'data', 'catalog.json');
const schemaPath = path.join(root, 'local', 'data', 'catalog.schema.json');
const modelPath = path.join(root, 'shared', 'local-data-model.js');
const contractPath = path.join(root, 'LOCAL1_2_DATA_CONTRACT.json');
const roadmapPath = path.join(root, '408-LOCAL-ROADMAP.md');
const sprintPath = path.join(root, 'SPRINT-408-LOCAL-1.2.md');
const release11Path = path.join(root, 'LOCAL1_1_RELEASE_CERTIFICATION.json');
const localHtmlPath = path.join(root, 'local', 'index.html');
const localCssPath = path.join(root, 'shared', 'local.css');
const workerPath = path.join(root, '_worker.js');

for (const required of [catalogPath, schemaPath, modelPath, contractPath, roadmapPath, release11Path, localHtmlPath, localCssPath, workerPath]) {
  assert(fs.existsSync(required), `missing required file: ${path.relative(root, required)}`);
}

const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
const roadmap = fs.readFileSync(roadmapPath, 'utf8');
const localHtml = fs.readFileSync(localHtmlPath, 'utf8');
const release11 = JSON.parse(fs.readFileSync(release11Path, 'utf8'));
const LocalDataModel = require(modelPath);

const checks = [];
function check(name, condition) {
  checks.push({ name, passed: Boolean(condition) });
  assert(condition, name);
}
function hashFile(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}
function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

check('catalog schema version', catalog.schema_version === '408-local-merchant-v1');
check('catalog dataset version', catalog.dataset_version === '408-LOCAL-1.2');
check('JSON Schema identifies canonical model', schema.properties.schema_version.const === '408-local-merchant-v1');
check('runtime helper identifies canonical model', LocalDataModel.SCHEMA_VERSION === '408-local-merchant-v1');
check('catalog validates with zero model errors', LocalDataModel.validateCatalog(catalog).length === 0);

const requiredMerchantFields = [
  'merchant_id','name','slug','category','neighborhood','city','address_display','description_short','description_long',
  'website_url','instagram_url','image','logo','status','featured','sort_order'
];
const requiredPerkFields = [
  'perk_id','merchant_id','headline','summary','terms','start_at','end_at','evergreen','status','redemption_method'
];
check('merchant schema contains roadmap fields', requiredMerchantFields.every((key) => schema.$defs.merchant.required.includes(key)));
check('perk schema contains roadmap fields', requiredPerkFields.every((key) => schema.$defs.perk.required.includes(key)));
check('independent-offer field is required', schema.$defs.perk.required.includes('independent_offer_text'));
check('exactly three fixture merchants', catalog.merchants.length === 3);
check('fixture merchant categories cover pilot', new Set(catalog.merchants.map((m) => m.category)).size === 3 && ['eat-drink','home','auto'].every((c) => catalog.merchants.some((m) => m.category === c)));
check('fixture merchants remain non-public draft records', catalog.merchants.every((m) => m.fixture === true && m.status === 'draft'));
check('exactly three fixture perks', catalog.perks.length === 3);
check('fixture perks remain non-public draft records', catalog.perks.every((p) => p.fixture === true && p.status === 'draft'));
check('each fixture merchant has one perk', catalog.merchants.every((m) => catalog.perks.filter((p) => p.merchant_id === m.merchant_id).length === 1));
check('every perk carries independent-offer language', catalog.perks.every((p) => p.independent_offer_text.includes('No insurance purchase or quote required.')));
check('program carries no-endorsement relationship language', /does not imply endorsement, certification, or recommendation/i.test(catalog.program.merchant_relationship_text));

const fixtureModels = LocalDataModel.getMerchantViewModels(catalog, { include_non_active: true, include_fixtures: true, now: '2026-08-16T12:00:00-07:00' });
check('all three fixtures join through one model pipeline', fixtureModels.length === 3);
check('fixture order follows sort_order', fixtureModels.map((vm) => vm.merchant.category).join(',') === 'eat-drink,home,auto');
check('draft fixture perks do not render active', fixtureModels.every((vm) => vm.perk === null));
const renderedFixtures = fixtureModels.map(LocalDataModel.renderMerchantFixtureMarkup);
check('same renderer produces all three fixture cards', renderedFixtures.length === 3 && renderedFixtures.every((html) => html.includes('class="local-model-fixture"')));
check('rendered fixture output contains each unique merchant', catalog.merchants.every((m) => renderedFixtures.some((html) => html.includes(`data-merchant-id=\"${m.merchant_id}\"`))));
check('rendered fixture output uses stable canonical merchant URLs', fixtureModels.every((vm) => vm.merchant_url === `/local/${vm.merchant.slug}/`));
check('route builder rejects unsafe slug', (() => { try { LocalDataModel.buildMerchantUrl('../bad'); return false; } catch (_) { return true; } })());

const lifecycleCatalog = clone(catalog);
lifecycleCatalog.merchants.forEach((m) => { m.status = 'active'; m.fixture = false; });
lifecycleCatalog.perks.forEach((p, i) => {
  p.status = 'active';
  p.fixture = false;
  p.evergreen = i === 0;
  p.start_at = i === 1 ? '2026-09-01T00:00:00-07:00' : null;
  p.end_at = i === 0 ? null : (i === 1 ? '2026-10-01T00:00:00-07:00' : '2026-08-01T00:00:00-07:00');
});
const lifecycleModels = LocalDataModel.getMerchantViewModels(lifecycleCatalog, { now: '2026-08-16T12:00:00-07:00' });
check('active evergreen perk is renderable', lifecycleModels.find((vm) => vm.merchant.category === 'eat-drink').perk !== null);
check('future perk is not active', lifecycleModels.find((vm) => vm.merchant.category === 'home').perk === null && lifecycleModels.find((vm) => vm.merchant.category === 'home').all_perk_states[0].state === 'scheduled');
check('expired perk is not active', lifecycleModels.find((vm) => vm.merchant.category === 'auto').perk === null && lifecycleModels.find((vm) => vm.merchant.category === 'auto').all_perk_states[0].state === 'expired');
const paused = clone(lifecycleCatalog.perks[0]); paused.status = 'paused';
check('paused perk cannot render active', LocalDataModel.resolvePerkAvailability(paused, '2026-08-16T12:00:00-07:00').is_active === false);
const inactiveMerchantCatalog = clone(lifecycleCatalog);
inactiveMerchantCatalog.merchants[0].status = 'inactive';
check('inactive merchant excluded from active view models', LocalDataModel.getMerchantViewModels(inactiveMerchantCatalog, { now: '2026-08-16T12:00:00-07:00' }).length === 2);

const badEndorsement = clone(catalog);
badEndorsement.merchants[0].description_short = 'Recommended by Farmers for South Bay households.';
check('endorsement implication rejected', LocalDataModel.validateCatalog(badEndorsement).some((e) => /endorsement/.test(e.message)));
const duplicateMerchant = clone(catalog);
duplicateMerchant.merchants[1].merchant_id = duplicateMerchant.merchants[0].merchant_id;
check('duplicate merchant IDs rejected', LocalDataModel.validateCatalog(duplicateMerchant).some((e) => e.path.endsWith('.merchant_id') && /unique/.test(e.message)));
const brokenForeignKey = clone(catalog);
brokenForeignKey.perks[0].merchant_id = 'missing-merchant';
check('orphan perk rejected', LocalDataModel.validateCatalog(brokenForeignKey).some((e) => e.path.endsWith('.merchant_id') && /existing merchant/.test(e.message)));
const missingIndependentOffer = clone(catalog);
missingIndependentOffer.perks[0].independent_offer_text = 'Merchant terms apply.';
check('perk without no-quote language rejected', LocalDataModel.validateCatalog(missingIndependentOffer).some((e) => e.path.endsWith('.independent_offer_text')));
const badUrl = clone(catalog);
badUrl.merchants[0].website_url = 'http://example.com';
check('non-https merchant URL rejected', LocalDataModel.validateCatalog(badUrl).some((e) => e.path.endsWith('.website_url')));
const invalidDates = clone(catalog);
invalidDates.perks[0].evergreen = false;
invalidDates.perks[0].end_at = null;
check('non-evergreen perk requires end date', LocalDataModel.validateCatalog(invalidDates).some((e) => e.path.endsWith('.end_at')));

check('public Local page remains foundation-only', !localHtml.includes('local-data-model.js') && !localHtml.includes('catalog.json'));
check('public Local page still has no merchant consumer form', !/<form\b/i.test(localHtml));
check('public Local page still makes no live merchant claims', localHtml.includes('merchant offers coming next'));
check('public Local HTML unchanged from 1.1', hashFile(localHtmlPath) === release11.sourceHashes['local/index.html']);
check('Local CSS unchanged from 1.1', hashFile(localCssPath) === release11.sourceHashes['shared/local.css']);
check('Worker unchanged from 1.1', hashFile(workerPath) === release11.sourceHashes['_worker.js']);

check('contract canonical merchant route', contract.canonicalMerchantRoute === '/local/{slug}/');
check('contract storage-neutral migration', contract.storageMigration.storageNeutral === true && contract.storageMigration.consumerUrlChangeRequired === false);
check('contract no insurance purchase gate', contract.boundaries.insurancePurchaseRequired === false);
check('contract no quote gate', contract.boundaries.insuranceQuoteRequired === false);
check('contract no merchant endorsement', contract.boundaries.merchantEndorsementImplied === false);
check('contract next sprint', contract.nextSprint === '408-LOCAL-1.3');
check('roadmap marks 1.2 complete', /408-LOCAL-1\.2\s+—\s+Merchant Data Model\s+—\s+COMPLETE/.test(roadmap));
check('roadmap leaves 1.3 as next directory sprint', roadmap.includes('408-LOCAL-1.3 — Merchant Discovery Directory'));

const result = {
  sprint: '408-LOCAL-1.2',
  total: checks.length,
  passed: checks.filter((c) => c.passed).length,
  failed: checks.filter((c) => !c.passed).length,
  checks
};
fs.writeFileSync(path.join(root, 'LOCAL1_2_QA.json'), JSON.stringify(result, null, 2) + '\n');
console.log(`408-LOCAL-1.2 QA: ${result.passed}/${result.total} passed`);
