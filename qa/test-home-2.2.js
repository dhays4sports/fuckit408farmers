#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const checks = [];
const check = (name, condition) => { assert(condition, name); checks.push(name); };

const version = read('VERSION').trim();
const home = read('home/index.html');
const experience = read('shared/home-engagement.js');
const styles = read('shared/home-engagement.css');
const baseline = read('shared/home-baseline.js');
const submitController = read('shared/script.js');
const manifest = JSON.parse(read('handoff-manifest.json'));
const engagement = JSON.parse(read('HOME2_2_ENGAGEMENT_CONTRACT.json'));
const journeyJson = JSON.parse(read('HOME2_2_JOURNEY_CONTRACT.json'));
const journey = require(path.join(root, 'shared/home-journey-contract.js'));

check('release preserves the HOME-2.2 engagement experience', ['408-HOME-2.2', '408-HOME-2.3', '408-HOME-2.4','408-HOME-2.5','408-HOME-2.6','408-HOME-2.7','408-HOME-2.8','408-HOME-2.9','408-FLOW-2.1','408-FLOW-2.2','408-FLOW-2.3','408-FLOW-2.4','408-CF-RPT-1.1','408-FLOW-2.5'].includes(version));
check('HOME-2.2 machine-readable journey contract remains immutable', journeyJson.build === '408-HOME-2.2' && journeyJson.version === '1.1' && journeyJson.contract === journey.CONTRACT);
check('Home sender fingerprint advances', /data-sender-build="408-HOME-2\.[23456789]"/.test(home) && /data-home-journey-build="408-HOME-2\.[23456789]"/.test(home));
check('three one-question fieldsets are present', (home.match(/data-home-step="[123]"/g) || []).length === 3);
check('contact form follows engagement markup', home.indexOf('data-home-engagement') < home.indexOf('id="leadForm"'));
check('engagement is hidden in HTML for no-JavaScript fallback', /data-home-engagement hidden/.test(home) && !/<form[^>]+id="leadForm"[^>]+hidden/.test(home));
check('each semantic field has all four bounded options', Object.entries(journey.SEMANTIC_FIELDS).every(([field, values]) => values.every(value => home.includes(`value="${value}"`)) && engagement.sequence.some(step => step.field === field)));
check('explicit Continue and Back controls are present', home.includes('data-home-continue') && home.includes('data-home-back'));
check('progress and validation are announced accessibly', home.includes('data-home-engagement-live aria-live="polite"') && home.includes('data-home-engagement-error role="alert"'));
check('native controls and fieldsets retain keyboard semantics', home.includes('type="radio"') && (home.match(/<fieldset/g) || []).length >= 3 && (home.match(/<legend>/g) || []).length >= 3);
check('controller requires selection before advancing', experience.includes("input[name=\"") && experience.includes('Please choose one option to continue.'));
check('controller supports backward navigation without clearing answers', experience.includes("back.addEventListener('click'") && experience.includes('showStep(current - 1'));
check('answers copy into the existing handoff fields', ['home_review_goal', 'housing_context', 'review_timing'].every(field => experience.includes(field) && home.includes(`name="${field}" type="hidden"`)));
check('review context derives from semantic answers', experience.includes('contract.deriveReviewContext') && home.includes('<option>Home and auto together</option>'));
check('contact capture remains gated after all three answers', experience.includes('if (current === steps.length - 1)') && experience.includes("form.dataset.engagementComplete = 'true'"));
check('renter continues to the existing direct route after lead capture', home.includes('data-cf-branch-field="housing_context"') && home.includes('data-cf-renter-destination="/contact/?intent=renters"') && (submitController.includes("value !== 'renter'") || submitController.includes("destinationType === 'renters'")));
check('four bounded engagement events extend the baseline', ['ENGAGEMENT_STARTED', 'ENGAGEMENT_STEP_VIEWED', 'ENGAGEMENT_STEP_COMPLETED', 'ENGAGEMENT_COMPLETED'].every(name => experience.includes(name) && journey.EVENTS[name]));
check('telemetry allowlists only bounded engagement metadata', ['step', 'step_count', 'semantic_field', 'semantic_value'].every(key => baseline.includes(`'${key}'`)) && !['first_name', 'last_name', 'phone', 'email', 'property_address'].some(key => baseline.includes(key)));
check('mobile, reduced-motion, and forced-color styles are present', styles.includes('@media(max-width:520px)') && styles.includes('prefers-reduced-motion') && styles.includes('forced-colors'));
check('manifest preserves three-question experience with current receiver', manifest.runtime === version && manifest.homeEngagementExperience?.build === '408-HOME-2.2' && manifest.homeEngagementExperience?.questionCount === 3 && manifest.homeEngagementExperience?.coverageFitChanged === false && ['CoverageFit v3.20.56', 'CoverageFit v3.20.57','CoverageFit v3.20.58','CoverageFit v3.20.59','CoverageFit v3.20.60','CoverageFit v3.20.61','CoverageFit v3.20.62'].includes(manifest.receiver));
check('CoverageFit questions and score remain out of scope', manifest.homeEngagementExperience?.assessmentQuestionsChanged === false && manifest.homeEngagementExperience?.protectionScoreChanged === false);

console.log(`408-HOME-2.2 QA: ${checks.length}/${checks.length} passed`);
