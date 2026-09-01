#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const receiverRoot = process.env.COVERAGEFIT_ROOT || path.resolve(root, '..', 'coveragefit');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const exists = rel => fs.existsSync(path.join(root, rel));
const manifest = JSON.parse(read('handoff-manifest.json'));
const checks = [];
const check = (name, condition) => { assert.ok(condition, name); checks.push(name); };

const publicFiles = [
  'index.html',
  'privacy.html',
  'terms.html',
  'home/index.html',
  'home/thank-you.html',
  'auto-bundle/index.html',
  'auto-bundle/thank-you.html',
  'healthcare/index.html',
  'healthcare/thank-you.html',
  'teachers/index.html',
  'teachers/thank-you.html',
  'tech/index.html',
  'tech/thank-you.html',
  'engineers/index.html',
  'engineers/thank-you.html',
  'buyer/index.html',
  'buyer/thank-you.html',
  'contact/index.html',
  'neighbor/index.html',
  'score/index.html'
];

check('runtime preserves accessibility polish after later CRO work', ['408-CRO-1.5', '408-CRO-1.6', '408-CRO-1.6.1', '408-CRO-1.6.2', '408-CRO-1.6.2.1','408-LIFE-1.1','408-LIFE-1.2','408-LIFE-1.3','408-LIFE-1.4','408-LIFE-1.4.1','408-LIFE-1.5','408-LIFE-1.6','408-LIFE-1.7','408-FLOW-1.5','408-HOME-2.1','408-HOME-2.2','408-HOME-2.3','408-HOME-2.4','408-HOME-2.5','408-HOME-2.6','408-HOME-2.7','408-HOME-2.8','408-HOME-2.9','408-FLOW-2.1','408-FLOW-2.2','408-FLOW-2.3','408-FLOW-2.4','408-CF-RPT-1.1','408-FLOW-2.5'].includes(read('VERSION').trim()));
check('manifest preserves the bounded accessibility contract', ['408-CRO-1.5', '408-CRO-1.6', '408-CRO-1.6.1', '408-CRO-1.6.2', '408-CRO-1.6.2.1','408-LIFE-1.1','408-LIFE-1.2','408-LIFE-1.3','408-LIFE-1.4','408-LIFE-1.4.1','408-LIFE-1.5','408-LIFE-1.6','408-LIFE-1.7','408-FLOW-1.5','408-HOME-2.1','408-HOME-2.2','408-HOME-2.3','408-HOME-2.4','408-HOME-2.5','408-HOME-2.6','408-HOME-2.7','408-HOME-2.8','408-HOME-2.9','408-FLOW-2.1','408-FLOW-2.2','408-FLOW-2.3','408-FLOW-2.4','408-CF-RPT-1.1','408-FLOW-2.5'].includes(manifest.runtime) && manifest.accessibilityAndResponsive?.build === '408-CRO-1.5');
check('manifest records 320px reflow and 44px target contracts', manifest.accessibilityAndResponsive?.minimumReflowWidth === 320 && manifest.accessibilityAndResponsive?.minimumTargetPixels === 44);
check('manifest preserves Buyer architecture and CoverageFit source', manifest.accessibilityAndResponsive?.buyerArchitectureChanged === false && manifest.accessibilityAndResponsive?.coverageFitChanged === false);
check('shared accessibility assets are packaged', exists('shared/accessibility.css') && exists('shared/accessibility.js'));

for (const rel of publicFiles) {
  const markup = read(rel);
  const skip = markup.match(/<a[^>]+class="[^"]*skip-link[^"]*"[^>]+href="#([^"]+)"[^>]*>/i);
  const main = markup.match(/<main[^>]+id="([^"]+)"[^>]*>/i);
  check(`${rel}: loads shared accessibility polish`, markup.includes('shared/accessibility.css'));
  check(`${rel}: loads reliable skip-link focus behavior`, markup.includes('shared/accessibility.js'));
  check(`${rel}: has one skip link targeting its main landmark`, Boolean(skip && main && skip[1] === main[1] && (markup.match(/skip-link/g) || []).length === 1));
  check(`${rel}: main landmark accepts skip-link focus`, Boolean(main && /tabindex="-1"/.test(main[0])));
  check(`${rel}: retains one page heading`, (markup.match(/<h1\b/gi) || []).length === 1);
  check(`${rel}: permits browser zoom and responsive scaling`, /name="viewport"/i.test(markup) && !/user-scalable\s*=\s*no|maximum-scale\s*=\s*1/i.test(markup));
  check(`${rel}: every image declares alt behavior`, !/<img\b(?![^>]*\balt=)[^>]*>/i.test(markup));
}

