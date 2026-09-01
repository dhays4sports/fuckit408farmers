#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const checks = [];
const check = (name, condition) => { assert(condition, name); checks.push(name); };
const routes = ['home', 'buyer', 'auto-bundle', 'healthcare', 'teachers', 'tech', 'engineers'];

check('release advances to 408-FLOW-1.5', ['408-FLOW-1.5','408-HOME-2.1','408-HOME-2.2','408-HOME-2.3','408-HOME-2.4','408-HOME-2.5','408-HOME-2.6','408-HOME-2.7','408-HOME-2.8','408-HOME-2.9','408-FLOW-2.1','408-FLOW-2.2','408-FLOW-2.3','408-FLOW-2.4','408-CF-RPT-1.1','408-FLOW-2.5'].includes(read('VERSION').trim()));
for (const route of routes) {
  const html = read(`${route}/index.html`);
  check(`${route}: successful lead continues to CoverageFit`, html.includes('data-coveragefit-after-submit="true"'));
  check(`${route}: handoff enters the existing Home assessment`, html.includes('data-cf-assessment="home"') && html.includes('data-cf-next="/assessment/"'));
  check(`${route}: address uses the shared structured capture`, html.includes('data-address-autocomplete="property"') && html.includes('address-autocomplete.js'));
}

const address = read('shared/address-autocomplete.js');
const profile = read('shared/prospect-profile.js');
const launch = read('shared/coveragefit-launch.js');
const intake = read('shared/progressive-intake.js');
const intakeCss = read('shared/progressive-intake.css');
const auto = read('auto-bundle/index.html');
const life = read('life/index.html');

check('shared address controller creates every missing structured handoff field', address.includes('const ensureHiddenField') && address.includes("field.type = 'hidden'") && address.includes('form.appendChild(field)'));
check('prospect profile carries structured address components', ['property_street','property_city','property_state','property_zip'].every(field => profile.includes(field)));
check('launcher serializes structured address components', ['property_street','property_city','property_state','property_zip'].every(field => launch.includes(field)));
check('progressive intake preserves the rendering correction', intake.includes("hero.dataset.croIntakeHero = 'true'") && intakeCss.includes('grid-template-columns: minmax(390px, 1.15fr)'));
check('homeowners bundle enters CoverageFit while renters remain excluded', auto.includes('data-cf-renter-destination="/contact/?intent=renters') && auto.includes('data-cf-branch-field="housing_context"'));
check('LIFE remains outside CoverageFit and Formspree', !life.includes('data-coveragefit-after-submit') && !life.includes('formspree.io'));

console.log(`408-FLOW-1.5 QA: ${checks.length}/${checks.length} passed`);
