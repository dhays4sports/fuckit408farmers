const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const files = {
  index: path.join(root, 'local', 'index.html'),
  detail: path.join(root, 'local', 'detail', 'index.html'),
  join: path.join(root, 'local', 'join', 'index.html'),
  catalog: path.join(root, 'local', 'data', 'catalog.json'),
  schema: path.join(root, 'local', 'data', 'catalog.schema.json'),
  attribution: path.join(root, 'shared', 'local-attribution.js'),
  directory: path.join(root, 'shared', 'local-directory.js'),
  merchant: path.join(root, 'shared', 'local-merchant.js'),
  leadRuntime: path.join(root, 'shared', 'script.js'),
  cfLauncher: path.join(root, 'shared', 'coveragefit-launch.js'),
  worker: path.join(root, '_worker.js'),
  contract: path.join(root, 'LOCAL1_6_ATTRIBUTION_CONTRACT.json'),
  sprint: path.join(root, 'SPRINT-408-LOCAL-1.6.md'),
  roadmap: path.join(root, '408-LOCAL-ROADMAP.md'),
  version: path.join(root, 'VERSION'),
  release15: path.join(root, 'LOCAL1_5_RELEASE_CERTIFICATION.json')
};
for (const [name, file] of Object.entries(files)) assert(fs.existsSync(file), `missing ${name}`);

const LocalAttribution = require(files.attribution);
const LocalDirectory = require(files.directory);
const LocalMerchant = require(files.merchant);
const html = fs.readFileSync(files.index, 'utf8');
const detailHtml = fs.readFileSync(files.detail, 'utf8');
const joinHtml = fs.readFileSync(files.join, 'utf8');
const directorySource = fs.readFileSync(files.directory, 'utf8');
const merchantSource = fs.readFileSync(files.merchant, 'utf8');
const leadSource = fs.readFileSync(files.leadRuntime, 'utf8');
const launcherSource = fs.readFileSync(files.cfLauncher, 'utf8');
const workerSource = fs.readFileSync(files.worker, 'utf8');
const roadmap = fs.readFileSync(files.roadmap, 'utf8');
const contract = JSON.parse(fs.readFileSync(files.contract, 'utf8'));
const release15 = JSON.parse(fs.readFileSync(files.release15, 'utf8'));

function hashFile(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }
function storage() {
  const map = new Map();
  return {
    getItem: key => map.has(key) ? map.get(key) : null,
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: key => map.delete(key),
    dump: () => new Map(map)
  };
}
const checks=[];
function check(name, condition) { checks.push({name,passed:Boolean(condition)}); assert(condition, name); }

check('Local attribution build is 1.6', LocalAttribution.BUILD === '408-LOCAL-1.6');
check('Local attribution schema is versioned', LocalAttribution.SCHEMA === '408-local-attribution-v1');
check('Local event schema is versioned', LocalAttribution.EVENT_SCHEMA === '408-local-event-v1');
check('Local context retention is exactly 30 days', LocalAttribution.RETENTION_MS === 30*24*60*60*1000);
check('event endpoint is same-origin Local endpoint', LocalAttribution.EVENT_ENDPOINT === '/api/local/event');
check('five minimum event names are exact', JSON.stringify(LocalAttribution.EVENT_NAMES) === JSON.stringify(['local_view','merchant_view','perk_open','perk_redeem_intent','insurance_cta_click']));
check('canonical context includes required Local identifiers', ['source','partner_id','perk_id','merchant_slug','surface','campaign','variant'].every(k => LocalAttribution.CONTEXT_KEYS.includes(k)));
check('canonical context includes standard UTMs', ['utm_source','utm_medium','utm_campaign','utm_content','utm_term'].every(k => LocalAttribution.CONTEXT_KEYS.includes(k)));
check('token accepts campaign-safe identifier', LocalAttribution.token('stevies_coaster', 64) === 'stevies_coaster');
check('token rejects free-form name-like value', LocalAttribution.token('Pat Owner',64) === '');
check('token rejects email-shaped value', LocalAttribution.token('pat@example.com',64) === '');
check('token rejects URL-shaped value', LocalAttribution.token('https://example.com',120) === '');
check('token rejects address-like value', LocalAttribution.token('123 Main St',120) === '');

