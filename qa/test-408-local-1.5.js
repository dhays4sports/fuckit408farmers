const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const files = {
  index: path.join(root, 'local', 'index.html'),
  join: path.join(root, 'local', 'join', 'index.html'),
  thanks: path.join(root, 'local', 'join', 'thank-you.html'),
  css: path.join(root, 'shared', 'local.css'),
  joinJs: path.join(root, 'shared', 'local-join.js'),
  worker: path.join(root, '_worker.js'),
  catalog: path.join(root, 'local', 'data', 'catalog.json'),
  schema: path.join(root, 'local', 'data', 'catalog.schema.json'),
  model: path.join(root, 'shared', 'local-data-model.js'),
  directory: path.join(root, 'shared', 'local-directory.js'),
  merchant: path.join(root, 'shared', 'local-merchant.js'),
  release14: path.join(root, 'LOCAL1_4_RELEASE_CERTIFICATION.json'),
  contract: path.join(root, 'LOCAL1_5_JOIN_CONTRACT.json'),
  sprint: path.join(root, 'SPRINT-408-LOCAL-1.5.md'),
  roadmap: path.join(root, '408-LOCAL-ROADMAP.md'),
  version: path.join(root, 'VERSION')
};
for (const [name, file] of Object.entries(files)) assert(fs.existsSync(file), `missing ${name}: ${path.relative(root, file)}`);

const html = fs.readFileSync(files.join, 'utf8');
const thanks = fs.readFileSync(files.thanks, 'utf8');
const indexHtml = fs.readFileSync(files.index, 'utf8');
const css = fs.readFileSync(files.css, 'utf8');
const joinSource = fs.readFileSync(files.joinJs, 'utf8');
const worker = fs.readFileSync(files.worker, 'utf8');
const roadmap = fs.readFileSync(files.roadmap, 'utf8');
const release14 = JSON.parse(fs.readFileSync(files.release14, 'utf8'));
const contract = JSON.parse(fs.readFileSync(files.contract, 'utf8'));
const LocalJoin = require(files.joinJs);

function hashFile(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }
const checks = [];
function check(name, condition) {
  checks.push({ name, passed: Boolean(condition) });
  assert(condition, name);
}

