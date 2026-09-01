const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const files = {
  html: path.join(root, 'local', 'index.html'),
  css: path.join(root, 'shared', 'local.css'),
  catalog: path.join(root, 'local', 'data', 'catalog.json'),
  model: path.join(root, 'shared', 'local-data-model.js'),
  directory: path.join(root, 'shared', 'local-directory.js'),
  contract: path.join(root, 'LOCAL1_3_DIRECTORY_CONTRACT.json'),
  roadmap: path.join(root, '408-LOCAL-ROADMAP.md'),
  sprint: path.join(root, 'SPRINT-408-LOCAL-1.3.md'),
  release12: path.join(root, 'LOCAL1_2_RELEASE_CERTIFICATION.json'),
  worker: path.join(root, '_worker.js')
};
for (const [key, file] of Object.entries(files)) assert(fs.existsSync(file), `missing ${key}: ${path.relative(root, file)}`);

const html = fs.readFileSync(files.html, 'utf8');
const css = fs.readFileSync(files.css, 'utf8');
const catalog = JSON.parse(fs.readFileSync(files.catalog, 'utf8'));
const contract = JSON.parse(fs.readFileSync(files.contract, 'utf8'));
const roadmap = fs.readFileSync(files.roadmap, 'utf8');
const release12 = JSON.parse(fs.readFileSync(files.release12, 'utf8'));
const LocalDataModel = require(files.model);
const LocalDirectory = require(files.directory);

function hashFile(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}
function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
const checks = [];
function check(name, condition) {
  checks.push({ name, passed: Boolean(condition) });
  assert(condition, name);
}

