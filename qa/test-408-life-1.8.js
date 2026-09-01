#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { pathToFileURL } = require('node:url');

const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const checks = [];
function check(name, value) { assert.ok(value, name); checks.push(name); }

class D1Statement {
  constructor(database, sql) { this.database = database; this.sql = sql; this.values = []; }
  bind(...values) { this.values = values; return this; }
  async run() {
    const result = this.database.prepare(this.sql).run(...this.values);
    return { meta:{ changes:Number(result.changes) } };
  }
  async all() { return { results:this.database.prepare(this.sql).all(...this.values) }; }
  async first() { return this.database.prepare(this.sql).get(...this.values) || null; }
}
class D1 {
  constructor() { this.database = new DatabaseSync(':memory:'); }
  async exec(sql) { this.database.exec(sql); return { count:0 }; }
  prepare(sql) { return new D1Statement(this.database, sql); }
}

async function loadWorker() {
  const source = read('_worker.js');
  const transformed = source.replace('export default {', 'const worker = {') + '\nexport { worker, normalize, queueInsert, loadQueueRow, loadCorePayload, loadSensitiveRow, handleQueueItemGet, handleSensitiveReveal, handleQueueStatus, purgeExpiredSensitive, BUILD, SCHEMA };\n';
  const temp = path.join(os.tmpdir(), `408-life18-${process.pid}-${Date.now()}.mjs`);
  fs.writeFileSync(temp, transformed);
  try { return await import(pathToFileURL(temp).href + '?v=' + Date.now()); }
  finally { fs.unlinkSync(temp); }
}

function attribution() {
  return { channel:'life_campaign', landing_variant:'before_anything_changes', creative_code:'A', utm_source:'direct', utm_medium:'direct', utm_campaign:'life_insurability', utm_content:'before_anything_changes', utm_term:'', campaign_id:'life-direct', campaign_variant:'A' };
}
function carrierPayload(id='11111111-1111-4111-8111-111111111111') {
  return {
    schema_version:'408-life-application-init-v2', submission_mode:'carrier_application_start', submission_id:id,
    attribution:attribution(),
    engagement:{ protection_priority:['family_income'], income_runway:'3_to_6_months', existing_life_coverage:'none' },
    applicant:{ first_name:'Maya', middle_name:'', last_name:'Chen', gender:'female', residential_address:'123 Private St', residential_address_2:'', residential_city:'Fremont', residential_state:'CA', residential_zip:'94539', email:'maya@example.com', phone:'4085551234' },
    sensitive:{ date_of_birth:'1990-01-02', ssn_last4:'0042' },
    acknowledgement:{ application_preparation:true, sensitive_use_notice:true },
    anti_bot:{ website:'', elapsed_ms:5000 }
  };
}
function followLaterPayload(id='22222222-2222-4222-8222-222222222222') {
  const payload = carrierPayload(id);
  payload.submission_mode = 'finish_with_dylan_later';
  payload.sensitive = { date_of_birth:'', ssn_last4:'' };
  payload.acknowledgement = { application_preparation:false, sensitive_use_notice:false };
  return payload;
}
function publicRequest(payload, version='2') {
  return new Request('https://408farmers.com/api/life/application-init', { method:'POST', headers:{ Origin:'https://408farmers.com', 'Sec-Fetch-Site':'same-origin', 'Content-Type':'application/json', 'X-Life-Request-Version':version }, body:JSON.stringify(payload) });
}
function opsRequest(pathname, method='GET', body) {
  const headers = { Origin:'https://408farmers.com', 'Sec-Fetch-Site':'same-origin', Accept:'application/json' };
  if (method !== 'GET') { headers['Content-Type']='application/json'; headers['X-Life-Ops-Action']='1'; }
  return new Request('https://408farmers.com' + pathname, { method, headers, body:body ? JSON.stringify(body) : undefined });
}

async function legacySeal(requestId, payload, keyBytes) {
  const key=await crypto.subtle.importKey('raw',keyBytes,{name:'AES-GCM'},false,['encrypt']);
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode('408-life-application-init-v1.'+requestId)},key,new TextEncoder().encode(JSON.stringify(payload)));
  return {ciphertext:Buffer.from(encrypted).toString('base64'),iv:Buffer.from(iv).toString('base64')};
}

