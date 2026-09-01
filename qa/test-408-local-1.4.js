const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const files = {
  index: path.join(root, 'local', 'index.html'),
  detail: path.join(root, 'local', 'detail', 'index.html'),
  css: path.join(root, 'shared', 'local.css'),
  catalog: path.join(root, 'local', 'data', 'catalog.json'),
  schema: path.join(root, 'local', 'data', 'catalog.schema.json'),
  model: path.join(root, 'shared', 'local-data-model.js'),
  directory: path.join(root, 'shared', 'local-directory.js'),
  merchant: path.join(root, 'shared', 'local-merchant.js'),
  worker: path.join(root, '_worker.js'),
  release13: path.join(root, 'LOCAL1_3_RELEASE_CERTIFICATION.json'),
  roadmap: path.join(root, '408-LOCAL-ROADMAP.md'),
  sprint: path.join(root, 'SPRINT-408-LOCAL-1.4.md'),
  contract: path.join(root, 'LOCAL1_4_REDEMPTION_CONTRACT.json')
};
for (const [name, file] of Object.entries(files)) assert(fs.existsSync(file), `missing ${name}: ${path.relative(root, file)}`);

const indexHtml = fs.readFileSync(files.index, 'utf8');
const detailHtml = fs.readFileSync(files.detail, 'utf8');
const css = fs.readFileSync(files.css, 'utf8');
const directorySource = fs.readFileSync(files.directory, 'utf8');
const merchantSource = fs.readFileSync(files.merchant, 'utf8');
const workerSource = fs.readFileSync(files.worker, 'utf8');
const catalog = JSON.parse(fs.readFileSync(files.catalog, 'utf8'));
const release13 = JSON.parse(fs.readFileSync(files.release13, 'utf8'));
const LocalDataModel = require(files.model);
const LocalDirectory = require(files.directory);
const LocalMerchant = require(files.merchant);

function hashFile(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}
function clone(value) { return JSON.parse(JSON.stringify(value)); }
const checks = [];
function check(name, condition) {
  checks.push({ name, passed: Boolean(condition) });
  assert(condition, name);
}

check('Local directory build marker advanced to 1.4', /data-local-build="408-LOCAL-1\.4"/.test(indexHtml));
check('merchant detail shell has 1.4 build marker', /data-local-build="408-LOCAL-1\.4"/.test(detailHtml));
check('merchant detail route shell exists', fs.statSync(files.detail).size > 2500);
check('merchant detail runtime exists', fs.statSync(files.merchant).size > 6000);
check('detail shell loads Local data model before merchant runtime', detailHtml.indexOf('/shared/local-data-model.js') < detailHtml.indexOf('/shared/local-merchant.js'));
check('detail shell exposes merchant detail mount', /data-local-merchant-detail/.test(detailHtml));
check('detail shell has accessible loading live region', /data-local-merchant-detail[^>]*aria-live="polite"/.test(detailHtml));
check('detail shell remains account-free', !/href="\/(?:login|signin|account)\/?"/i.test(detailHtml) && !/type="password"/i.test(detailHtml));
check('detail shell remains consumer-form-free', !/<form\b/i.test(detailHtml));
check('detail shell says no purchase or quote required', /No insurance purchase or quote required/i.test(detailHtml));
check('detail footer carries producer license', detailHtml.includes('CA License #4528400'));
check('directory copy now tells visitor full perk is available on merchant page', /full perk, merchant terms and frictionless show-your-screen redemption/i.test(indexHtml));
check('directory runtime now creates canonical merchant links', /local-merchant-open/.test(directorySource) && /viewModel\.merchant_url/.test(directorySource));
check('directory runtime still does not render Use This Perk directly on cards', !/Use This Perk/.test(directorySource));

check('1.2 catalog remains valid', LocalDataModel.validateCatalog(catalog).length === 0);
check('1.2 catalog dataset version remains stable', catalog.dataset_version === '408-LOCAL-1.2');
check('catalog unchanged from 1.3', hashFile(files.catalog) === release13.preservedCoreHashes['local/data/catalog.json']);
check('catalog schema unchanged from 1.3', hashFile(files.schema) === release13.preservedCoreHashes['local/data/catalog.schema.json']);
check('data model unchanged from 1.3', hashFile(files.model) === release13.preservedCoreHashes['shared/local-data-model.js']);
check('all production merchants remain draft fixtures', catalog.merchants.length === 3 && catalog.merchants.every((m) => m.fixture === true && m.status === 'draft'));
check('all production perks remain draft fixtures', catalog.perks.length === 3 && catalog.perks.every((p) => p.fixture === true && p.status === 'draft'));
check('production fixture slug cannot become public detail model', LocalMerchant.getMerchantDetailViewModel(catalog, catalog.merchants[0].slug, { now: '2026-08-16T12:00:00-07:00' }) === null);

