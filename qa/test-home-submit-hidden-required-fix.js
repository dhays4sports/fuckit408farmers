#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const css = read('shared/home-lead-progressive.css');
const progressive = read('shared/home-lead-progressive.js');
const submit = read('shared/script.js');
const home = read('home/index.html');
const checks = [];
const check = (name, condition) => { assert(condition, name); checks.push(name); };

check('enhanced Home flow does not hide review context unconditionally', !css.includes('.home-lead-progressive-active [data-home-review-context],'));
check('hidden review context selector only applies when hidden attribute is present', css.includes('.home-lead-progressive-active [data-home-review-context][hidden]'));
check('form-first mode explicitly reveals review context', progressive.includes('setReviewContextVisible(Boolean(formFirst))'));
check('visible review context remains required', progressive.includes('reviewContextSelect.required = Boolean(visible)'));
check('renter branch removes hidden review-context requirement', progressive.includes('setReviewContextVisible(false)'));
check('renter branch supplies bounded semantic fallback', progressive.includes("reviewContextSelect.value = 'Need a new policy'"));
check('submit validation gives visible status instead of silent no-op', submit.includes("status.textContent = 'Please complete the highlighted field before continuing.'"));
check('Home forces fresh fixed progressive CSS', home.includes('home-lead-progressive.css?v=408-HOME-2.9-submitfix1'));
check('Home forces fresh fixed progressive JS', home.includes('home-lead-progressive.js?v=408-HOME-2.9-submitfix1'));
check('Home forces fresh fixed submit JS', home.includes('script.js?v=408-HOME-2.9-submitfix1'));
check('native Formspree action remains intact', home.includes('action="https://formspree.io/f/mojgnegn"'));
check('same-origin lead relay remains intact', submit.includes("config.leadProxyEndpoint||'/api/lead'"));
console.log(`Home hidden-required-control submit hotfix QA: ${checks.length}/${checks.length} passed`);
