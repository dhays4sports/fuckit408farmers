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
const manifest = JSON.parse(read('handoff-manifest.json'));
const payoff = JSON.parse(read('HOME2_3_PAYOFF_CONTRACT.json'));
const journeyJson = JSON.parse(read('HOME2_3_JOURNEY_CONTRACT.json'));
const journey = require(path.join(root, 'shared/home-journey-contract.js'));

check('release preserves the HOME-2.3 payoff', ['408-HOME-2.3', '408-HOME-2.4','408-HOME-2.5','408-HOME-2.6','408-HOME-2.7','408-HOME-2.8','408-HOME-2.9','408-FLOW-2.1','408-FLOW-2.2','408-FLOW-2.3','408-FLOW-2.4','408-CF-RPT-1.1','408-FLOW-2.5'].includes(version));
check('HOME-2.3 machine-readable contract remains immutable', journeyJson.build === '408-HOME-2.3' && journeyJson.version === '1.2' && journeyJson.contract === journey.CONTRACT);
check('Home sender and asset fingerprints advance', /data-sender-build="408-HOME-2\.[3456789]"/.test(home) && /data-home-journey-build="408-HOME-2\.[3456789]"/.test(home) && (/home-engagement\.js\?v=408-HOME-2\.[3456789]/.test(home) || home.includes('home-form-first.js?v=408-FLOW-2.2')));
check('payoff is a distinct hidden progressive-enhancement stage', home.includes('data-home-payoff') && /data-home-payoff[^>]+hidden/.test(home) && !/<form[^>]+id="leadForm"[^>]+hidden/.test(home));
check('payoff follows engagement and precedes lead capture', home.indexOf('data-home-engagement hidden') < home.indexOf('data-home-payoff') && home.indexOf('data-home-payoff') < home.indexOf('id="leadForm"'));
check('all three bounded dimensions render payoff fragments', ['PAYOFF_COPY.goal', 'PAYOFF_COPY.housing', 'PAYOFF_COPY.timing'].every(token => experience.includes(token)) && payoff.possibleCombinations === 64);
check('all 12 approved semantic fragments exist', Object.values(journey.SEMANTIC_FIELDS).flat().every(value => new RegExp(`\\b${value}\\s*:`).test(experience)));
check('final question leads to payoff instead of contact capture', experience.includes('if (current === steps.length - 1) showPayoff()') && !experience.includes('if (current === steps.length - 1) revealLeadForm()'));
check('payoff continue exclusively reveals lead capture', experience.includes("payoffContinue.addEventListener('click', revealLeadForm)") && experience.indexOf('function showPayoff') < experience.indexOf('function revealLeadForm'));
check('answer editing returns to question three with answers preserved', experience.includes("payoffEdit.addEventListener('click'") && experience.includes('showStep(steps.length - 1, { focus: true })'));
check('renter payoff accurately discloses direct routing', home.includes('Continue to my renters review') === false && experience.includes('You will not be sent into the homeowner assessment.') && experience.includes("semantic.housingContext === 'renter'"));
check('non-renter payoff explains CoverageFit educational continuation', home.includes('CoverageFit will organize the protection questions worth reviewing with Dylan'));
check('payoff prohibits deterministic conclusions in visible copy', ['No instant quote', 'savings promise', 'coverage determination', 'eligibility decision'].every(copy => home.includes(copy)));
check('three payoff events extend the journey contract', ['PAYOFF_VIEWED', 'PAYOFF_CONTINUED', 'PAYOFF_EDIT_SELECTED'].every(name => journey.EVENTS[name] && experience.includes(name)));
check('payoff telemetry is limited to bounded semantic fields', ['home_review_goal', 'housing_context', 'review_timing'].every(key => baseline.includes(`'${key}'`)) && !['first_name', 'last_name', 'phone', 'email', 'property_address'].some(key => baseline.includes(key)));
check('payoff is keyboard and assistive-technology reachable', home.includes('data-home-payoff aria-labelledby="home-payoff-title" hidden tabindex="-1"') && experience.includes("payoff.focus({ preventScroll: true })"));
check('payoff styling includes hierarchy, actions, and responsive inheritance', ['.home-payoff h2', '.home-payoff-points', '.home-payoff-actions', '.home-payoff-disclosure'].every(selector => styles.includes(selector)));
check('manifest preserves bounded payoff with current receiver', manifest.runtime === version && manifest.homePersonalizedPayoff?.build === '408-HOME-2.3' && manifest.homePersonalizedPayoff?.possibleCombinations === 64 && manifest.homePersonalizedPayoff?.coverageFitChanged === false && ['CoverageFit v3.20.56', 'CoverageFit v3.20.57','CoverageFit v3.20.58','CoverageFit v3.20.59','CoverageFit v3.20.60','CoverageFit v3.20.61','CoverageFit v3.20.62'].includes(manifest.receiver));
check('assessment and score remain out of scope', manifest.homePersonalizedPayoff?.assessmentQuestionsChanged === false && manifest.homePersonalizedPayoff?.protectionScoreChanged === false);
check('HOME-2.3 contract retains its original next sprint', payoff.nextSprint === '408-HOME-2.4');

console.log(`408-HOME-2.3 QA: ${checks.length}/${checks.length} passed`);
