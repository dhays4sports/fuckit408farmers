'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'home/index.html'), 'utf8');
const guardrails = fs.readFileSync(path.join(root, 'shared/discovery-conversion-guardrails.js'), 'utf8');
let assertions = 0;
const check = (condition, message) => { assert.ok(condition, message); assertions += 1; };

check((html.match(/data-home-step="[123]"/g) || []).length === 3, 'exactly three pre-checkpoint questions');
check(html.includes('data-precheckpoint-question-count="3"'), 'declared pre-checkpoint cap');
check(html.includes('data-checkpoint-required-fields="first_name,phone,consent"'), 'minimal checkpoint field contract');
check(html.includes('data-anonymous-continuation="true"'), 'anonymous continuation contract');
check(html.includes('data-continue-without-saving'), 'real continue-without-saving control');
check(html.includes('data-snapshot-before-refinement="true"'), 'Snapshot-first contract');
check(html.indexOf('data-home-payoff') < html.indexOf('id="leadForm"'), 'personalized payoff precedes the checkpoint');
check(html.includes('Continue to my Snapshot'), 'primary continuation communicates Snapshot payoff');
check(html.includes('No contact details yet. No obligation.'), 'pre-checkpoint reassurance');
check(html.includes('Property and policy details can wait.'), 'property and policy details remain deferred');

const requiredNames = [...html.matchAll(/<input[^>]+name="([^"]+)"[^>]+required=""/g)].map(match => match[1]).sort();
check(JSON.stringify(requiredNames) === JSON.stringify(['consent', 'first_name', 'phone']), 'only first name, phone, and consent are required');
check(!/<input[^>]+name="(?:last_name|email|property_address)"[^>]+required/i.test(html), 'no prohibited early required identity or property field');
check(guardrails.includes("var BUILD = '408-DISCOVERY-1.1'"), 'forward conversion guardrail build');
check(guardrails.includes("visualRedesignIntroduced: false"), 'runtime guardrail declares no visual redesign');
check(guardrails.includes("checkpoint_field_scope"), 'runtime guards against checkpoint field expansion');

console.log(JSON.stringify({ ok: true, build: '408-DISCOVERY-1.1', assertions }, null, 2));
