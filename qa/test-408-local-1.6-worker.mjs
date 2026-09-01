import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const source = fs.readFileSync(path.join(root, '_worker.js'), 'utf8');
const dataUrl = 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
const mod = await import(dataUrl);
const worker = mod.default;
const checks = [];
function check(name, condition) { checks.push({name, passed:Boolean(condition)}); assert.ok(condition, name); }

const uuidA = '123e4567-e89b-42d3-a456-426614174000';
const uuidB = '123e4567-e89b-42d3-a456-426614174001';

function payload(overrides = {}, contextOverrides = {}) {
  return {
    schema_version: '408-local-event-v1',
    event_id: uuidA,
    session_id: uuidB,
    event_name: 'merchant_view',
    occurred_at: '2026-08-16T07:30:00.000Z',
    context: {
      source: 'local',
      partner_id: 'stevies',
      perk_id: 'stevies-appetizer',
      merchant_slug: 'stevies',
      surface: 'coaster_table',
      campaign: 'local_perks',
      variant: 'coaster_v1',
      utm_source: 'stevies',
      utm_medium: 'coaster',
      utm_campaign: 'local_perks',
      utm_content: 'coaster_v1',
      utm_term: '',
      origin_partner_id: 'stevies',
      origin_perk_id: 'stevies-appetizer',
      origin_merchant_slug: 'stevies',
      origin_surface: 'coaster_table',
      route: '/local/stevies/',
      destination: 'other',
      ...contextOverrides
    },
    ...overrides
  };
}

function request(method='POST', data=payload(), origin='https://408farmers.com', headers={}) {
  return new Request('https://408farmers.com/api/local/event', {
    method,
    headers: {
      'Origin': origin,
      'Sec-Fetch-Site': origin === 'https://408farmers.com' ? 'same-origin' : 'cross-site',
      'Content-Type':'application/json',
      'X-Local-Event-Version':'1',
      ...headers
    },
    body: method === 'POST' ? JSON.stringify(data) : undefined
  });
}

class FakeD1 {
  constructor(changes=1, fail=false) {
    this.changes = changes;
    this.fail = fail;
    this.execCalls = [];
    this.prepared = [];
    this.bindCalls = [];
  }
  async exec(sql) {
    if (this.fail) throw new Error('d1 failure');
    this.execCalls.push(String(sql));
    return {count:1};
  }
  prepare(sql) {
    if (this.fail) throw new Error('d1 failure');
    this.prepared.push(String(sql));
    return {
      bind: (...args) => {
        this.bindCalls.push(args);
        return { run: async () => {
          if (this.fail) throw new Error('d1 failure');
          return {meta:{changes:this.changes}};
        }};
      }
    };
  }
}

const baseAssets = {fetch: async()=>new Response('asset',{status:200})};

let db = new FakeD1();
let response = await worker.fetch(request(), {ASSETS:baseAssets, LOCAL_ANALYTICS_DB:db});
check('valid Local event returns 202', response.status === 202);
let body = await response.json();
check('valid response reports 1.6 and persistence', body.ok === true && body.build === '408-LOCAL-1.6' && body.persisted === true);
check('Local event schema is ensured', db.execCalls.length === 1 && db.execCalls[0].includes('CREATE TABLE IF NOT EXISTS local_attribution_events'));
check('Local event insert uses dedicated table', db.prepared.length === 1 && db.prepared[0].includes('INSERT INTO local_attribution_events'));
check('Local event insert binds 23 bounded fields', db.bindCalls.length === 1 && db.bindCalls[0].length === 23);
check('Local event insert binds partner/perk/surface', db.bindCalls[0][6] === 'stevies' && db.bindCalls[0][7] === 'stevies-appetizer' && db.bindCalls[0][9] === 'coaster_table');
check('Local event insert retains route and destination', db.bindCalls[0][21] === '/local/stevies/' && db.bindCalls[0][22] === 'other');

response = await worker.fetch(request('GET'), {ASSETS:baseAssets, LOCAL_ANALYTICS_DB:new FakeD1()});
check('GET is rejected', response.status === 405);
response = await worker.fetch(request('POST', payload(), 'https://evil.example'), {ASSETS:baseAssets, LOCAL_ANALYTICS_DB:new FakeD1()});
check('cross-origin event is rejected', response.status === 403);
response = await worker.fetch(request('POST', payload(), 'https://408farmers.com', {'X-Local-Event-Version':''}), {ASSETS:baseAssets, LOCAL_ANALYTICS_DB:new FakeD1()});
check('missing event protocol version is rejected', response.status === 400);
response = await worker.fetch(request('POST', payload(), 'https://408farmers.com', {'Content-Type':'text/plain'}), {ASSETS:baseAssets, LOCAL_ANALYTICS_DB:new FakeD1()});
check('non-JSON content type is rejected', response.status === 415);

