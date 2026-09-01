'use strict';
const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const rel = p => path.join(root, p);
const read = p => fs.readFileSync(rel(p), 'utf8');
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(rel(p))).digest('hex');
const shaText = text => crypto.createHash('sha256').update(text).digest('hex');

const required = [
  'index.html','shared/local-site-integration.css','SPRINT-408-LOCAL-1.8.md',
  'LOCAL1_8_SITE_INTEGRATION_CONTRACT.json','LOCAL1_8_MARKUP_QA.json','LOCAL1_8_RELEASE_CERTIFICATION.json','408-LOCAL-ROADMAP.md','ROADMAP.md','CHANGELOG.md','README.txt','VERSION',
  'local/index.html','local/detail/index.html','local/data/catalog.json','local/data/catalog.schema.json',
  'shared/local-attribution.js','shared/local-merchant.js','shared/local-directory.js','shared/local-data-model.js','shared/local-join.js',
  'shared/script.js','shared/coveragefit-launch.js','_worker.js','LOCAL1_7_RELEASE_CERTIFICATION.json'
];
required.forEach(p => assert(fs.existsSync(rel(p)), `missing ${p}`));

const homepage = read('index.html');
const css = read('shared/local-site-integration.css');
const roadmap = read('408-LOCAL-ROADMAP.md');
const rootRoadmap = read('ROADMAP.md');
const changelog = read('CHANGELOG.md');
const readme = read('README.txt');
const contract = JSON.parse(read('LOCAL1_8_SITE_INTEGRATION_CONTRACT.json'));
const release17 = JSON.parse(read('LOCAL1_7_RELEASE_CERTIFICATION.json'));
const release18 = JSON.parse(read('LOCAL1_8_RELEASE_CERTIFICATION.json'));
const catalog = JSON.parse(read('local/data/catalog.json'));
const checks = [];
function check(name, condition) { checks.push({name, passed:Boolean(condition)}); assert(condition, name); }
function moduleSlice(html) {
  const start = html.indexOf('class="post-submit-local"');
  if (start < 0) return '';
  const end = html.indexOf('</section>', start);
  return html.slice(start, end + 10);
}

