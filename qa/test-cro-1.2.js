#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const exists = rel => fs.existsSync(path.join(root, rel));
const manifest = JSON.parse(read('handoff-manifest.json'));
const contactChoice = require(path.join(root, 'shared/contact-choice.js'));
const checks = [];
const check = (name, condition) => { assert.ok(condition, name); checks.push(name); };

const formRoutes = [
  'home/index.html',
  'auto-bundle/index.html',
  'healthcare/index.html',
  'teachers/index.html',
  'tech/index.html',
  'engineers/index.html'
];
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
const publicMarkup = publicHtml.map(file => fs.readFileSync(file, 'utf8')).join('\n');

check('runtime preserves reliable contact choices after later CRO work', ['408-CRO-1.2', '408-CRO-1.3','408-CRO-1.4', '408-CRO-1.5', '408-CRO-1.6', '408-CRO-1.6.1', '408-CRO-1.6.2', '408-CRO-1.6.2.1','408-LIFE-1.1','408-LIFE-1.2','408-LIFE-1.3','408-LIFE-1.4','408-LIFE-1.4.1','408-LIFE-1.5','408-LIFE-1.6','408-LIFE-1.7','408-FLOW-1.5','408-HOME-2.1','408-HOME-2.2','408-HOME-2.3','408-HOME-2.4','408-HOME-2.5','408-HOME-2.6','408-HOME-2.7','408-HOME-2.8','408-HOME-2.9','408-FLOW-2.1','408-FLOW-2.2','408-FLOW-2.3','408-FLOW-2.4','408-CF-RPT-1.1','408-FLOW-2.5'].includes(read('VERSION').trim()));
check('manifest preserves the CRO-1.2 contact contract', ['408-CRO-1.2', '408-CRO-1.3','408-CRO-1.4', '408-CRO-1.5', '408-CRO-1.6', '408-CRO-1.6.1', '408-CRO-1.6.2', '408-CRO-1.6.2.1','408-LIFE-1.1','408-LIFE-1.2','408-LIFE-1.3','408-LIFE-1.4','408-LIFE-1.4.1','408-LIFE-1.5','408-LIFE-1.6','408-LIFE-1.7','408-FLOW-1.5','408-HOME-2.1','408-HOME-2.2','408-HOME-2.3','408-HOME-2.4','408-HOME-2.5','408-HOME-2.6','408-HOME-2.7','408-HOME-2.8','408-HOME-2.9','408-FLOW-2.1','408-FLOW-2.2','408-FLOW-2.3','408-FLOW-2.4','408-CF-RPT-1.1','408-FLOW-2.5'].includes(manifest.runtime) && manifest.contactChoices?.build === '408-CRO-1.2');
check('focused contact route and assets are packaged', ['contact/index.html','shared/contact-choice.js','shared/contact-choice.css'].every(exists));
check('contact route is normalized by Advanced Mode Worker', read('_worker.js').includes("'/contact'") && !read('_redirects').includes('/contact/index.html')); 
check('conversation-only business and landlord homepage entries use one contact chooser', ['business','landlord'].every(intent => read('index.html').includes(`href="contact/?intent=${intent}"`)));
check('life retains the established contact chooser as fallback from its dedicated campaign route', read('index.html').includes('href="life/"') && read('life/index.html').includes('../contact/?intent=life'));
check('conversation-only homepage entries are no longer SMS-only', !/data-track-label="I (?:need to protect my business|own a rental property|need to protect my family)"[^>]+href="sms:/i.test(read('index.html')));
check('contact page exposes direct text call and email choices', ['data-contact-sms','href="tel:+14083276377"','data-contact-email'].every(value => read('contact/index.html').includes(value)));
check('contact page remains a choice surface rather than another intake', !read('contact/index.html').includes('<form') && !read('contact/index.html').includes('data-coveragefit-after-submit'));
check('contact intent resolver supports all bounded contexts', ['general','business','landlord','life'].every(intent => contactChoice.resolve(`?intent=${intent}`).intent === intent));
check('unknown contact intents fall back safely', contactChoice.resolve('?intent=<script>').intent === 'general');
check('contact messages retain intent without URL identity data', contactChoice.smsHref(contactChoice.CONTEXTS.business).includes('business%20insurance') && !/first_name|last_name|email=|phone=|address=/i.test(contactChoice.smsHref(contactChoice.CONTEXTS.business)));
check('contact email routes carry bounded subject and message', contactChoice.emailHref(contactChoice.CONTEXTS.landlord).startsWith('mailto:dylan.vtam@farmersagency.com?subject=') && contactChoice.emailHref(contactChoice.CONTEXTS.landlord).includes('&body='));
check('all public SMS bodies use one consistent query format', !publicMarkup.includes('?&body=') && !publicMarkup.includes('?&amp;body=') && /sms:\+14083276377\?body=/.test(publicMarkup));
check('buyer partner SMS builder uses the same query format', read('shared/buyer-referral.js').includes("'?body=' + encodeURIComponent") && !read('shared/buyer-referral.js').includes("'?&body='"));
check('telephone actions no longer claim to start a text', !/>Call or text</i.test(publicMarkup));
check('every public lead form offers explicit text and call alternatives', formRoutes.every(rel => {
  const markup = read(rel);
  return markup.includes('direct-contact-choice') && markup.includes('>Text Dylan<') && markup.includes('>Call Dylan<');
}));
check('Buyer retains text-first online choice plus truthful call action', read('buyer/index.html').includes('Text Dylan at 408-FARMERS') && read('buyer/index.html').includes('data-buyer-start-online') && read('buyer/index.html').includes('<span>Call Dylan</span>'));
check('CoverageFit handoff receiver and stable build are unchanged', ['CoverageFit v3.20.51','CoverageFit v3.20.52','CoverageFit v3.20.53','CoverageFit v3.20.54','CoverageFit v3.20.55','CoverageFit v3.20.56','CoverageFit v3.20.57','CoverageFit v3.20.58','CoverageFit v3.20.59','CoverageFit v3.20.60','CoverageFit v3.20.61','CoverageFit v3.20.62'].includes(manifest.receiver) && manifest.minimumCompatibleReceiver === 'CoverageFit v3.20.13' && manifest.build === '408-CONV-1.1');
check('zero-repeat and assessment routing remain unchanged', manifest.coverageFit?.zeroRepeat === true && manifest.handoff?.next === '/assessment/' && manifest.routes?.length === 7);
check('live SMS certification remains truthfully deferred', manifest.smsSimulator?.liveSms === false && manifest.smsSimulator?.numberPorted === false && manifest.smsSimulator?.nextProductionSprint === 'RC-SMS-1.10');
check('sprint documentation records the bounded implementation', exists('SPRINT-408-CRO-1.2.md') && /CoverageFit was inspected and regression-tested but not modified/.test(read('SPRINT-408-CRO-1.2.md')));

console.log(JSON.stringify({ sprint: '408-CRO-1.2', passed: checks.length, failed: 0, checks }, null, 2));
