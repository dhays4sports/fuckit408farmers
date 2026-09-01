import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(root,p),'utf8');
const routes = JSON.parse(read('_routes.json'));
let pass=0;
function check(name,fn){ fn(); pass++; console.log('PASS',name); }
function match(pattern,pathname){
  if (!pattern.includes('*')) return pathname===pattern;
  const prefix=pattern.slice(0,pattern.indexOf('*'));
  return pathname.startsWith(prefix);
}
function invokes(pathname){
  const included=routes.include.some(p=>match(p,pathname));
  const excluded=routes.exclude.some(p=>match(p,pathname));
  return included && !excluded;
}
check('_routes schema is version 1',()=>assert.equal(routes.version,1));
check('API remains Function-owned',()=>assert.equal(invokes('/api/lead'),true));
check('Life producer API remains Function-owned',()=>assert.equal(invokes('/api/life/producer/queue'),true));
check('Home no-slash canonical redirect remains Function-owned',()=>assert.equal(invokes('/home'),true));
check('Home QR remains Function-owned',()=>assert.equal(invokes('/home/qr/95118/rate/'),true));
check('Home campaign remains Function-owned',()=>assert.equal(invokes('/home/campaign/home_flyer_95118_rate/'),true));
check('Neighbor referral remains Function-owned',()=>assert.equal(invokes('/neighbor/r/ref_ABCDEFGHIJKLMNOP'),true));
check('Local merchant remains Function-owned',()=>assert.equal(invokes('/local/example-merchant/'),true));
check('legacy Home redirect remains Function-owned',()=>assert.equal(invokes('/home/Wowindex.html'),true));
check('homepage is static',()=>assert.equal(invokes('/'),false));
check('canonical Home page is static',()=>assert.equal(invokes('/home/'),false));
check('canonical Contact page is static',()=>assert.equal(invokes('/contact/'),false));
check('canonical Buyer page is static',()=>assert.equal(invokes('/buyer/'),false));
check('canonical professional page is static',()=>assert.equal(invokes('/teachers/'),false));
check('shared assets are static',()=>assert.equal(invokes('/shared/styles.css'),false));
check('images are static',()=>assert.equal(invokes('/shared/assets/home.jpg'),false));
check('crawler contact stack is static',()=>assert.equal(invokes('/contact/healthcare/teachers/shared/tech/auto-bundle/'),false));
check('crawler buyer stack is static',()=>assert.equal(invokes('/buyer/shared/tech/teachers/life/auto-bundle/'),false));
check('crawler professional stack is static',()=>assert.equal(invokes('/teachers/healthcare/shared/tech/'),false));
check('random nonexistent route is static',()=>assert.equal(invokes('/this/does/not/exist/'),false));
check('routes remain below Cloudflare 100-rule limit',()=>assert.ok(routes.include.length + routes.exclude.length <= 100));
check('worker is still Advanced Mode and asset-forwarding',()=>{
  const worker=read('_worker.js');
  assert.ok(worker.includes('env.ASSETS.fetch(request)'));
  assert.ok(worker.includes("path.startsWith('/home/qr/')"));
  assert.ok(worker.includes("path.startsWith('/neighbor/r/')"));
});
console.log(`408-INFRA-1.1 QA: ${pass}/${pass} PASS`);