const css = read('shared/accessibility.css');
check('focus treatment is consistent and dual contrast', css.includes(':focus-visible') && css.includes('0 0 0 3px #fff') && css.includes('--a11y-focus: #005fcc'));
check('mobile inputs prevent forced iOS zoom', /@media \(max-width: 700px\)[\s\S]*font-size: 16px !important/.test(css));
check('small-screen header and headline reflow is bounded', css.includes('@media (max-width: 380px)') && css.includes('max-width: 52vw') && css.includes('.hero h1'));
check('reduced motion is site-wide', css.includes('@media (prefers-reduced-motion: reduce)') && css.includes('animation-duration: .01ms') && css.includes('transition-duration: .01ms'));
check('forced-color focus and invalid states are supported', css.includes('@media (forced-colors: active)') && css.includes('Highlight') && css.includes('Mark'));
check('known contrast failures have corrected tokens', css.includes('--a11y-contrast-gold: #765300') && css.includes('--a11y-contrast-muted: #536273'));

const progressive = read('shared/progressive-intake.js');
check('CRO intake preserves accessible validation after later CRO work', ["var BUILD = '408-CRO-1.5'", "var BUILD = '408-CRO-1.6'", "var BUILD = '408-CRO-1.6.1'", "var BUILD = '408-CRO-1.6.2'", "var BUILD = '408-CRO-1.6.2.1'", "var BUILD = '408-FLOW-1.5'"].some(build => progressive.includes(build)));
check('CRO intake announces step changes', progressive.includes('croStepAnnouncer') && progressive.includes("aria-live', 'polite") && progressive.includes("aria-atomic', 'true"));
check('CRO intake exposes validation state and recovery', progressive.includes("aria-invalid', 'true") && progressive.includes('aria-describedby') && progressive.includes("removeAttribute('aria-invalid')"));

const buyer = read('shared/buyer-flow.js');
check('Buyer retains one established engine with accessible validation', buyer.includes("aria-invalid', 'true") && buyer.includes('buyerStepAnnouncer') && buyer.includes("removeAttribute('aria-current')"));
check('Buyer respects reduced motion while moving between steps', buyer.includes("prefers-reduced-motion: reduce") && buyer.includes("behavior: reduced ? 'auto' : 'smooth'"));

const score = read('shared/score.js');
const scoreMarkup = read('score/index.html');
check('hidden score CTA cannot receive focus', /mobileButton\.disabled\s*=\s*hidden/.test(score) && /class="mobile-cta" aria-hidden="true"[\s\S]*?<button[^>]+disabled/.test(scoreMarkup));

check('CRO-1.4 progressive form architecture remains intact', manifest.lowFrictionIntake?.build === '408-CRO-1.4' && manifest.lowFrictionIntake?.propertyAddressCollection === '408farmers_step_2');
check('fail-open lead delivery remains intact', read('shared/script.js').includes('LEAD_SUBMISSION_GRACE_MS = 900') && read('shared/script.js').includes("resolve('pending')"));
check('zero-repeat CoverageFit continuation remains intact', manifest.coverageFit?.zeroRepeat === true && manifest.handoff?.next === '/assessment/');

check('paired CoverageFit prefill remains available', fs.existsSync(path.join(receiverRoot, 'assets/js/prefill-intake.js')));
const receiverPrefill = fs.readFileSync(path.join(receiverRoot, 'assets/js/prefill-intake.js'), 'utf8');
check('paired CoverageFit still consumes property address', receiverPrefill.includes("params.get('property_address')"));
check('sprint documentation records the unchanged receiver', exists('SPRINT-408-CRO-1.5.md') && /CoverageFit was inspected and regression-tested but not modified/.test(read('SPRINT-408-CRO-1.5.md')));

console.log(JSON.stringify({ sprint: '408-CRO-1.5', passed: checks.length, failed: 0, checks }, null, 2));