// Homepage/global discovery: Local is discoverable but stays secondary to insurance.
check('homepage loads isolated 1.8 integration stylesheet', homepage.includes('shared/local-site-integration.css'));
check('global nav contains one Local entry', (homepage.match(/data-track-location="global_nav"/g)||[]).length === 1 && />Local<\/a>/.test(homepage));
check('global Local nav entry uses site-integration campaign', /global_nav&amp;campaign=local_site_integration/.test(homepage));
check('existing Start a review nav item remains', homepage.includes('<a href="#start">Start a review</a>'));
check('existing Professional programs nav item remains', homepage.includes('<a href="#professionals">Professional programs</a>'));
check('existing Contact Dylan nav item remains', homepage.includes('<a href="#contact">Contact Dylan</a>'));
check('existing header Call Dylan action remains', /data-track-event="header_call"[\s\S]*href="tel:\+14083276377"/.test(homepage));
check('homepage still has exactly one general CoverageFit launch', (homepage.match(/data-coveragefit-launch="home"/g)||[]).length === 1);
check('primary CoverageFit launch appears before Local module', homepage.indexOf('data-coveragefit-launch="home"') < homepage.indexOf('id="site-local-title"'));
check('Local module is below CoverageFit story', homepage.indexOf('class="coveragefit-story"') < homepage.indexOf('class="site-local-module"'));
check('Local module is below professional programs', homepage.indexOf('class="professional-section"') < homepage.indexOf('class="site-local-module"'));
check('Local module is before agent/contact closeout', homepage.indexOf('class="site-local-module"') < homepage.indexOf('class="root-agent story-agent"'));
check('Local module has exact 408FARMERS Local label', /site-local-module[\s\S]*408FARMERS Local/.test(homepage));
check('Local module describes program as separate', /Local is a separate community program/.test(homepage));
check('Local module carries no-insurance requirement language', /No insurance purchase or quote is required to use a public Local perk\./.test(homepage));
check('Local module includes Eat & Drink category', /Eat &amp; Drink/.test(homepage));
check('Local module includes Home category', /<span>Home<\/span>/.test(homepage));
check('Local module includes Auto category', /<span>Auto<\/span>/.test(homepage));
check('Local module has one consumer explore CTA', (homepage.match(/data-track-location="homepage_local_module" href="\/local\/\?/g)||[]).length === 1);
check('Local module has separate merchant join CTA', /data-track-event="local_merchant_join"[\s\S]*href="\/local\/join\/\?/.test(homepage));
const siteModuleStart = homepage.indexOf('<section class="site-local-module"');
const siteModuleEnd = homepage.indexOf('</section>', siteModuleStart);
const siteModule = homepage.slice(siteModuleStart, siteModuleEnd + 10);
check('homepage Local module contains no insurance form', !/<form\b|<input\b|<select\b|<textarea\b/i.test(siteModule));
check('homepage Local module contains no CoverageFit launcher', !/data-coveragefit-launch|coveragefit\.com/i.test(siteModule));
check('homepage Local module contains no insurance savings promise', !/rates? (?:have )?dropped|lower your rate|lowest price|cheapest|save \$/i.test(siteModule));

// Footer integration remains supplemental.
const footer = homepage.slice(homepage.indexOf('<footer class="hub-footer">'));
check('homepage footer uses Local-integrated responsive grid', footer.includes('footer-links footer-links--local-integrated'));
check('homepage footer includes dedicated Local column', /<strong>Local<\/strong>/.test(footer));
check('footer keeps Coverage Reviews column', /<strong>Coverage Reviews<\/strong>/.test(footer));
check('footer keeps Professional Programs column', /<strong>Professional Programs<\/strong>/.test(footer));
check('footer keeps Contact column', /<strong>Contact<\/strong>/.test(footer));
check('footer Local consumer link uses homepage_footer surface', /surface=homepage_footer&amp;campaign=local_site_integration/.test(footer));
check('footer Local merchant link remains separate', /homepage_footer_business/.test(footer));

// CSS is isolated and responsive.
check('integration CSS is explicitly versioned 1.8', css.startsWith('/* 408-LOCAL-1.8 — 408FARMERS Site Integration'));
check('homepage Local module CSS exists', css.includes('.site-local-module{') && css.includes('.site-local-module-inner{'));
check('post-submit module CSS exists', css.includes('.post-submit-local{'));
check('consumer Local CTA maintains 50px touch target', /\.site-local-primary\{[\s\S]*min-height:50px/.test(css));
check('post-submit Local CTA maintains 48px touch target', /\.post-submit-local a\{[\s\S]*min-height:48px/.test(css));
check('footer adapts to two columns', /max-width:1000px[\s\S]*footer-links\.footer-links--local-integrated\{grid-template-columns:repeat\(2,1fr\)/.test(css));
check('footer adapts to one mobile column', /max-width:720px[\s\S]*footer-links\.footer-links--local-integrated\{grid-template-columns:1fr\}/.test(css));
check('homepage module collapses to one column', /max-width:1000px[\s\S]*site-local-module-inner\{grid-template-columns:1fr/.test(css));

// Post-submission modules exist only on the intended property/homebuyer receipt surfaces.
const receipts = {
  'home/thank-you.html':'post_submit_home',
  'auto-bundle/thank-you.html':'post_submit_auto_bundle',
  'healthcare/thank-you.html':'post_submit_healthcare',
  'teachers/thank-you.html':'post_submit_teachers',
  'tech/thank-you.html':'post_submit_tech',
  'engineers/thank-you.html':'post_submit_engineers',
  'buyer/thank-you.html':'buyer_completion'
};
for (const [file,surface] of Object.entries(receipts)) {
  const html = read(file);
  const mod = moduleSlice(html);
  check(`${file}:loads integration CSS`, html.includes('../shared/local-site-integration.css'));
  check(`${file}:contains exactly one post-submit Local module`, (html.match(/class="post-submit-local"/g)||[]).length === 1);
  check(`${file}:Local module comes after request receipt`, html.indexOf('post-submit-local') > Math.max(html.indexOf('thanks-card'), html.indexOf('buyer-thanks-card')));
  if (file !== 'buyer/thank-you.html') check(`${file}:Local module comes after existing next steps`, html.indexOf('post-submit-local') > html.indexOf('next-steps'));
  check(`${file}:Local module says separate from insurance request`, /Local is separate from your insurance request/.test(mod));
  check(`${file}:Local module says no quote or purchase required`, /no insurance purchase or quote is required/i.test(mod));
  check(`${file}:Local link uses intended surface`, new RegExp(`surface=${surface}(?:&amp;|&)campaign=local_site_integration`).test(mod));
  check(`${file}:post-submit Local module has no form`, !/<form\b|<input\b|<select\b|<textarea\b/i.test(mod));
  check(`${file}:post-submit Local module has no CoverageFit launch`, !/coveragefit|data-coveragefit-launch/i.test(mod));
}
check('buyer completion copy does not imply policy coverage has started', !/Coverage started\./.test(read('buyer/thank-you.html')));
check('buyer completion uses request-received wording', /Your request is in\. Meet more of the South Bay\./.test(read('buyer/thank-you.html')));
check('Life receipt intentionally has no Local module', !read('life/thank-you.html').includes('post-submit-local') && !read('life/thank-you.html').includes('local-site-integration.css'));

// Active forms remain completely untouched from the uploaded 1.7 source.
const frozenHashes = {
  'home/index.html':'5d4d2ff7987dacb3b2388d4ac38241ec5d93fec411ed3d4ba5219f4ea8a78ca7',
  'auto-bundle/index.html':'f27138e063db2dc1d14b23508bea1faf4b3eb20c12dca60230781e140c073c25',
  'buyer/index.html':'02bd24a7f19cb731a3d07ce24652024a71ff372fca3973ef6a8fdaa5d7cb22fa',
  'healthcare/index.html':'32b6c02a27ebc3e72d2b7dc8bfddb09f69ffa313f47cd2c511729b17792b472d',
  'teachers/index.html':'cddd12fd578bebda4fab2242b106e018941bd35ffb74b26fe5780889c80cb327',
  'tech/index.html':'66ceaeb0d67163667b4db6b780df1e758b4f449a614e342ffd12a3de63cc7a13',
  'engineers/index.html':'9872bdbe7851e2973b6f629073c1a9a0ece5765b4e5bf9f853063ab6bd6ca61d',
  'life/index.html':'99b1636d3c319c6f42ccd402583ecf7acda4850d6b052d17761f4c4f79cbc12e',
  'life/thank-you.html':'7fb34f9fcc124f3ca33b2ad2ed48a0624ac92fba71ddad1ba1a5732054c89a00',
  'shared/script.js':'5a5f19a43d237e44b9599fbd6536b228b0e71682cfe5d22a7b77fcdbd3acf6d7',
  'shared/coveragefit-launch.js':'0656746d83b8b54f5b322cd530e9150a9b2fe5274ae865b4808919ccd62191b9',
  'shared/local-attribution.js':'f9e04b4214e36805c5443ea88bff4f7978878f414295c960d4787d1c653ea7fe',
  'shared/local-merchant.js':'806940982132e48d21284a5983a5c02fc535efb79a9a87cb98d2605795e0c55f',
  'shared/local-directory.js':'aeee96922378d235b177d229d1949220f17518927c3b4383c1964bdb12bfbb8c',
  'shared/local-data-model.js':'ff06f29c256d85adc4d8813187719a640c918a3cb7381b43c24d4469149fa17e',
  'shared/local-join.js':'69f4a0f5aeb772b4bd98ee6629d527c0510a26d37c1c0c874399127c704dcce0',
  '_worker.js':'fff94d29593f23a15765e66b6627e0339480e0ca394ad86086b06026392d2690',
  'local/data/catalog.json':'54b0bf57f630d68c803c8a81085f4f743df3fabdef2b7454facd7d0ed48c1663',
  'local/data/catalog.schema.json':'a56f9a6c37878b139c52a9948bbe012d7186a0664c116039cb2bd60e8583b72d'
};
for (const [file,expected] of Object.entries(frozenHashes)) check(`${file}:unchanged from 1.7 source`, hash(file) === expected);

// Local shells advance only their release marker; merchant/data runtimes remain untouched.
const localIndex = read('local/index.html');
const localDetail = read('local/detail/index.html');
check('Local directory shell advances to 1.8 marker', /data-local-build="408-LOCAL-1\.8"/.test(localIndex));
check('Local detail shell advances to 1.8 marker', /data-local-build="408-LOCAL-1\.8"/.test(localDetail));
check('Local join remains independently versioned at 1.5', /data-local-build="408-LOCAL-1\.5"/.test(read('local/join/index.html')));
const normalizedIndex = localIndex.replace('data-local-build="408-LOCAL-1.8"','data-local-build="408-LOCAL-1.7"');
const normalizedDetail = localDetail.replace('data-local-build="408-LOCAL-1.8"','data-local-build="408-LOCAL-1.7"');
check('Local directory content otherwise unchanged from 1.7', shaText(normalizedIndex) === release17.sourceHashes['local/index.html']);
check('Local detail content otherwise unchanged from 1.7', shaText(normalizedDetail) === release17.sourceHashes['local/detail/index.html']);
check('all fixture merchants remain draft/non-public', catalog.merchants.length === 3 && catalog.merchants.every(m => m.fixture === true && m.status === 'draft'));
check('all fixture perks remain draft/non-public', catalog.perks.length === 3 && catalog.perks.every(p => p.fixture === true && p.status === 'draft'));

// Contract and roadmap continuation.
check('1.8 contract build is exact', contract.build === '408-LOCAL-1.8');
check('contract says global nav Local is integrated', contract.homepage.globalNavLocal === true);
check('contract says lower-page module is integrated', contract.homepage.lowerPageModule === true);
check('contract says footer Local is integrated', contract.homepage.footerLocalColumn === true);
check('contract says primary insurance CTA was not replaced', contract.homepage.primaryInsuranceCtaReplaced === false);
check('contract says active form steps unchanged', contract.postSubmission.activeFormStepsChanged === false);
check('contract says buyer intake unchanged', contract.postSubmission.buyerIntakeChanged === false);
check('contract says no Local lead form added', contract.postSubmission.localLeadFormAdded === false);
check('contract says no automatic CoverageFit launch added', contract.postSubmission.automaticCoverageFitLaunchAdded === false);
check('contract says quote not required', contract.localBoundary.quoteRequired === false);
check('contract says purchase not required', contract.localBoundary.purchaseRequired === false);
check('contract says insurance economics unchanged', contract.localBoundary.insurancePricingOrEligibilityChanged === false);
check('contract reuses 1.6 attribution engine', contract.attribution.engineBuild === '408-LOCAL-1.6');
check('contract adds no analytics event names', contract.attribution.newEventNames === false);
check('contract adds no analytics PII', contract.attribution.piiAdded === false);
check('contract says no catalog mutation', contract.preservation.catalogMutation === false);
check('contract says no real merchant activation', contract.preservation.realMerchantActivation === false);
check('contract says Worker unchanged', contract.preservation.workerChanged === false);
check('contract locks next sprint to 1.9', contract.nextSprint === '408-LOCAL-1.9');
check('roadmap current build advances to 1.8', roadmap.includes('**Current Local build:** `408-LOCAL-1.8`'));
check('roadmap marks 1.8 complete', /408-LOCAL-1\.8 — 408FARMERS Site Integration — COMPLETE/.test(roadmap));
check('roadmap continuation locks 1.9', /Immediate continuation point[\s\S]*408-LOCAL-1\.9 — Pilot Merchant Launch/.test(roadmap));
check('root roadmap marks 1.8 complete', /\[x\] 408-LOCAL-1\.8 — 408FARMERS Site Integration/.test(rootRoadmap));
check('root roadmap leaves 1.9 incomplete', /\[ \] 408-LOCAL-1\.9 — Pilot Merchant Launch/.test(rootRoadmap));
check('CHANGELOG starts with 1.8', changelog.startsWith('# 408-LOCAL-1.8 — 408FARMERS Site Integration'));
check('README identifies 1.8 as current Local release', readme.startsWith('CURRENT LOCAL RELEASE: 408-LOCAL-1.8 — 408FARMERS Site Integration'));
check('VERSION advances to 1.8', read('VERSION').trim() === '408-LOCAL-1.8');
check('sprint documentation is substantive', fs.statSync(rel('SPRINT-408-LOCAL-1.8.md')).size > 4000);
check('release certification identifies 1.8', release18.sprint === '408-LOCAL-1.8' && release18.status === 'deployable_source_certified');
check('release certification locks next sprint to 1.9', release18.nextSprint === '408-LOCAL-1.9');
check('release certification records no active form UI change', release18.activeInsuranceFormUiChanged === false);
check('release certification records no real merchant activation', release18.realMerchantsActivated === 0 && release18.livePerksActivated === 0);

const failed = checks.filter(c => !c.passed);
const result = { total:checks.length, passed:checks.length-failed.length, failed:failed.length, checks };
fs.writeFileSync(rel('LOCAL1_8_QA.json'), JSON.stringify(result,null,2)+'\n');
console.log(`408-LOCAL-1.8 QA: ${result.passed}/${result.total} passed`);
if (failed.length) process.exit(1);