check('public Local build marker advanced to 1.3', /data-local-build="408-LOCAL-1\.3"/.test(html));
check('public page loads validated Local data model', html.includes('../shared/local-data-model.js'));
check('public page loads directory runtime after data model', html.indexOf('../shared/local-data-model.js') < html.indexOf('../shared/local-directory.js'));
check('directory runtime source exists', fs.statSync(files.directory).size > 1000);
check('public directory section exists', /id="directory"[^>]*data-local-directory/.test(html));
check('directory has All filter', /data-local-filter="all"/.test(html));
check('directory has Eat Drink filter', /data-local-filter="eat-drink"/.test(html));
check('directory has Home filter', /data-local-filter="home"/.test(html));
check('directory has Auto filter', /data-local-filter="auto"/.test(html));
check('directory has accessible live status', /data-local-directory-status[^>]*aria-live="polite"/.test(html));
check('directory grid exposes busy state', /data-local-directory-grid[^>]*aria-busy="true"/.test(html));
check('public Local page remains login-free', !/href="\/(?:login|signin|account)\/?"/i.test(html) && !/type="password"/i.test(html));
check('public Local page remains consumer-form-free', !/<form\b/i.test(html));
check('public page carries no fixture merchant names', catalog.merchants.every((m) => !html.includes(m.name)));
check('public page preserves no-purchase boundary', html.includes('No insurance purchase required'));
check('public page preserves no-quote boundary', html.includes('No quote required'));
check('hero announces directory state without claiming live offers', html.includes('Directory live · pilot merchants being added'));
check('mobile filter controls retain 44px target', /\.local-filter\{[^}]*min-height:44px/.test(css));
check('mobile category control is horizontally scrollable', /\.local-filter-scroll\{[^}]*overflow-x:auto/.test(css));
check('directory has single-column mobile grid', /@media\(max-width:720px\)[\s\S]*\.local-directory-grid\{grid-template-columns:1fr/.test(css));
check('reduced motion disables filter movement and shimmer', /prefers-reduced-motion:reduce[\s\S]*local-directory-loading span\{animation:none/.test(css));

check('1.2 catalog remains valid', LocalDataModel.validateCatalog(catalog).length === 0);
check('1.2 catalog version remains unchanged', catalog.dataset_version === '408-LOCAL-1.2');
check('1.2 data model source unchanged', hashFile(files.model) === release12.sourceHashes['shared/local-data-model.js']);
check('Cloudflare worker unchanged from 1.2', hashFile(files.worker) === release12.preservedPublicHashes['_worker.js']);
check('all production catalog merchants remain draft fixtures', catalog.merchants.length === 3 && catalog.merchants.every((m) => m.fixture === true && m.status === 'draft'));
check('all production catalog perks remain draft fixtures', catalog.perks.length === 3 && catalog.perks.every((p) => p.fixture === true && p.status === 'draft'));
check('production directory view models expose no fixtures', LocalDirectory.getDirectoryViewModels(catalog, { now: '2026-08-16T12:00:00-07:00' }).length === 0);
const productionEmpty = LocalDirectory.renderDirectory([], 'all');
check('production empty state is useful', /directory is ready for the pilot/i.test(productionEmpty) && /Draft, paused and inactive merchants stay hidden/i.test(productionEmpty));

const active = clone(catalog);
active.merchants.forEach((m) => { m.fixture = false; m.status = 'active'; });
active.perks.forEach((p) => { p.fixture = false; });
// Eat & Drink: active/current evergreen.
active.perks[0].status = 'active';
active.perks[0].evergreen = true;
active.perks[0].start_at = null;
active.perks[0].end_at = null;
// Home: merchant active, perk paused.
active.perks[1].status = 'paused';
active.perks[1].evergreen = true;
active.perks[1].start_at = null;
active.perks[1].end_at = null;
// Auto: merchant active, perk lifecycle expired.
active.perks[2].status = 'active';
active.perks[2].evergreen = false;
active.perks[2].start_at = '2026-07-01T00:00:00-07:00';
active.perks[2].end_at = '2026-08-01T00:00:00-07:00';
// Make Auto featured too, but later sort_order than Eat & Drink.
active.merchants[2].featured = true;
check('active QA catalog validates', LocalDataModel.validateCatalog(active).length === 0);
const vms = LocalDirectory.getDirectoryViewModels(active, { now: '2026-08-16T12:00:00-07:00' });
check('all three active non-fixture merchants render into directory models', vms.length === 3);
check('featured merchants sort first', vms[0].merchant.featured === true && vms[1].merchant.featured === true && vms[2].merchant.featured === false);
check('sort_order still orders featured merchants', vms[0].merchant.category === 'eat-drink' && vms[1].merchant.category === 'auto');
check('current active perk resolves only for Eat Drink', Boolean(vms.find((vm) => vm.merchant.category === 'eat-drink').perk));
check('paused Home perk is not rendered current', vms.find((vm) => vm.merchant.category === 'home').perk === null);
check('expired Auto perk is not rendered current', vms.find((vm) => vm.merchant.category === 'auto').perk === null);
check('paused merchant offer lifecycle is retained for diagnostics', vms.find((vm) => vm.merchant.category === 'home').all_perk_states[0].state === 'paused');
check('expired merchant offer lifecycle is retained for diagnostics', vms.find((vm) => vm.merchant.category === 'auto').all_perk_states[0].state === 'expired');
check('All filter returns all merchants', LocalDirectory.filterViewModels(vms, 'all').length === 3);
check('Eat Drink filter returns one merchant', LocalDirectory.filterViewModels(vms, 'eat-drink').length === 1);
check('Home filter returns one merchant', LocalDirectory.filterViewModels(vms, 'home').length === 1);
check('Auto filter returns one merchant', LocalDirectory.filterViewModels(vms, 'auto').length === 1);
check('unknown filter safely falls back to All', LocalDirectory.filterViewModels(vms, 'not-a-category').length === 3);

const activeMarkup = LocalDirectory.renderMerchantCard(vms.find((vm) => vm.merchant.category === 'eat-drink'));
const pausedMarkup = LocalDirectory.renderMerchantCard(vms.find((vm) => vm.merchant.category === 'home'));
check('merchant card renders neighborhood', activeMarkup.includes('Willow Glen'));
check('merchant card renders featured state', activeMarkup.includes('local-featured-badge'));
check('merchant card renders current perk label', activeMarkup.includes('Current Local perk'));
check('merchant card carries independent-offer language inside details', activeMarkup.includes('No insurance purchase or quote required.'));
check('merchant card uses inline discovery disclosure', activeMarkup.includes('<details class="local-merchant-disclosure">'));
check('merchant card does not preempt 1.4 redemption action', !/Use This Perk/i.test(activeMarkup));
check('merchant card does not add insurance conversion CTA', !/href="\/(?:home|auto-bundle|life)\//.test(activeMarkup));
check('paused perk renders unavailable state rather than perk headline', pausedMarkup.includes('No active offer right now') && !pausedMarkup.includes(active.perks[1].headline));
check('null merchant image uses branded fallback', activeMarkup.includes('local-merchant-placeholder'));
check('safe asset helper rejects javascript URI', LocalDirectory.safeAssetUrl('javascript:alert(1)') === null);
check('safe asset helper rejects parent traversal', LocalDirectory.safeAssetUrl('/../secret.png') === null);
check('safe asset helper accepts root-relative image', LocalDirectory.safeAssetUrl('/shared/assets/test.webp') === '/shared/assets/test.webp');
check('safe asset helper accepts https image', LocalDirectory.safeAssetUrl('https://example.com/test.webp') === 'https://example.com/test.webp');
const malicious = clone(vms[0]);
malicious.merchant.name = '<script>alert(1)</script>';
const escapedMarkup = LocalDirectory.renderMerchantCard(malicious);
check('merchant renderer escapes merchant text', !escapedMarkup.includes('<script>alert(1)</script>') && escapedMarkup.includes('&lt;script&gt;'));
const summary = LocalDirectory.getSummary(vms, 'all');
check('directory summary counts merchants and active perks', summary.merchants === 3 && summary.activePerks === 1);

const inactiveMerchant = clone(active);
inactiveMerchant.merchants[0].status = 'paused';
check('paused merchant is excluded entirely', LocalDirectory.getDirectoryViewModels(inactiveMerchant, { now: '2026-08-16T12:00:00-07:00' }).length === 2);
const futurePerk = clone(active);
futurePerk.perks[0].start_at = '2026-09-01T00:00:00-07:00';
check('scheduled perk is not shown as active', LocalDirectory.getDirectoryViewModels(futurePerk, { now: '2026-08-16T12:00:00-07:00' }).find((vm) => vm.merchant.category === 'eat-drink').perk === null);

check('contract sprint identity', contract.sprint === '408-LOCAL-1.3');
check('contract next sprint is 1.4', contract.nextSprint === '408-LOCAL-1.4');
check('contract keeps redemption out of 1.3', contract.boundaries.redemptionImplemented === false);
check('contract keeps merchant detail routes out of 1.3', contract.boundaries.merchantDetailRoutesActivated === false);
check('contract guarantees fixtures excluded', contract.publicDiscovery.fixturesExcluded === true);
check('contract keeps no insurance gate', contract.boundaries.insurancePurchaseRequired === false && contract.boundaries.insuranceQuoteRequired === false);
check('roadmap current build is 1.3', roadmap.includes('**Current Local build:** `408-LOCAL-1.3`'));
check('roadmap marks 1.3 complete', /408-LOCAL-1\.3\s+—\s+Merchant Discovery Directory\s+—\s+COMPLETE/.test(roadmap));
check('roadmap preserves 1.4 next scope', roadmap.includes('408-LOCAL-1.4 — Merchant Perk Detail + Redemption'));

const result = {
  sprint: '408-LOCAL-1.3',
  total: checks.length,
  passed: checks.filter((c) => c.passed).length,
  failed: checks.filter((c) => !c.passed).length,
  checks
};
fs.writeFileSync(path.join(root, 'LOCAL1_3_QA.json'), JSON.stringify(result, null, 2) + '\n');
console.log(`408-LOCAL-1.3 QA: ${result.passed}/${result.total} passed`);
