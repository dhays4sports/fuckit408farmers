const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');

const workerPath = pathToFileURL(path.resolve(__dirname,'../_worker.js')).href;
const form = () => new URLSearchParams({
  lead_checkpoint_id:'408d_1234567890abcdef1234567890abcdef', lead_stage:'started',
  first_name:'Maya', phone:'4085551234', consent:'on', contact_consent_state:'granted',
  contact_consent_version:'408farmers-agency-contact-v2', contact_consent_timestamp:'2026-08-29T12:00:00.000Z',
  automated_marketing_sms_consent:'granted', automated_marketing_sms_consent_state:'granted',
  automated_marketing_sms_consent_version:'408farmers-automated-marketing-sms-v1', automated_marketing_sms_consent_timestamp:'2026-08-29T12:00:00.000Z',
  submitted_at:'2026-08-29T12:00:00.000Z', review_track:'home', housing_context:'homeowner',
  landing_page:'https://408farmers.com/home/'
});
const request = () => new Request('https://408farmers.com/api/lead',{
  method:'POST', headers:{ Origin:'https://408farmers.com','Sec-Fetch-Site':'same-origin','Content-Type':'application/x-www-form-urlencoded' }, body:form()
});

test('same-origin relay prefers durable CoverageFit delivery and never sends PII in URL', async () => {
  const original = global.fetch, calls=[];
  global.fetch = async (url,init) => { calls.push({url:String(url),init}); return Response.json({ok:true,durable:true,checkpointId:'408d_1234567890abcdef1234567890abcdef',crm:{state:'pending'}},{status:201}); };
  try {
    const worker = (await import(`${workerPath}?primary=${Date.now()}`)).default;
    const response = await worker.fetch(request(),{ COVERAGEFIT_LEAD_SYNC_SECRET:'test-secret-that-is-longer-than-thirty-two-characters', ASSETS:{fetch:original} });
    const body = await response.json();
    assert.equal(response.status,200); assert.equal(body.delivery,'coveragefit_d1'); assert.equal(body.durable,true);
    assert.equal(calls.length,1); assert.equal(calls[0].url,'https://coveragefit.com/api/lead/intake');
    assert.equal(calls[0].url.includes('Maya'),false); assert.ok(calls[0].init.headers['X-CoverageFit-Signature']);
    const payload=JSON.parse(calls[0].init.body);
    assert.equal(payload.automated_marketing_sms_consent,'granted');
    assert.equal(payload.automated_marketing_sms_consent_version,'408farmers-automated-marketing-sms-v1');
    assert.equal(payload.automated_marketing_sms_consent_timestamp,'2026-08-29T12:00:00.000Z');
  } finally { global.fetch = original; }
});

test('Formspree remains the independent fallback when durable delivery is unavailable', async () => {
  const original = global.fetch, calls=[];
  global.fetch = async (url,init) => {
    calls.push(String(url));
    if (String(url).includes('coveragefit.com')) return Response.json({ok:false},{status:503});
    return Response.json({ok:true},{status:200});
  };
  try {
    const worker = (await import(`${workerPath}?fallback=${Date.now()}`)).default;
    const response = await worker.fetch(request(),{ COVERAGEFIT_LEAD_SYNC_SECRET:'test-secret-that-is-longer-than-thirty-two-characters', ASSETS:{fetch:original} });
    const body = await response.json();
    assert.equal(body.delivery,'formspree_fallback'); assert.equal(body.durable,false);
    assert.deepEqual(calls,['https://coveragefit.com/api/lead/intake','https://formspree.io/f/mojgnegn']);
  } finally { global.fetch = original; }
});

test('cross-origin lead submissions remain rejected before any transport', async () => {
  const worker = (await import(`${workerPath}?origin=${Date.now()}`)).default;
  const bad = new Request('https://408farmers.com/api/lead',{method:'POST',headers:{Origin:'https://evil.example','Content-Type':'application/x-www-form-urlencoded'},body:form()});
  const response = await worker.fetch(bad,{ASSETS:{fetch:global.fetch}});
  assert.equal(response.status,403);
});

test('every lead form exposes separate optional automated marketing SMS consent', () => {
  const routes=['tech','home','buyer','engineers','auto-bundle','teachers','healthcare'];
  for (const route of routes) {
    const html=fs.readFileSync(path.resolve(__dirname,`../${route}/index.html`),'utf8');
    const checkbox=html.match(/<input[^>]*name="automated_marketing_sms_consent"[^>]*>/)?.[0] || '';
    assert.ok(checkbox,`${route} marketing checkbox`);
    assert.equal(/\brequired\b/.test(checkbox),false,`${route} remains optional`);
    assert.equal(/\bchecked\b/.test(checkbox),false,`${route} remains unchecked`);
    assert.match(html,/Virginia Tam Insurance Agency, Inc\./);
    assert.match(html,/Consent is not a condition of purchase\./);
    assert.match(html,/Reply STOP to opt out; HELP for help\./);
    assert.match(html,/name="automated_marketing_sms_consent_version"[^>]*value="408farmers-automated-marketing-sms-v1"/);
    assert.match(html,/name="consent"[^>]*required/);
  }
});