check('Local directory build marker advanced to 1.5', /data-local-build="408-LOCAL-1\.5"/.test(indexHtml));
check('join page has 1.5 build marker', /data-local-build="408-LOCAL-1\.5"/.test(html));
check('thank-you page has 1.5 build marker', /data-local-build="408-LOCAL-1\.5"/.test(thanks));
check('VERSION advanced to 1.5', fs.readFileSync(files.version, 'utf8').trim() === '408-LOCAL-1.5');
check('join canonical route declared', html.includes('https://408farmers.com/local/join/'));
check('join page is indexable', /name="robots" content="index,follow/.test(html));
check('thank-you page is noindex', /name="robots" content="noindex,follow"/.test(thanks));
check('directory business CTA routes to join flow', /href="\/local\/join\/">Apply to join the Local pilot/.test(indexHtml));
check('directory footer For businesses routes to join flow', /<a href="\/local\/join\/">For businesses<\/a>/.test(indexHtml));

const required = ['business_name','category','business_location','contact_name','email','phone','proposed_perk','authorized_ack','separation_ack'];
for (const name of required) check(`join form contains required field ${name}`, new RegExp(`name="${name}"`).test(html));
check('business name uses organization autocomplete', /name="business_name"[^>]*autocomplete="organization"/.test(html));
check('contact email uses email input', /name="email"[^>]*type="email"|type="email"[^>]*name="email"/.test(html));
check('contact phone uses tel input', /name="phone"[^>]*type="tel"|type="tel"[^>]*name="phone"/.test(html));
check('website/social field is optional URL input', /name="website_social"[^>]*type="url"|type="url"[^>]*name="website_social"/.test(html));
check('notes field is optional', /name="notes"/.test(html) && !/name="notes"[^>]*required/.test(html));
check('category supports three pilot groups', ['eat-drink','home','auto'].every((value) => html.includes(`value="${value}"`)));
check('category supports other/not sure without expanding public directory categories', html.includes('value="other"'));
check('proposed perk field has bounded length', /name="proposed_perk"[^>]*maxlength="700"/.test(html));
check('notes field has bounded length', /name="notes"[^>]*maxlength="1200"/.test(html));
check('honeypot is present', /name="_gotcha"/.test(html));
check('form uses direct Formspree fallback action', /action="https:\/\/formspree\.io\/f\/mojgnegn"/.test(html));
check('form declares dedicated same-origin proxy endpoint', /data-proxy-endpoint="\/api\/local\/merchant-application"/.test(html));
check('form declares branded success route', /data-success="\/local\/join\/thank-you\.html"/.test(html));
check('merchant application uses unique form ID', /id="localMerchantJoinForm"/.test(html) && !/id="leadForm"/.test(html));
check('merchant application does not load consumer shared form controller', !/shared\/script\.js/.test(html));
check('join runtime is loaded', /shared\/local-join\.js/.test(html));

check('join page says no cost to apply', /No cost to apply/i.test(html));
check('join page says accepted pilot participation is free', /Pilot participation is free if accepted/i.test(html));
check('join page says separate from insurance', /Separate from insurance/i.test(html));
check('join page says no commercial insurance requirement', /No requirement to place commercial insurance with Farmers or 408FARMERS/i.test(html));
check('join page says no guaranteed referrals or lead volume', /No guaranteed customer referrals or lead volume/i.test(html));
check('join page says no sales promise', /No promise that participation will generate sales/i.test(html));
check('join page says no endorsement/certification implication', /No implication that Farmers or 408FARMERS endorses or certifies/i.test(html));
check('join page says application does not guarantee placement', /does not guarantee placement/i.test(html));
check('join page says nothing publishes automatically', /Nothing publishes automatically/i.test(html));
check('join page says merchant controls perk', /Your business controls the perk/i.test(html));
check('join page says merchant remains responsible for public offer', /public offer remains the participating merchant's responsibility/i.test(html));
check('join page does not ask for current insurance carrier', !/current carrier|insurance carrier|carrier name/i.test(html));
check('join page does not ask for insurance premium or renewal date', !/annual premium|current premium|renewal date/i.test(html));
check('join page does not request an insurance quote', !/request (?:an )?insurance quote|quote my business|commercial quote/i.test(html));
check('join page has Privacy and Terms links', html.includes('/privacy.html') && html.includes('/terms.html'));
check('join footer carries producer license', html.includes('CA License #4528400'));

check('authorization acknowledgment is required', /name="authorized_ack"[^>]*required/.test(html));
check('insurance-separation acknowledgment is required', /name="separation_ack"[^>]*required/.test(html));
check('form includes merchant-contact purpose language', /Dylan may contact you about this Local merchant application/i.test(html));
check('form includes standard UTM fields', ['utm_source','utm_medium','utm_campaign','utm_content','utm_term'].every((name) => html.includes(`name="${name}"`)));
check('form includes landing and submission timestamps', html.includes('name="landing_page"') && html.includes('name="submitted_at"'));
check('form remains browser-validatable without JS', !/\bnovalidate\b/.test(html));

check('client runtime build is 1.5', LocalJoin.BUILD === '408-LOCAL-1.5');
check('client runtime required fields match contract', JSON.stringify([...LocalJoin.REQUIRED_FIELDS]) === JSON.stringify(required));
const good = new FormData();
const goodValues = {
  business_name:'Willow Glen Test Merchant', category:'eat-drink', business_location:'Willow Glen, San Jose, CA',
  contact_name:'Pat Owner', email:'pat@example.com', phone:'408-555-1212', proposed_perk:'A simple merchant-owned offer',
  authorized_ack:'yes', separation_ack:'yes', _gotcha:''
};
for (const [key,value] of Object.entries(goodValues)) good.set(key,value);
check('client validation accepts complete merchant application', LocalJoin.validateFormData(good).ok === true);
const badEmail = new FormData();
for (const [key,value] of Object.entries(goodValues)) badEmail.set(key,value);
badEmail.set('email','not-an-email');
check('client validation rejects invalid email', LocalJoin.validateFormData(badEmail).ok === false);
const badPhone = new FormData();
for (const [key,value] of Object.entries(goodValues)) badPhone.set(key,value);
badPhone.set('phone','123');
check('client validation rejects invalid phone', LocalJoin.validateFormData(badPhone).ok === false);
const badAck = new FormData();
for (const [key,value] of Object.entries(goodValues)) badAck.set(key,value);
badAck.delete('separation_ack');
check('client validation rejects missing separation acknowledgment', LocalJoin.validateFormData(badAck).ok === false);
const bot = new FormData();
for (const [key,value] of Object.entries(goodValues)) bot.set(key,value);
bot.set('_gotcha','spam');
check('client validation rejects honeypot completion', LocalJoin.validateFormData(bot).ok === false);
check('runtime stamps submitted_at', /submitted_at/.test(joinSource) && /toISOString\(\)/.test(joinSource));
check('runtime maps all standard UTM fields', ['utm_source','utm_medium','utm_campaign','utm_content','utm_term'].every((name) => joinSource.includes(`'${name}'`)));
check('runtime posts to same-origin proxy', /\/api\/local\/merchant-application/.test(joinSource) && /credentials:\s*'same-origin'/.test(joinSource));
check('runtime only direct-fallbacks on delivery/server failure', /fallback:\s*response\.status\s*>=\s*500/.test(joinSource));
check('runtime announces submission state', /data-local-join-status/.test(html) && /aria-live="polite"/.test(html));
check('runtime disables submit while sending', /button\.disabled = Boolean\(busy\)/.test(joinSource));
check('runtime contains no public analytics events', !/(local_view|merchant_view|perk_open|perk_redeem_intent|insurance_cta_click)/.test(joinSource));

check('worker declares dedicated merchant application API path', worker.includes("const LOCAL_MERCHANT_APPLICATION_PATH = '/api/local/merchant-application'"));
check('worker routes dedicated merchant application endpoint', /url\.pathname === LOCAL_MERCHANT_APPLICATION_PATH\) return handleLocalMerchantApplication/.test(worker));
check('worker limits merchant application body size', /MAX_LOCAL_MERCHANT_BODY_BYTES = 32 \* 1024/.test(worker));
check('worker checks same-origin merchant application', /handleLocalMerchantApplication[\s\S]*validLeadOrigin\(request\)/.test(worker));
check('worker checks merchant application content type', /handleLocalMerchantApplication[\s\S]*multipart\\\/form-data\|application\\\/x-www-form-urlencoded/.test(worker));
check('worker rejects honeypot', /fields\.get\('_gotcha'\)/.test(worker));
check('worker allowlists supported merchant categories', /LOCAL_MERCHANT_CATEGORIES = new Set\(\['eat-drink','home','auto','other'\]\)/.test(worker));
check('worker validates both acknowledgments', /application\.authorized_ack !== 'yes' \|\| application\.separation_ack !== 'yes'/.test(worker));
check('worker has dedicated Formspree environment override', /LOCAL_MERCHANT_FORMSPREE_ENDPOINT/.test(worker));
check('worker preserves existing Formspree fallback config', /env\.FORMSPREE_ENDPOINT[\s\S]*DEFAULT_FORMSPREE_ENDPOINT/.test(worker));
check('worker sets merchant application subject server-side', /outbound\.set\('_subject', '408FARMERS Local Merchant Application'\)/.test(worker));
check('worker records 1.5 application build server-side', /outbound\.set\('application_build', LOCAL_MERCHANT_BUILD\)/.test(worker));
check('worker does not log merchant application PII', !/console\.(?:log|info|warn|error)\(/.test(worker));

function loadPageAssetRoute(source) {
  const start = source.indexOf('function pageAssetRoute(pathname)');
  const end = source.indexOf('\nfunction assetRequestFor', start);
  assert(start >= 0 && end > start, 'pageAssetRoute source boundaries');
  return vm.runInNewContext(`${source.slice(start, end)}\npageAssetRoute;`, {});
}
const pageAssetRoute = loadPageAssetRoute(worker);
check('worker canonicalizes /local/join to trailing slash', JSON.stringify(pageAssetRoute('/local/join')) === JSON.stringify({ redirect:'/local/join/', status:308 }));
check('worker leaves canonical static join route to Pages assets', pageAssetRoute('/local/join/') === null);
check('worker still canonicalizes merchant no-slash route', JSON.stringify(pageAssetRoute('/local/example-merchant')) === JSON.stringify({ redirect:'/local/example-merchant/', status:308 }));
check('worker still serves merchant route through detail shell', JSON.stringify(pageAssetRoute('/local/example-merchant/')) === JSON.stringify({ asset:'/local/detail/' }));
check('worker does not treat join as a merchant slug', pageAssetRoute('/local/join/') === null);

check('1.2 catalog unchanged from 1.4', hashFile(files.catalog) === release14.preservedCoreHashes['local/data/catalog.json']);
check('1.2 catalog schema unchanged from 1.4', hashFile(files.schema) === release14.preservedCoreHashes['local/data/catalog.schema.json']);
check('Local data model unchanged from 1.4', hashFile(files.model) === release14.preservedCoreHashes['shared/local-data-model.js']);
check('directory runtime unchanged from 1.4', hashFile(files.directory) === release14.sourceHashes['shared/local-directory.js']);
check('merchant detail runtime unchanged from 1.4', hashFile(files.merchant) === release14.sourceHashes['shared/local-merchant.js']);
const catalog = JSON.parse(fs.readFileSync(files.catalog, 'utf8'));
check('all fixture merchants remain draft and non-public', catalog.merchants.length === 3 && catalog.merchants.every((m) => m.fixture === true && m.status === 'draft'));
check('all fixture perks remain draft and non-public', catalog.perks.length === 3 && catalog.perks.every((p) => p.fixture === true && p.status === 'draft'));

check('join form controls meet mobile 16px rule', /@media\(max-width:720px\)[\s\S]*\.local-field input,.local-field select,.local-field textarea\{font-size:16px\}/.test(css));
check('join submit retains 56px mobile target', /\.local-join-submit\{min-height:56px\}/.test(css));
check('checkbox control is at least 20px', /\.local-check-row input\{width:20px;height:20px/.test(css));
check('join form has visible focus treatment', /\.local-field input:focus,.local-field select:focus,.local-field textarea:focus/.test(css));
check('thank-you confirms no automatic publication', /Nothing is published automatically/i.test(thanks));
check('thank-you confirms no insurance obligation', /does not create an insurance obligation/i.test(thanks));
check('thank-you links back to Local', /href="\/local\/">Explore 408FARMERS Local/.test(thanks));

check('contract build is 1.5', contract.build === '408-LOCAL-1.5');
check('contract says no commercial insurance requirement', contract.merchantBoundaries.commercialInsurancePlacementRequired === false);
check('contract says no guaranteed referrals', contract.merchantBoundaries.referralsGuaranteed === false);
check('contract says no catalog mutation', contract.catalogMutation === false);
check('contract says no consumer Local events added', contract.analyticsBoundary.consumerLocalEventsAdded === false);
check('contract next sprint is 1.6', contract.nextSprint === '408-LOCAL-1.6');
check('roadmap marks 1.5 complete', /408-LOCAL-1\.5 — Merchant Join Flow — COMPLETE/.test(roadmap));
check('roadmap current build is 1.5', roadmap.includes('**Current Local build:** `408-LOCAL-1.5`'));
check('roadmap locks 1.6 as continuation', /Immediate continuation point[\s\S]*408-LOCAL-1\.6 — Local Attribution Engine/.test(roadmap));
check('sprint documentation is substantive', fs.statSync(files.sprint).size > 3500);

const failed = checks.filter((item) => !item.passed);
const result = { total: checks.length, passed: checks.length - failed.length, failed: failed.length, checks };
fs.writeFileSync(path.join(root, 'LOCAL1_5_QA.json'), JSON.stringify(result, null, 2));
console.log(`408-LOCAL-1.5 QA: ${result.passed}/${result.total} passed`);
if (failed.length) {
  for (const item of failed) console.error('FAIL', item.name);
  process.exit(1);
}
