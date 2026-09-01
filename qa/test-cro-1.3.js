#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const bytes = rel => fs.statSync(path.join(root, rel)).size;
const exists = rel => fs.existsSync(path.join(root, rel));
const manifest = JSON.parse(read('handoff-manifest.json'));
const budgets = JSON.parse(read('performance-budgets.json'));
const checks = [];
const check = (name, condition) => { assert.ok(condition, name); checks.push(name); };

function imageDimensions(rel) {
  const data = fs.readFileSync(path.join(root, rel));
  if (data.subarray(1, 4).toString('ascii') === 'PNG') {
    return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
  }
  assert.equal(data.subarray(0, 4).toString('ascii'), 'RIFF', `${rel} must be a RIFF WebP`);
  assert.equal(data.subarray(8, 12).toString('ascii'), 'WEBP', `${rel} must be WebP`);
  let offset = 12;
  while (offset + 8 <= data.length) {
    const chunk = data.subarray(offset, offset + 4).toString('ascii');
    const size = data.readUInt32LE(offset + 4);
    const payload = offset + 8;
    if (chunk === 'VP8X') {
      return {
        width: 1 + data.readUIntLE(payload + 4, 3),
        height: 1 + data.readUIntLE(payload + 7, 3)
      };
    }
    if (chunk === 'VP8 ') {
      assert.equal(data.readUIntLE(payload + 3, 3), 0x2a019d, `${rel} has an invalid VP8 frame`);
      return {
        width: data.readUInt16LE(payload + 6) & 0x3fff,
        height: data.readUInt16LE(payload + 8) & 0x3fff
      };
    }
    if (chunk === 'VP8L') {
      const bits = data.readUInt32LE(payload + 1);
      return {
        width: 1 + (bits & 0x3fff),
        height: 1 + ((bits >> 14) & 0x3fff)
      };
    }
    offset = payload + size + (size % 2);
  }
  throw new Error(`${rel} has no recognized WebP image chunk`);
}

check('runtime preserves mobile performance after later CRO work', ['408-CRO-1.3', '408-CRO-1.4', '408-CRO-1.5', '408-CRO-1.6', '408-CRO-1.6.1', '408-CRO-1.6.2', '408-CRO-1.6.2.1','408-LIFE-1.1','408-LIFE-1.2','408-LIFE-1.3','408-LIFE-1.4','408-LIFE-1.4.1','408-LIFE-1.5','408-LIFE-1.6','408-LIFE-1.7','408-FLOW-1.5','408-HOME-2.1','408-HOME-2.2','408-HOME-2.3','408-HOME-2.4','408-HOME-2.5','408-HOME-2.6','408-HOME-2.7','408-HOME-2.8','408-HOME-2.9','408-FLOW-2.1','408-FLOW-2.2','408-FLOW-2.3','408-FLOW-2.4','408-CF-RPT-1.1','408-FLOW-2.5'].includes(read('VERSION').trim()));
check('manifest preserves the bounded performance contract', ['408-CRO-1.3', '408-CRO-1.4', '408-CRO-1.5', '408-CRO-1.6', '408-CRO-1.6.1', '408-CRO-1.6.2', '408-CRO-1.6.2.1','408-LIFE-1.1','408-LIFE-1.2','408-LIFE-1.3','408-LIFE-1.4','408-LIFE-1.4.1','408-LIFE-1.5','408-LIFE-1.6','408-LIFE-1.7','408-FLOW-1.5','408-HOME-2.1','408-HOME-2.2','408-HOME-2.3','408-HOME-2.4','408-HOME-2.5','408-HOME-2.6','408-HOME-2.7','408-HOME-2.8','408-HOME-2.9','408-FLOW-2.1','408-FLOW-2.2','408-FLOW-2.3','408-FLOW-2.4','408-CF-RPT-1.1','408-FLOW-2.5'].includes(manifest.runtime) && manifest.mobilePerformance?.build === '408-CRO-1.3');
check('CoverageFit receiver remains unchanged', ['CoverageFit v3.20.51','CoverageFit v3.20.52','CoverageFit v3.20.53','CoverageFit v3.20.54','CoverageFit v3.20.55','CoverageFit v3.20.56','CoverageFit v3.20.57','CoverageFit v3.20.58','CoverageFit v3.20.59','CoverageFit v3.20.60','CoverageFit v3.20.61','CoverageFit v3.20.62'].includes(manifest.receiver) && manifest.mobilePerformance?.coverageFitChanged === false);
check('performance budget contract is packaged', exists('performance-budgets.json') && budgets.build === '408-CRO-1.3');
check('shared responsive-media stylesheet is packaged and imported', exists('shared/performance.css') && read('shared/styles.css').includes('@import url("./performance.css")'));

const routeFiles = {
  '/auto-bundle/': 'auto-bundle/index.html',
  '/healthcare/': 'healthcare/index.html',
  '/teachers/': 'teachers/index.html',
  '/tech/': 'tech/index.html',
  '/engineers/': 'engineers/index.html'
};

