const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
function read(rel){ return fs.readFileSync(path.join(root, rel), 'utf8'); }
function assert(ok, msg){ if(!ok) throw new Error(msg); }
const profile = read('shared/prospect-profile.js');
const script = read('shared/script.js');
const launcher = read('shared/coveragefit-launch.js');
const home = read('home/index.html');
assert(profile.includes("coveragefit_prospect_profile_v1"), 'storage key missing');
assert(profile.includes('fromForm: build'), 'builder API missing');
assert(profile.includes("replace(/\\D/g, '')"), 'phone normalization missing');
assert(profile.includes('property_formatted_address'), 'canonical address missing');
assert(profile.includes('property_place_id'), 'structured address missing');
assert(script.includes('ProspectProfileBuilder.fromForm(form)'), 'form builder integration missing');
assert(script.includes('ProspectProfileBuilder.save(prospectProfile)'), 'session save missing');
assert(script.includes('profile: prospectProfile'), 'launcher profile argument missing');
assert(launcher.includes('profile: input.profile || null'), 'launcher profile config missing');
assert(!launcher.includes("searchParams.set('first_name'"), 'PII must not transfer in 1A');
assert(home.includes('../shared/prospect-profile.js'), 'profile script not loaded');
console.log('CF-INT-1A QA: 11/11 passed');