response = await worker.fetch(request('POST', payload({event_name:'made_up_event'})), {ASSETS:baseAssets, LOCAL_ANALYTICS_DB:new FakeD1()});
check('unknown event name is rejected', response.status === 400);
response = await worker.fetch(request('POST', payload({}, {partner_id:'pat@example.com'})), {ASSETS:baseAssets, LOCAL_ANALYTICS_DB:new FakeD1()});
check('PII-like free text cannot enter partner ID', response.status === 400);
response = await worker.fetch(request('POST', payload({}, {source:'insurance'})), {ASSETS:baseAssets, LOCAL_ANALYTICS_DB:new FakeD1()});
check('non-Local source is rejected', response.status === 400);
response = await worker.fetch(request('POST', payload({}, {route:'/home/'})), {ASSETS:baseAssets, LOCAL_ANALYTICS_DB:new FakeD1()});
check('non-Local route is rejected', response.status === 400);

const withExtraContext = payload();
withExtraContext.context.email = 'pat@example.com';
response = await worker.fetch(request('POST', withExtraContext), {ASSETS:baseAssets, LOCAL_ANALYTICS_DB:new FakeD1()});
check('extra context keys are rejected', response.status === 400);
const withExtraTop = payload();
withExtraTop.email = 'pat@example.com';
response = await worker.fetch(request('POST', withExtraTop), {ASSETS:baseAssets, LOCAL_ANALYTICS_DB:new FakeD1()});
check('extra top-level keys are rejected', response.status === 400);

response = await worker.fetch(request('POST', payload({event_name:'insurance_cta_click'})), {ASSETS:baseAssets, LOCAL_ANALYTICS_DB:new FakeD1()});
check('insurance CTA cannot use destination other', response.status === 400);
response = await worker.fetch(request('POST', payload({event_name:'insurance_cta_click'}, {destination:'home'})), {ASSETS:baseAssets, LOCAL_ANALYTICS_DB:new FakeD1()});
check('insurance CTA accepts certified home destination', response.status === 202 && (await response.json()).persisted === true);
response = await worker.fetch(request('POST', payload({event_name:'insurance_cta_click'}, {destination:'auto_bundle'})), {ASSETS:baseAssets, LOCAL_ANALYTICS_DB:new FakeD1()});
check('insurance CTA accepts certified home-auto destination', response.status === 202);

response = await worker.fetch(request('POST', payload()), {ASSETS:baseAssets});
body = await response.json();
check('analytics route remains nonblocking without D1 binding', response.status === 202 && body.ok === true && body.persisted === false);

response = await worker.fetch(request('POST', payload()), {ASSETS:baseAssets, LOCAL_ANALYTICS_DB:new FakeD1(1,true)});
body = await response.json();
check('analytics route remains nonblocking on D1 failure', response.status === 202 && body.ok === true && body.persisted === false);

const fallbackDb = new FakeD1();
response = await worker.fetch(request('POST', payload()), {ASSETS:baseAssets, LIFE_QUEUE_DB:fallbackDb});
body = await response.json();
check('LIFE_QUEUE_DB can serve as optional Local analytics fallback', response.status === 202 && body.persisted === true && fallbackDb.bindCalls.length === 1);

const duplicateDb = new FakeD1(0);
response = await worker.fetch(request('POST', payload()), {ASSETS:baseAssets, LOCAL_ANALYTICS_DB:duplicateDb});
body = await response.json();
check('duplicate event ID is accepted idempotently without claiming new persistence', response.status === 202 && body.ok === true && body.persisted === false);

for (const eventName of ['local_view','merchant_view','perk_open','perk_redeem_intent']) {
  const eventPayload = payload({event_name:eventName});
  response = await worker.fetch(request('POST', eventPayload), {ASSETS:baseAssets, LOCAL_ANALYTICS_DB:new FakeD1()});
  check(`${eventName} is accepted`, response.status === 202);
}

const tooLarge = payload({}, {variant:'x'.repeat(7000)});
response = await worker.fetch(request('POST', tooLarge), {ASSETS:baseAssets, LOCAL_ANALYTICS_DB:new FakeD1()});
check('oversized payload is rejected', response.status === 413 || response.status === 400);

const failed = checks.filter((x)=>!x.passed);
const report = {sprint:'408-LOCAL-1.6', suite:'worker', total:checks.length, passed:checks.length-failed.length, failed:failed.length, checks};
fs.writeFileSync(path.join(root,'LOCAL1_6_WORKER_QA.json'), JSON.stringify(report,null,2));
console.log(`408-LOCAL-1.6 Worker QA: ${report.passed}/${report.total} passed`);
if (failed.length) process.exit(1);
