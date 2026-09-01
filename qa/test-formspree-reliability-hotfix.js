const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
let passed=0, failed=0;
function check(name, cond){ if(cond){console.log('PASS',name);passed++;} else {console.error('FAIL',name);failed++;} }
const pages=['home/index.html','buyer/index.html','auto-bundle/index.html','healthcare/index.html','teachers/index.html','tech/index.html','engineers/index.html'];
for(const page of pages){ const html=read(page); check(page+' has native Formspree fallback action', /<form[^>]+action="https:\/\/formspree\.io\/f\/mojgnegn"[^>]+id="leadForm"|<form[^>]+id="leadForm"[^>]+action="https:\/\/formspree\.io\/f\/mojgnegn"/.test(html)); }
const config=read('shared/config.js');
check('config exposes same-origin lead proxy', config.includes('leadProxyEndpoint: "/api/lead"'));
check('config preserves direct Formspree endpoint', config.includes('https://formspree.io/f/mojgnegn'));
const script=read('shared/script.js');
check('submission awaits confirmed transport instead of 900 ms race', script.includes('await submitLead()') && !script.includes('LEAD_SUBMISSION_GRACE_MS') && !script.includes('Promise.race'));
check('submission no longer uses fetch keepalive', !script.includes('keepalive:true') && !script.includes('keepalive: true'));
check('submission tries proxy then direct Formspree', script.indexOf('await postLead(proxyEndpoint)') < script.indexOf('await postLead(directEndpoint)'));
check('submission exposes native fallback', script.includes('HTMLFormElement.prototype.submit.call(form)'));
check('submission surfaces delivery failure instead of silently continuing', script.includes('We could not confirm the online submission'));
const worker=read('_worker.js');
check('worker exposes /api/lead', worker.includes("const LEAD_PROXY_PATH = '/api/lead'") && worker.includes('handleLeadProxy'));
check('worker relays conventional urlencoded form body', worker.includes('new URLSearchParams()') && worker.includes('application/x-www-form-urlencoded;charset=UTF-8'));
check('worker supplies canonical Formspree Referer', worker.includes("'Referer': 'https://408farmers.com/'"));
check('worker routes lead API before static assets', worker.indexOf('url.pathname === LEAD_PROXY_PATH') < worker.indexOf('pageAssetRoute(url.pathname)'));
console.log(JSON.stringify({passed,failed},null,2));
process.exit(failed?1:0);