check('canonical merchant slug parser accepts merchant path', LocalMerchant.getSlugFromPath('/local/example-merchant/') === 'example-merchant');
check('slug parser accepts canonicalizable no-slash merchant path', LocalMerchant.getSlugFromPath('/local/example-merchant') === 'example-merchant');
check('slug parser rejects Local root', LocalMerchant.getSlugFromPath('/local/') === null);
check('slug parser rejects data infrastructure route', LocalMerchant.getSlugFromPath('/local/data/') === null);
check('slug parser rejects detail infrastructure route', LocalMerchant.getSlugFromPath('/local/detail/') === null);
check('slug parser rejects join reserved route', LocalMerchant.getSlugFromPath('/local/join/') === null);
check('slug parser rejects nested paths', LocalMerchant.getSlugFromPath('/local/foo/bar/') === null);
check('slug parser rejects traversal-like input', LocalMerchant.getSlugFromPath('/local/../home/') === null);

const active = clone(catalog);
active.merchants.forEach((m) => { m.fixture = false; m.status = 'active'; });
active.perks.forEach((p) => { p.fixture = false; p.status = 'active'; p.evergreen = true; p.start_at = null; p.end_at = null; });
active.merchants[0].website_url = 'https://example.com/restaurant';
active.merchants[0].instagram_url = 'https://example.com/restaurant-social';
active.merchants[0].address_display = '123 Lincoln Ave, San Jose, CA';
active.perks[0].headline = 'Complimentary appetizer with qualifying purchase';
active.perks[0].summary = 'Show the current Local perk screen when ordering.';
active.perks[0].terms = 'One per table. Dine-in only. Merchant may change or end the offer.';
check('synthetic active catalog validates', LocalDataModel.validateCatalog(active).length === 0);

const detailVm = LocalMerchant.getMerchantDetailViewModel(active, active.merchants[0].slug, { now: '2026-08-16T12:00:00-07:00' });
check('active non-fixture merchant resolves to canonical detail model', Boolean(detailVm));
check('detail model preserves canonical merchant URL', detailVm.merchant_url === `/local/${active.merchants[0].slug}/`);
check('detail model resolves current active perk', detailVm.perk && detailVm.perk.perk_id === active.perks[0].perk_id);
check('detail model includes program relationship boundary', /does not imply endorsement/i.test(detailVm.program.merchant_relationship_text));

const directoryVm = LocalDirectory.getDirectoryViewModels(active, { now: '2026-08-16T12:00:00-07:00' }).find((item) => item.merchant.slug === active.merchants[0].slug);
const directoryMarkup = LocalDirectory.renderMerchantCard(directoryVm);
check('discovery card links to canonical merchant route', directoryMarkup.includes(`href="/local/${active.merchants[0].slug}/"`));
check('active discovery card uses View Local perk label', /View Local perk/.test(directoryMarkup));
check('discovery card does not redeem inline', !/data-local-use-perk/.test(directoryMarkup));

const detailMarkup = LocalMerchant.renderMerchantDetail(detailVm);
check('detail renders merchant name', detailMarkup.includes('Pilot Eat &amp; Drink Fixture'));
check('detail renders category', detailMarkup.includes('Eat &amp; Drink'));
check('detail renders neighborhood', detailMarkup.includes(active.merchants[0].neighborhood));
check('detail renders short merchant description', detailMarkup.includes('Fixture record used to validate the Eat &amp; Drink merchant model before pilot activation.'));
check('detail renders long merchant description', detailMarkup.includes(active.merchants[0].description_long));
check('detail renders merchant area/address', detailMarkup.includes(active.merchants[0].address_display));
check('detail renders website link', detailMarkup.includes('Website'));
check('detail renders Instagram link', detailMarkup.includes('Instagram'));
check('detail renders Directions link', detailMarkup.includes('Directions'));
check('detail renders current perk headline', detailMarkup.includes(active.perks[0].headline));
check('detail renders current perk summary', detailMarkup.includes(active.perks[0].summary));
check('detail renders merchant-specific terms', detailMarkup.includes(active.perks[0].terms));
check('detail renders Use This Perk action', /data-local-use-perk[^>]*>Use This Perk</.test(detailMarkup));
check('detail explicitly says no account or insurance form required', /No account or insurance form required/.test(detailMarkup));
check('detail renders independent-offer language', detailMarkup.includes('No insurance purchase or quote required.'));
check('detail renders relationship no-endorsement boundary', /does not imply endorsement/i.test(detailMarkup));
check('detail does not contain a consumer form', !/<form\b/i.test(detailMarkup));
check('detail does not contain identity capture fields', !/(name="(?:first_name|last_name|phone|email|property_address)")/.test(detailMarkup));

