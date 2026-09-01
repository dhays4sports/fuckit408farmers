import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const source = fs.readFileSync(path.join(root, '_worker.js'), 'utf8');
const dataUrl = 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
const mod = await import(dataUrl);
const worker = mod.default;
const originalFetch = globalThis.fetch;
const checks = [];
function check(name, condition) { checks.push({name, passed:Boolean(condition)}); assert.ok(condition, name); }

function fields(overrides={}) {
  return Object.assign({
    business_name:'Stevie Test',
    category:'eat-drink',
    business_location:'Willow Glen, San Jose, CA',
    website_social:'https://example.com',
    contact_name:'Pat Owner',
    email:'pat@example.com',
    phone:'408-555-1212',
    proposed_perk:'Complimentary appetizer with qualifying purchase',
    notes:'Pilot application',
    authorized_ack:'yes',
    separation_ack:'yes',
    source:'408farmers.com/local/join',
    campaign:'408FARMERS Local Merchant Pilot',
    landing_page:'https://408farmers.com/local/join/?utm_source=test',
    submitted_at:'2026-08-16T08:00:00.000Z',
    utm_source:'test', utm_medium:'qr', utm_campaign:'local', utm_content:'join', utm_term:''
  }, overrides);
}
function request(method='POST', override={}, origin='https://408farmers.com') {
  const body = new URLSearchParams(fields(override));
  return new Request('https://408farmers.com/api/local/merchant-application', {
    method,
    headers: {
      'Origin': origin,
      'Sec-Fetch-Site': origin === 'https://408farmers.com' ? 'same-origin' : 'cross-site',
      'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'
    },
    body: method === 'POST' ? body : undefined
  });
}
const env = { ASSETS:{fetch: async()=>new Response('asset',{status:200})} };
let upstream = [];
globalThis.fetch = async (url, init) => {
  upstream.push({url:String(url), init, body:String(init?.body || '')});
  return new Response(JSON.stringify({ok:true}), {status:200, headers:{'content-type':'application/json'}});
};

let response = await worker.fetch(request(), env);
check('valid merchant application returns 200', response.status === 200);
const payload = await response.json();
check('valid response identifies Formspree delivery', payload.ok === true && payload.delivery === 'formspree' && payload.build === '408-LOCAL-1.5');
check('valid request performs one upstream delivery', upstream.length === 1);
check('default upstream uses production Formspree endpoint', upstream[0].url === 'https://formspree.io/f/mojgnegn');
const sent = new URLSearchParams(upstream[0].body);
check('server fixes merchant application subject', sent.get('_subject') === '408FARMERS Local Merchant Application');
check('server adds application build', sent.get('application_build') === '408-LOCAL-1.5');
check('server preserves business/contact/perk fields', sent.get('business_name') === 'Stevie Test' && sent.get('email') === 'pat@example.com' && sent.get('proposed_perk').startsWith('Complimentary'));
check('server preserves no-insurance acknowledgment', sent.get('separation_ack') === 'yes');
check('server supplies Local join referrer', upstream[0].init.headers.Referer === 'https://408farmers.com/local/join/');

upstream = [];
response = await worker.fetch(request('POST', {}, 'https://evil.example'), env);
check('cross-origin request is rejected', response.status === 403 && upstream.length === 0);
response = await worker.fetch(request('GET'), env);
check('GET request is rejected', response.status === 405);
response = await worker.fetch(request('POST', {_gotcha:'bot'}), env);
check('honeypot request is rejected', response.status === 400);
response = await worker.fetch(request('POST', {category:'unsupported'}), env);
check('unsupported category is rejected', response.status === 400);
response = await worker.fetch(request('POST', {email:'bad'}), env);
check('invalid email is rejected', response.status === 400);
response = await worker.fetch(request('POST', {phone:'123'}), env);
check('invalid phone is rejected', response.status === 400);
response = await worker.fetch(request('POST', {separation_ack:''}), env);
check('missing insurance-separation acknowledgment is rejected', response.status === 400);
response = await worker.fetch(request('POST', {website_social:'javascript:alert(1)'}), env);
check('unsafe website scheme is rejected', response.status === 400);

upstream = [];
const overrideEnv = {...env, LOCAL_MERCHANT_FORMSPREE_ENDPOINT:'https://formspree.io/f/localtest'};
response = await worker.fetch(request(), overrideEnv);
check('dedicated merchant Formspree endpoint override is honored', response.status === 200 && upstream[0].url === 'https://formspree.io/f/localtest');

upstream = [];
globalThis.fetch = async () => new Response('upstream fail',{status:503});
response = await worker.fetch(request(), env);
check('upstream delivery failure fails closed', response.status === 503);
const failedPayload = await response.json();
check('upstream delivery failure returns bounded error', failedPayload.ok === false && failedPayload.error === 'merchant_application_delivery_failed');

globalThis.fetch = originalFetch;
const failed = checks.filter((x)=>!x.passed);
const report = {total:checks.length, passed:checks.length-failed.length, failed:failed.length, checks};
fs.writeFileSync(path.join(root,'LOCAL1_5_WORKER_QA.json'), JSON.stringify(report,null,2));
console.log(`408-LOCAL-1.5 Worker QA: ${report.passed}/${report.total} passed`);
if (failed.length) process.exit(1);