(async () => {
  const workerSource=read('_worker.js'), life=read('life/index.html'), submit=read('shared/life-secure-submit.js'), intake=read('shared/life-intake.js'), ops=read('shared/life-ops.js'), opsHtml=read('life-ops/index.html'), privacy=read('privacy.html'), purgeSource=read('deployment/life-sensitive-purge-worker.mjs');
  check('release marker is forward-only LIFE-1.8', read('VERSION').includes('408-LIFE-1.8') && workerSource.includes("const BUILD = '408-LIFE-1.8'") && submit.includes("var BUILD = '408-LIFE-1.8'"));
  check('v2 browser and Worker contracts match', submit.includes("schema_version: '408-life-application-init-v2'") && submit.includes("'X-Life-Request-Version': '2'") && workerSource.includes("X-Life-Request-Version') || '') !== '2'"));
  check('basic finish-later action precedes carrier-required final step', life.indexOf('data-life-finish-later') < life.indexOf('name="date_of_birth"') && life.indexOf('name="date_of_birth"') < life.indexOf('name="ssn_last4"'));
  check('event-table mode disables application autocomplete', intake.includes("get('event') === 'table'") && intake.includes("setAttribute('autocomplete', 'off')"));
  check('browser transport sends sensitive values only in carrier mode', submit.includes("mode === 'carrier_application_start' ? text(form, 'date_of_birth') : ''") && submit.includes("mode === 'carrier_application_start' ? text(form, 'ssn_last4') : ''"));
  check('browser transport has no persistent sensitive storage or analytics', !/localStorage|sessionStorage|indexedDB|document\.cookie|dataLayer|gtag\(|fbq\(/i.test(submit));
  check('ordinary ops record does not render DOB or last four', !opsHtml.includes('data-life-detail="date_of_birth"') && !opsHtml.includes('data-life-detail="ssn_last4"'));
  check('ops requires explicit one-time reveal', opsHtml.includes('data-life-sensitive-reveal') && ops.includes("confirmation:'REVEAL_ONCE'") && ops.includes('window.confirm'));
  check('privacy notice states split-vault and exclusions', /encrypted separately in a short-lived vault/.test(privacy) && /AgencyZoom, CoverageFit, Formspree/.test(privacy) && /follow-up-only choice sends no date of birth or Social Security digits/i.test(privacy));
  check('companion purge Worker blanks ciphertext and IV', purgeSource.includes("status = 'expired', ciphertext = '', iv = ''") && read('deployment/wrangler.life-sensitive-purge.example.jsonc').includes('*/15 * * * *'));

  const mod = await loadWorker();
  check('Worker exposes v2 runtime contract', mod.BUILD==='408-LIFE-1.8' && mod.SCHEMA==='408-life-application-init-v2');
  const normalizedCarrier = mod.normalize(carrierPayload());
  check('carrier payload normalizes with bounded sensitive object', normalizedCarrier && normalizedCarrier.sensitive.ssn_last4==='0042' && normalizedCarrier.submission_mode==='carrier_application_start');
  const normalizedLater = mod.normalize(followLaterPayload());
  check('follow-later payload normalizes without sensitive values', normalizedLater && normalizedLater.sensitive.date_of_birth==='' && normalizedLater.sensitive.ssn_last4==='');
  const polluted = followLaterPayload(); polluted.sensitive.ssn_last4='0042';
  check('follow-later mode rejects sensitive values', mod.normalize(polluted)===null);
  const fullSsn = carrierPayload(); fullSsn.sensitive.full_ssn='123456789';
  check('unexpected full SSN is rejected by exact-key validation', mod.normalize(fullSsn)===null);

  const db = new D1();
  const rootKey=Buffer.alloc(32,7);
  const env = { LIFE_ALLOWED_ORIGIN:'https://408farmers.com', LIFE_QUEUE_DB:db, LIFE_QUEUE_ENCRYPTION_KEY_B64:rootKey.toString('base64'), ASSETS:{ fetch:async request=>new Response(new URL(request.url).pathname) } };
  const tasks=[];
  const response = await mod.worker.fetch(publicRequest(carrierPayload()), env, { waitUntil(task){ tasks.push(Promise.resolve(task)); } });
  const publicText=await response.text();
  await Promise.all(tasks);
  check('carrier start returns generic 202 without PII', response.status===202 && JSON.parse(publicText).sensitive_status==='ready' && !publicText.includes('Maya') && !publicText.includes('0042'));
  const coreRow=await mod.loadQueueRow(carrierPayload().submission_id,env), core=await mod.loadCorePayload(coreRow,env), vault=await mod.loadSensitiveRow(carrierPayload().submission_id,env);
  check('core ciphertext decrypts without DOB or Social digits', !Object.prototype.hasOwnProperty.call(core,'sensitive') && !JSON.stringify(core).includes('1990-01-02') && !JSON.stringify(core).includes('0042'));
  check('separate vault stores ciphertext and 72-hour metadata', vault && vault.status==='ready' && vault.ciphertext && !vault.ciphertext.includes('0042') && new Date(vault.expires_at)>new Date(vault.created_at));
  check('core and vault are idempotent for duplicate submission id', (await mod.worker.fetch(publicRequest(carrierPayload()),env,{waitUntil(){}})).status===202 && db.database.prepare('SELECT COUNT(*) AS n FROM life_application_queue').get().n===1 && db.database.prepare('SELECT COUNT(*) AS n FROM life_application_sensitive').get().n===1);

  const detailResponse=await mod.handleQueueItemGet(opsRequest('/api/life/producer/item?id='+carrierPayload().submission_id),env,{email:'dylan@example.com'}), detailText=await detailResponse.text(), detail=JSON.parse(detailText);
  check('ordinary producer detail omits sensitive values', detailResponse.status===200 && detail.item.applicant.first_name==='Maya' && detail.item.sensitive.status==='ready' && !detailText.includes('1990-01-02') && !detailText.includes('0042'));

  const revealBody={request_id:carrierPayload().submission_id,confirmation:'REVEAL_ONCE'};
  const revealResponse=await mod.handleSensitiveReveal(opsRequest('/api/life/producer/sensitive-reveal','POST',revealBody),env,{email:'dylan@example.com'}), reveal=await revealResponse.json();
  check('authorized reveal returns carrier-required values once', revealResponse.status===200 && reveal.sensitive.date_of_birth==='1990-01-02' && reveal.sensitive.ssn_last4==='0042' && reveal.status==='revealed');
  const secondReveal=await mod.handleSensitiveReveal(opsRequest('/api/life/producer/sensitive-reveal','POST',revealBody),env,{email:'dylan@example.com'});
  check('second reveal is denied', secondReveal.status===409);

  const statusResponse=await mod.handleQueueStatus(opsRequest('/api/life/producer/status','POST',{request_id:carrierPayload().submission_id,status:'initiated'}),env,{email:'dylan@example.com'}), status=await statusResponse.json(), destroyed=await mod.loadSensitiveRow(carrierPayload().submission_id,env);
  check('initiated status destroys remaining sensitive ciphertext', statusResponse.status===200 && status.sensitive.status==='destroyed' && destroyed.status==='destroyed' && destroyed.ciphertext==='' && destroyed.iv==='');

  await mod.queueInsert(normalizedLater,env);
  check('finish-later creates core queue record but no sensitive vault', await mod.loadQueueRow(followLaterPayload().submission_id,env) && await mod.loadSensitiveRow(followLaterPayload().submission_id,env)===null);

  const expiryId='33333333-3333-4333-8333-333333333333';
  await mod.queueInsert(mod.normalize(carrierPayload(expiryId)),env);
  db.database.prepare("UPDATE life_application_sensitive SET expires_at='2000-01-01T00:00:00.000Z' WHERE request_id=?").run(expiryId);
  await mod.purgeExpiredSensitive(env);
  const expired=await mod.loadSensitiveRow(expiryId,env);
  check('expiry purge permanently blanks vault ciphertext', expired.status==='expired' && expired.ciphertext==='' && expired.iv==='' && !!expired.destroyed_at);

  const legacyId='66666666-6666-4666-8666-666666666666', legacyNormalized=mod.normalize(carrierPayload(legacyId));
  const legacyPayload=JSON.parse(JSON.stringify(legacyNormalized));
  legacyPayload.schema_version='408-life-application-init-v1'; delete legacyPayload.submission_mode; delete legacyPayload.sensitive;
  legacyPayload.applicant.date_of_birth='1990-01-02'; legacyPayload.applicant.ssn_last4='0042'; legacyPayload.acknowledgement=true;
  const legacyEncrypted=await legacySeal(legacyId,legacyPayload,rootKey);
  db.database.prepare("INSERT INTO life_application_queue (request_id,status,created_at,updated_at,ciphertext,iv) VALUES (?,?,?,?,?,?)").run(legacyId,'new',new Date().toISOString(),new Date().toISOString(),legacyEncrypted.ciphertext,legacyEncrypted.iv);
  const legacyRow=await mod.loadQueueRow(legacyId,env), migratedCore=await mod.loadCorePayload(legacyRow,env), migratedVault=await mod.loadSensitiveRow(legacyId,env);
  check('legacy inline-sensitive row migrates forward on authorized read', migratedCore.schema_version==='408-life-application-init-v2' && migratedCore.submission_mode==='carrier_application_start' && migratedVault && migratedVault.status==='ready');
  check('legacy migration strips DOB and last four from core ciphertext', !JSON.stringify(migratedCore).includes('1990-01-02') && !JSON.stringify(migratedCore).includes('0042'));

  const badVersion=await mod.worker.fetch(publicRequest(carrierPayload('44444444-4444-4444-8444-444444444444'),'1'),env,{waitUntil(){}});
  check('legacy public request version is rejected', badVersion.status===400);
  const badOriginPayload=carrierPayload('55555555-5555-4555-8555-555555555555');
  const badOrigin=new Request('https://408farmers.com/api/life/application-init',{method:'POST',headers:{Origin:'https://evil.example','Content-Type':'application/json','X-Life-Request-Version':'2'},body:JSON.stringify(badOriginPayload)});
  check('wrong-origin public submission remains rejected', (await mod.worker.fetch(badOrigin,env,{waitUntil(){}})).status===403);

  const report={ sprint:'408-LIFE-1.8', passed:checks.length, failed:0, checks };
  fs.writeFileSync(path.join(root,'LIFE1_8_QA.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
})().catch(error=>{ console.error(error.stack||error); process.exit(1); });