const store = storage();
const t0 = Date.parse('2026-08-16T07:30:00Z');
const physical = LocalAttribution.capture({
  pathname:'/local/stevies/',
  search:'?source=local&partner_id=stevies&perk_id=stevies-appetizer&merchant_slug=stevies&surface=coaster_table&campaign=local_perks&variant=coaster_v1&utm_source=stevies&utm_medium=coaster&utm_campaign=local_perks&utm_content=coaster_v1'
}, {storage:store, now:t0});
check('capture forces truthful Local source', physical.source === 'local');
check('capture retains merchant partner id', physical.partner_id === 'stevies');
check('capture retains perk id', physical.perk_id === 'stevies-appetizer');
check('capture retains merchant slug', physical.merchant_slug === 'stevies');
check('capture retains physical surface', physical.surface === 'coaster_table');
check('capture retains Local campaign', physical.campaign === 'local_perks');
check('capture retains variant', physical.variant === 'coaster_v1');
check('capture retains UTM source', physical.utm_source === 'stevies');
check('stored record is versioned', JSON.parse(store.getItem(LocalAttribution.STORAGE_KEY)).schema_version === '408-local-attribution-v1');
check('stored record contains no obvious PII keys', !/(name|email|phone|address|premium|carrier|answer)/i.test(Object.keys(JSON.parse(store.getItem(LocalAttribution.STORAGE_KEY)).context).join('|')));
check('stored record expires 30 days after capture', JSON.parse(store.getItem(LocalAttribution.STORAGE_KEY)).expires_at === t0 + LocalAttribution.RETENTION_MS);

const decorated = LocalAttribution.decorateUrl('/home/', {}, {storage:store, origin:'https://408farmers.com'});
const du = new URL(decorated, 'https://408farmers.com');
check('insurance URL carries source=local', du.searchParams.get('source') === 'local');
check('insurance URL carries partner', du.searchParams.get('partner_id') === 'stevies');
check('insurance URL carries perk', du.searchParams.get('perk_id') === 'stevies-appetizer');
check('insurance URL carries merchant slug', du.searchParams.get('merchant_slug') === 'stevies');
check('insurance URL carries physical surface', du.searchParams.get('surface') === 'coaster_table');
check('insurance URL carries campaign', du.searchParams.get('campaign') === 'local_perks');
check('insurance URL carries variant', du.searchParams.get('variant') === 'coaster_v1');
check('insurance URL carries campaign_id compatibility field', du.searchParams.get('campaign_id') === 'local-stevies-coaster_table');
check('insurance URL carries campaign_variant compatibility field', du.searchParams.get('campaign_variant') === 'coaster_v1');
check('insurance URL carries standard UTMs', du.searchParams.get('utm_medium') === 'coaster' && du.searchParams.get('utm_source') === 'stevies');

const event = LocalAttribution.buildEvent('perk_redeem_intent', {context:{partner_id:'stevies',perk_id:'stevies-appetizer',merchant_slug:'stevies'}}, {
  storage:store,
  now:t0+1000,
  location:{pathname:'/local/stevies/'},
  root:{crypto:globalThis.crypto}
});
check('event payload builds', Boolean(event));
check('event contains UUID event id', /^[0-9a-f-]{36}$/i.test(event.event_id));
check('event contains UUID session id', /^[0-9a-f-]{36}$/i.test(event.session_id));
check('event name preserved', event.event_name === 'perk_redeem_intent');
check('event route is Local-only path', event.context.route === '/local/stevies/');
check('event contains origin surface', event.context.origin_surface === 'coaster_table');
check('event does not include consumer identity', !('email' in event.context) && !('phone' in event.context) && !('address' in event.context));
check('event does not include offer text or redemption detail', !('headline' in event.context) && !('terms' in event.context) && !('redemption' in event.context));

const dataRoot = {dataLayer:[], document:{dispatchEvent(){}}, CustomEvent:function(name, init){this.name=name;this.detail=init.detail;}};
LocalAttribution.pushAnalytics(event,{root:dataRoot});
check('event pushes to dataLayer', dataRoot.dataLayer.length === 1 && dataRoot.dataLayer[0].event === 'perk_redeem_intent');
check('dataLayer payload remains identifier-only', !('email' in dataRoot.dataLayer[0]) && !('address' in dataRoot.dataLayer[0]));

