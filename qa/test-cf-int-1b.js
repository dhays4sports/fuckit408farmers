const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..');
function read(rel){ return fs.readFileSync(path.join(root, rel), 'utf8'); }
function assert(ok, msg){ if(!ok) throw new Error(msg); }

const launcherSource = read('shared/coveragefit-launch.js');
const script = read('shared/script.js');
assert(launcherSource.includes("firstName: 'first_name'"), 'first name mapping missing');
assert(launcherSource.includes("propertyAddress: 'property_address'"), 'property address mapping missing');
assert(launcherSource.includes("placeId: 'property_place_id'"), 'place id mapping missing');
assert(launcherSource.includes("url.searchParams.set('prefill', '1')"), 'prefill marker missing');
assert(launcherSource.includes("url.searchParams.set('handoff_version', '1')"), 'handoff version missing');
assert(script.includes("keepalive:true"), 'Formspree keepalive delivery missing');
assert(script.includes("continueToCoverageFit(leadCaptureStatus)"), 'CoverageFit must continue after bounded lead submission');
assert(script.includes("button.disabled=true"), 'double-submit guard missing');

const storage = new Map();
const window = {
  location: { search: '', pathname: '/home/', origin: 'https://408farmers.com', assign(){} },
  sessionStorage: { setItem(k,v){storage.set('s:'+k,v)}, getItem(k){return storage.get('s:'+k)||null}, removeItem(k){storage.delete('s:'+k)} },
  localStorage: { setItem(k,v){storage.set('l:'+k,v)}, getItem(k){return storage.get('l:'+k)||null}, removeItem(k){storage.delete('l:'+k)} },
  crypto: { randomUUID(){return 'session-123'} },
  dataLayer: [],
  CustomEvent: function(name, opts){ this.type=name; this.detail=opts.detail; },
  LANDING_PAGE_CONFIG: { coverageFitHomeUrl: 'https://coveragefit.com/home/' },
  CFCampaign: { current: 'door_hanger' }
};
const document = { readyState: 'complete', querySelectorAll(){return []}, dispatchEvent(){}, addEventListener(){} };
const context = vm.createContext({ window, document, URL, URLSearchParams, console, Object, Math, Date, String });
vm.runInContext(launcherSource, context);
const profile = {
  firstName:' Dylan ', lastName:'Haysbert', phone:'4083276377', email:'dylan@example.com',
  propertyAddress:'123 Main St, Fremont, CA 94539', reviewContext:'renewal',
  address:{city:'Fremont', state:'CA', postalCode:'94539', placeId:'abc123', selectionMethod:'autocomplete'}
};
const url = new URL(window.CoverageFitLauncher.buildUrl({profile, entry:'home_lander_form'}));
assert(url.searchParams.get('first_name') === 'Dylan', 'first name not serialized');
assert(url.searchParams.get('last_name') === 'Haysbert', 'last name not serialized');
assert(url.searchParams.get('phone') === '4083276377', 'phone not serialized');
assert(url.searchParams.get('email') === 'dylan@example.com', 'email not serialized');
assert(url.searchParams.get('property_address') === '123 Main St, Fremont, CA 94539', 'address not serialized');
assert(url.searchParams.get('property_city') === 'Fremont', 'city not serialized');
assert(url.searchParams.get('property_place_id') === 'abc123', 'place id not serialized');
assert(url.searchParams.get('prefill') === '1', 'prefill marker absent');
assert(url.searchParams.get('handoff_version') === '1', 'handoff version absent');
assert(!url.searchParams.has('full_name'), 'unapproved profile fields must not serialize');
console.log('CF-INT-1B QA: 18/18 passed');