for (const [route, config] of Object.entries(budgets.routes)) {
  const asset = config.asset;
  const markup = read(routeFiles[route]);
  const original = `shared/assets/${asset}.png`;
  const mobile = `shared/assets/${asset}-480.webp`;
  const desktop = `shared/assets/${asset}-800.webp`;
  const full = `shared/assets/${asset}.webp`;
  const originalDimensions = imageDimensions(original);
  const mobileDimensions = imageDimensions(mobile);
  const desktopDimensions = imageDimensions(desktop);
  const fullDimensions = imageDimensions(full);

  check(`${route} responsive and fallback assets exist`, [original, mobile, desktop, full].every(exists));
  const simplifiedOccupation = route !== '/auto-bundle/' && ['408-FLOW-2.1', '408-FLOW-2.2','408-FLOW-2.3','408-FLOW-2.4','408-CF-RPT-1.1','408-FLOW-2.5'].includes(read('VERSION').trim());
  if (simplifiedOccupation) {
    check(`${route} retires its rendered campaign hero`, !markup.includes('campaign-hero-media') && !markup.includes('class="visual-card'));
    check(`${route} retains its original social-sharing asset`, markup.includes(`content="../shared/assets/${asset}.png" property="og:image"`));
    check(`${route} no longer prioritizes a campaign image`, !markup.includes('fetchpriority="high"'));
  } else {
    check(`${route} uses a typed WebP picture source`, markup.includes('<picture class="visual-card campaign-hero-media">') && markup.includes('<source type="image/webp"'));
    check(`${route} publishes 480, 800, and full-width candidates`, markup.includes(`${asset}-480.webp 480w`) && markup.includes(`${asset}-800.webp 800w`) && markup.includes(`${asset}.webp ${originalDimensions.width}w`));
    check(`${route} describes the rendered image size`, markup.includes('sizes="(max-width: 1050px) 100vw, 520px"'));
    check(`${route} retains the original PNG fallback`, markup.includes(`src="../shared/assets/${asset}.png"`));
    check(`${route} reserves intrinsic hero geometry`, markup.includes(`width="${originalDimensions.width}"`) && markup.includes(`height="${originalDimensions.height}"`));
    check(`${route} prioritizes its true hero only`, /campaign-hero-media[\s\S]*?fetchpriority="high"[\s\S]*?<\/picture>/.test(markup));
  }
  check(`${route} mobile source has the expected width`, mobileDimensions.width === 480);
  check(`${route} desktop source has the expected width`, desktopDimensions.width === 800);
  check(`${route} full source preserves original dimensions`, fullDimensions.width === originalDimensions.width && fullDimensions.height === originalDimensions.height);
  check(`${route} mobile source meets its byte budget`, bytes(mobile) <= config.mobile480MaxBytes);
  check(`${route} desktop source meets its byte budget`, bytes(desktop) <= config.desktop800MaxBytes);
  check(`${route} full source meets its byte budget`, bytes(full) <= config.fullMaxBytes);
  check(`${route} full WebP reduces the original by at least 90 percent`, bytes(full) <= bytes(original) * 0.1);
}

const sharedAssets = [
  ['shared/images/dylan-headshot-160.webp', 160, budgets.shared.headshot160MaxBytes],
  ['shared/images/dylan-headshot-320.webp', 320, budgets.shared.headshot320MaxBytes],
  ['shared/images/dylan-headshot-640.webp', 640, budgets.shared.headshot640MaxBytes],
  ['shared/assets/farmers-authorized-agency-320.webp', 320, budgets.shared.carrier320MaxBytes]
];
for (const [rel, width, maximum] of sharedAssets) {
  check(`${rel} exists`, exists(rel));
  check(`${rel} has the expected width`, imageDimensions(rel).width === width);
  check(`${rel} meets its shared byte budget`, bytes(rel) <= maximum);
}

const publicHtml = [];
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === 'qa') continue;
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(target);
    else if (entry.name.endsWith('.html')) publicHtml.push(target);
  }
}
walk(root);

const headshotMarkup = publicHtml
  .map(file => fs.readFileSync(file, 'utf8'))
  .filter(markup => markup.includes('dylan-headshot.png'));
check('every public Dylan headshot has a responsive WebP source', headshotMarkup.every(markup => /<picture[^>]*responsive-headshot[\s\S]*?dylan-headshot-(?:160|320)\.webp[\s\S]*?dylan-headshot\.png[\s\S]*?<\/picture>/.test(markup)));
check('every public Dylan headshot is deferred below the active journey', headshotMarkup.every(markup => {
  const tags = markup.match(/<img[^>]*dylan-headshot\.png[^>]*>/g) || [];
  return tags.length > 0 && tags.every(tag => tag.includes('loading="lazy"'));
}));

const carrierMarkup = publicHtml
  .map(file => fs.readFileSync(file, 'utf8'))
  .filter(markup => markup.includes('farmers-authorized-agency.png'));
check('every public carrier mark has an optimized WebP source', carrierMarkup.every(markup => /farmers-authorized-agency-320\.webp[\s\S]*?farmers-authorized-agency\.png/.test(markup)));
check('every public carrier mark is lazy loaded', carrierMarkup.every(markup => {
  const tags = markup.match(/<img[^>]*farmers-authorized-agency\.png[^>]*>/g) || [];
  return tags.length > 0 && tags.every(tag => tag.includes('loading="lazy"'));
}));

const allPublicMarkup = publicHtml.map(file => fs.readFileSync(file, 'utf8')).join('\n');
check('no headshot or carrier fallback receives high fetch priority', !/fetchpriority="high"[^>]*(?:dylan-headshot|farmers-authorized)|(?:dylan-headshot|farmers-authorized)[^>]*fetchpriority="high"/.test(allPublicMarkup));
check('contact choices and zero-repeat handoff remain intact', manifest.contactChoices?.build === '408-CRO-1.2' && manifest.coverageFit?.zeroRepeat === true && manifest.handoff?.next === '/assessment/');
check('sprint documentation records the bounded receiver behavior', exists('SPRINT-408-CRO-1.3.md') && /CoverageFit was inspected and regression-tested but not modified/.test(read('SPRINT-408-CRO-1.3.md')));

console.log(JSON.stringify({ sprint: '408-CRO-1.3', passed: checks.length, failed: 0, checks }, null, 2));