check('directory page advances to 1.6', /data-local-build="408-LOCAL-1\.6"/.test(html));
check('merchant detail advances to 1.6', /data-local-build="408-LOCAL-1\.6"/.test(detailHtml));
check('directory loads attribution runtime before directory runtime', html.indexOf('local-attribution.js') > -1 && html.indexOf('local-attribution.js') < html.indexOf('local-directory.js'));
check('merchant detail loads attribution before merchant runtime', detailHtml.indexOf('local-attribution.js') > -1 && detailHtml.indexOf('local-attribution.js') < detailHtml.indexOf('local-merchant.js'));
check('directory insurance links are explicitly marked', (html.match(/data-local-insurance-cta=/g)||[]).length >= 5);
check('detail insurance links are explicitly marked', (detailHtml.match(/data-local-insurance-cta=/g)||[]).length >= 4);
check('merchant join flow remains separate and does not load consumer attribution runtime', !joinHtml.includes('local-attribution.js'));
check('directory-generated merchant links expose bounded attribution data attributes', /data-local-merchant-link/.test(directorySource) && /data-local-partner-id/.test(directorySource) && /data-local-perk-id/.test(directorySource));
check('directory decorates rendered merchant links', /LocalAttribution\.decorateScope\(grid\)/.test(directorySource));
check('merchant page attaches confirmed merchant context', /LocalAttribution\.attachMerchant\(viewModel\)/.test(merchantSource));
check('merchant page emits merchant_view', /emit\('merchant_view'/.test(merchantSource));
check('merchant page emits perk_open', /emit\('perk_open'/.test(merchantSource));
check('redemption click emits perk_redeem_intent', /emit\('perk_redeem_intent'/.test(merchantSource));

check('shared lead runtime accepts source and Local IDs', ['source','partner_id','perk_id','merchant_slug','surface','campaign','variant'].every(k => leadSource.includes(`'${k}'`)));
check('shared lead runtime restores bounded Local storage context', leadSource.includes("408farmers_local_attribution_v1") && leadSource.includes("408-local-attribution-v1"));
check('shared lead runtime only restores Local when no explicit attribution exists', /if \(!explicitAttribution\)/.test(leadSource));
check('shared lead runtime creates missing hidden attribution fields', /document\.createElement\('input'\)/.test(leadSource) && /input\.type = 'hidden'/.test(leadSource));
check('shared lead runtime generates compatible Local campaign id', /localCampaignId/.test(leadSource));

check('CoverageFit launcher passes Local identifiers', ['source','partner_id','perk_id','merchant_slug','surface','variant'].every(k => launcherSource.includes(`'${k}'`)));
check('CoverageFit launcher restores Local storage when current page has no explicit campaign', launcherSource.includes("408farmers_local_attribution_v1") && launcherSource.includes('localFallbackValues'));
check('CoverageFit launcher preserves source=local', /attribution\.source === 'local' \? 'local' : config\.source/.test(launcherSource));
check('CoverageFit launcher explicit current query wins', /Object\.keys\(explicitValues\)\.length === 0/.test(launcherSource));

check('worker declares Local event endpoint', workerSource.includes("const LOCAL_EVENT_PATH = '/api/local/event'"));
check('worker declares exact five Local events', ['local_view','merchant_view','perk_open','perk_redeem_intent','insurance_cta_click'].every(e => workerSource.includes(`'${e}'`)));
check('worker defines dedicated Local D1 table', workerSource.includes('CREATE TABLE IF NOT EXISTS local_attribution_events'));
check('worker supports preferred Local analytics binding', workerSource.includes('env.LOCAL_ANALYTICS_DB || env.LIFE_QUEUE_DB'));
check('worker requires Local event version header', workerSource.includes("X-Local-Event-Version"));
check('worker validates JSON only', /application\\\/json/.test(workerSource));
check('worker exact-key validates Local payload', workerSource.includes("exactKeys(payload, ['schema_version','event_id','session_id','event_name','occurred_at','context'])"));
check('worker does not add IP or user-agent columns', !/local_attribution_events[\s\S]{0,1400}(ip_address|user_agent)/i.test(workerSource));
check('worker analytics failure is non-blocking', workerSource.includes('persisted: false') && workerSource.includes('Analytics must never block Local discovery'));
check('worker fetch routes Local events before asset handling', workerSource.includes('if (url.pathname === LOCAL_EVENT_PATH) return handleLocalEvent(request, env);'));

// Exercise CoverageFit fallback behavior in a minimal VM.
const localRecord = JSON.stringify({schema_version:'408-local-attribution-v1',expires_at:Date.now()+60000,context:{source:'local',partner_id:'stevies',perk_id:'perk-1',merchant_slug:'stevies',surface:'coaster_table',campaign:'local_perks',variant:'coaster_v1',utm_source:'stevies',utm_medium:'coaster',utm_campaign:'local_perks',utm_content:'coaster_v1',utm_term:''}});
const mem = new Map([['408farmers_local_attribution_v1', localRecord]]);
const localStorage = {getItem:k=>mem.get(k)||null,setItem:(k,v)=>mem.set(k,String(v)),removeItem:k=>mem.delete(k)};
const sessionStorage = {getItem:()=>null,setItem(){},removeItem(){}};
const w = {
  location:{search:'',pathname:'/home/',origin:'https://408farmers.com',assign(){}},
  localStorage,sessionStorage,
  crypto:globalThis.crypto,
  dataLayer:[],
  URL,URLSearchParams,
  CustomEvent:function(){},
  LANDING_PAGE_CONFIG:{coverageFitTransitionUrl:'https://coveragefit.com/transition/'}
};
const d = {readyState:'complete',querySelectorAll:()=>[],dispatchEvent(){},addEventListener(){}};
vm.runInNewContext(launcherSource,{window:w,document:d,URL,URLSearchParams,console});
const restored = w.CoverageFitLauncher.getAttribution();
check('CoverageFit runtime actually restores Local partner from storage', restored.partner_id === 'stevies');
check('CoverageFit runtime actually restores Local surface from storage', restored.surface === 'coaster_table');
const cfUrl = new URL(w.CoverageFitLauncher.buildUrl({navigate:false}), 'https://coveragefit.com');
check('CoverageFit runtime actually sends source=local', cfUrl.searchParams.get('source') === 'local');
check('CoverageFit runtime actually sends partner/perk/surface', cfUrl.searchParams.get('partner_id') === 'stevies' && cfUrl.searchParams.get('perk_id') === 'perk-1' && cfUrl.searchParams.get('surface') === 'coaster_table');

check('1.5 catalog hash remains preserved', hashFile(files.catalog) === release15.preservedCoreHashes['local/data/catalog.json']);
check('1.5 schema hash remains preserved', hashFile(files.schema) === release15.preservedCoreHashes['local/data/catalog.schema.json']);
check('1.5 merchant join page remains byte-for-byte preserved', hashFile(files.join) === release15.sourceHashes['local/join/index.html']);
check('contract build is 1.6', contract.build === '408-LOCAL-1.6');
check('contract has exact five events', JSON.stringify(contract.events) === JSON.stringify(LocalAttribution.EVENT_NAMES));
check('contract says consumer identity is forbidden', contract.privacyBoundary.consumerIdentityAllowed === false);
check('contract says analytics never gate redemption', contract.merchantValueBoundary.analyticsRequiredForRedemption === false);
check('contract says explicit current campaign wins', contract.insuranceContinuity.explicitCurrentCampaignWins === true);
check('contract next sprint is 1.7', contract.nextSprint === '408-LOCAL-1.7');
check('roadmap marks 1.6 complete', /408-LOCAL-1\.6 — Local Attribution Engine — COMPLETE/.test(roadmap));
check('roadmap current build is 1.6', roadmap.includes('**Current Local build:** `408-LOCAL-1.6`'));
check('roadmap continuation locks 1.7', /Immediate continuation point[\s\S]*408-LOCAL-1\.7 — Insurance Conversion Bridge/.test(roadmap));
check('VERSION advanced to 1.6', fs.readFileSync(files.version,'utf8').trim() === '408-LOCAL-1.6');
check('sprint documentation is substantive', fs.statSync(files.sprint).size > 6000);

// Existing renderers remain callable after attribution module wiring.
check('directory renderer still exposes function', typeof LocalDirectory.renderMerchantCard === 'function');
check('merchant renderer still exposes function', typeof LocalMerchant.renderMerchantDetail === 'function');

const failed=checks.filter(c=>!c.passed);
const result={total:checks.length,passed:checks.length-failed.length,failed:failed.length,checks};
fs.writeFileSync(path.join(root,'LOCAL1_6_QA.json'),JSON.stringify(result,null,2));
console.log(`408-LOCAL-1.6 QA: ${result.passed}/${result.total} passed`);
if(failed.length){ for(const f of failed) console.error('FAIL',f.name); process.exit(1); }