const redemption = LocalMerchant.renderRedemptionDialog(detailVm);
check('redemption uses native dialog surface', /^<dialog/.test(redemption));
check('redemption tells customer to show screen at merchant', /Show this screen at/.test(redemption));
check('redemption repeats merchant name', redemption.includes('Pilot Eat &amp; Drink Fixture'));
check('redemption repeats exact current perk headline', redemption.includes(active.perks[0].headline));
check('redemption repeats exact merchant terms', redemption.includes(active.perks[0].terms));
check('redemption repeats independent-offer language', redemption.includes('No insurance purchase or quote required.'));
check('redemption has visible ready-to-show state', /Ready to show/.test(redemption));
check('redemption has explicit close controls', (redemption.match(/data-local-redemption-close/g) || []).length >= 2);
check('redemption does not contain account gate', !/(login|sign in|create account)/i.test(redemption));
check('redemption does not contain insurance lead form', !/<form\b/i.test(redemption) && !/(first_name|property_address|Request a quote)/i.test(redemption));
check('redemption runtime uses showModal with a safe fallback', /dialog\.showModal/.test(merchantSource) && /setAttribute\('open'/.test(merchantSource));
check('redemption runtime returns focus to Use This Perk control', /useButton\.focus/.test(merchantSource));

const codeMethod = clone(active);
codeMethod.perks[0].redemption_method = 'merchant_code';
const codeVm = LocalMerchant.getMerchantDetailViewModel(codeMethod, codeMethod.merchants[0].slug, { now: '2026-08-16T12:00:00-07:00' });
const codeMarkup = LocalMerchant.renderMerchantDetail(codeVm);
check('non-show-screen redemption method fails closed for online redemption', !/Use This Perk/.test(codeMarkup) && /show-your-screen redemption is not available/i.test(codeMarkup));
check('non-show-screen method does not create redemption dialog', LocalMerchant.renderRedemptionDialog(codeVm) === '');
check('active merchant metadata runtime promotes valid page from noindex to index', /robotsMeta\.setAttribute\('content', 'index,follow'\)/.test(merchantSource));

const paused = clone(active);
paused.perks[0].status = 'paused';
const pausedVm = LocalMerchant.getMerchantDetailViewModel(paused, paused.merchants[0].slug, { now: '2026-08-16T12:00:00-07:00' });
const pausedMarkup = LocalMerchant.renderMerchantDetail(pausedVm);
check('active merchant can remain on detail page while perk paused', Boolean(pausedVm) && pausedVm.perk === null);
check('paused offer never shows Use This Perk', !/Use This Perk/.test(pausedMarkup));
check('paused offer renders no-active-offer state', /No active offer right now/.test(pausedMarkup));
check('paused offer headline is not leaked as current', !pausedMarkup.includes(paused.perks[0].headline));

const expired = clone(active);
expired.perks[0].evergreen = false;
expired.perks[0].start_at = '2026-07-01T00:00:00-07:00';
expired.perks[0].end_at = '2026-08-01T00:00:00-07:00';
const expiredVm = LocalMerchant.getMerchantDetailViewModel(expired, expired.merchants[0].slug, { now: '2026-08-16T12:00:00-07:00' });
check('expired perk cannot become redeemable', expiredVm && expiredVm.perk === null && !/Use This Perk/.test(LocalMerchant.renderMerchantDetail(expiredVm)));
const inactive = clone(active);
inactive.merchants[0].status = 'paused';
check('paused merchant cannot render public detail', LocalMerchant.getMerchantDetailViewModel(inactive, inactive.merchants[0].slug) === null);
check('unknown merchant slug cannot render public detail', LocalMerchant.getMerchantDetailViewModel(active, 'missing-merchant') === null);

check('directions URL encodes merchant address safely', LocalMerchant.buildDirectionsUrl('123 Main St & 1st, San Jose, CA').includes('123%20Main%20St%20%26%201st%2C%20San%20Jose%2C%20CA'));
check('directions URL is HTTPS Google Maps search', LocalMerchant.buildDirectionsUrl('San Jose, CA').startsWith('https://www.google.com/maps/search/?api=1&query='));
check('empty address does not create directions URL', LocalMerchant.buildDirectionsUrl('') === null);
check('asset helper rejects javascript URI', LocalMerchant.safeAssetUrl('javascript:alert(1)') === null);
check('external URL helper rejects http URL', LocalMerchant.safeExternalUrl('http://example.com') === null);

const malicious = clone(detailVm);
malicious.merchant = Object.assign({}, malicious.merchant, { name: '<script>alert(1)</script>' });
malicious.perk = Object.assign({}, malicious.perk, { headline: '<img src=x onerror=alert(1)>', terms: '<b>unsafe</b>' });
const escaped = LocalMerchant.renderMerchantDetail(malicious);
check('detail renderer escapes merchant HTML', !escaped.includes('<script>alert(1)</script>') && escaped.includes('&lt;script&gt;'));
check('detail renderer escapes perk HTML', !escaped.includes('<img src=x') && escaped.includes('&lt;img'));
check('detail renderer escapes terms HTML', !escaped.includes('<b>unsafe</b>') && escaped.includes('&lt;b&gt;unsafe&lt;/b&gt;'));

function loadPageAssetRoute(source) {
  const start = source.indexOf('function pageAssetRoute(pathname)');
  const end = source.indexOf('\nfunction assetRequestFor', start);
  assert(start >= 0 && end > start, 'pageAssetRoute source boundaries');
  const code = `${source.slice(start, end)}\npageAssetRoute;`;
  return vm.runInNewContext(code, {});
}
const pageAssetRoute = loadPageAssetRoute(workerSource);
check('worker redirects no-slash merchant route to canonical trailing slash', JSON.stringify(pageAssetRoute('/local/example-merchant')) === JSON.stringify({ redirect: '/local/example-merchant/', status: 308 }));
check('worker serves canonical merchant route through reusable detail asset', JSON.stringify(pageAssetRoute('/local/example-merchant/')) === JSON.stringify({ asset: '/local/detail/' }));
check('worker does not treat Local data path as merchant', pageAssetRoute('/local/data/') === null);
check('worker protects internal detail route with redirect', JSON.stringify(pageAssetRoute('/local/detail/')) === JSON.stringify({ redirect: '/local/', status: 308 }));
check('worker preserves canonical Local root behavior', pageAssetRoute('/local') && pageAssetRoute('/local').redirect === '/local/');
check('worker leaves canonical Local directory asset to Pages', pageAssetRoute('/local/') === null);
check('worker leaves nested Local paths out of merchant routing', pageAssetRoute('/local/foo/bar/') === null);

check('detail CSS provides mobile 44px close target', /\.local-redemption-close\{[^}]*width:44px;height:44px/.test(css));
check('detail CSS provides responsive one-column layout', /@media\(max-width:840px\)[\s\S]*\.local-detail-grid,.local-detail-loading\{grid-template-columns:1fr/.test(css));
check('detail CSS provides mobile full-width Use This Perk', /@media\(max-width:720px\)[\s\S]*\.local-use-perk\{width:100%/.test(css));
check('redemption dialog has modal backdrop treatment', /\.local-redemption-dialog::backdrop/.test(css));
check('reduced motion disables detail loading shimmer', /prefers-reduced-motion:reduce[^}]*\{\.local-detail-loading-media\{animation:none\}/.test(css));

check('roadmap marks 1.4 complete', /408-LOCAL-1\.4 — Merchant Perk Detail \+ Redemption — COMPLETE/.test(fs.readFileSync(files.roadmap, 'utf8')));
check('roadmap locks 1.5 as next sprint', /408-LOCAL-1\.5 — Merchant Join Flow/.test(fs.readFileSync(files.roadmap, 'utf8')));
check('1.4 sprint documentation exists', fs.statSync(files.sprint).size > 1800);
check('1.4 contract identifies no identity collection', JSON.parse(fs.readFileSync(files.contract, 'utf8')).boundaries.consumerIdentityCollected === false);

const failed = checks.filter((item) => !item.passed);
const result = { total: checks.length, passed: checks.length - failed.length, failed: failed.length, checks };
fs.writeFileSync(path.join(root, 'LOCAL1_4_QA.json'), JSON.stringify(result, null, 2));
console.log(`408-LOCAL-1.4 QA: ${result.passed}/${result.total} passed`);
if (failed.length) process.exit(1);
