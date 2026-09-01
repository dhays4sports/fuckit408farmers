#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const checks = [];
const check = (name, condition) => { assert.ok(condition, name); checks.push(name); };

const flyer = require(path.join(root, 'shared/flyer-campaign.js'));
const journey = require(path.join(root, 'shared/home-journey-contract.js'));
const manifest = JSON.parse(read('handoff-manifest.json'));
const contract = JSON.parse(read('HOME2_7_CAMPAIGN_QR_CONTRACT.json'));
const home = read('home/index.html');
const redirects = read('_redirects');
const baseline = read('shared/home-baseline.js');
const score = fs.readFileSync(path.resolve(root, '../../receiver/coveragefit/assets/js/protection-score.js'), 'utf8');

check('release preserves HOME-2.7 campaign routing', ['408-HOME-2.7', '408-HOME-2.8','408-HOME-2.9','408-FLOW-2.1','408-FLOW-2.2','408-FLOW-2.3','408-FLOW-2.4','408-CF-RPT-1.1','408-FLOW-2.5'].includes(read('VERSION').trim()) && ['408-HOME-2.7', '408-HOME-2.8','408-HOME-2.9','408-FLOW-2.1','408-FLOW-2.2','408-FLOW-2.3','408-FLOW-2.4','408-CF-RPT-1.1','408-FLOW-2.5'].includes(flyer.BUILD) && ['408-HOME-2.7', '408-HOME-2.8','408-HOME-2.9','408-FLOW-2.1','408-FLOW-2.2','408-FLOW-2.3','408-FLOW-2.4','408-CF-RPT-1.1','408-FLOW-2.5'].includes(journey.BUILD) && ['CoverageFit v3.20.58', 'CoverageFit v3.20.59','CoverageFit v3.20.60','CoverageFit v3.20.61','CoverageFit v3.20.62'].includes(manifest.receiver));
check('canonical rate QR route resolves', flyer.parsePath('/home/qr/95118/rate/').campaignId === 'home_flyer_95118_rate');
check('canonical fit QR route resolves', flyer.parsePath('/home/qr/95118/fit/').campaignId === 'home_flyer_95118_fit');
check('route templates are deterministic', flyer.routeFor('10001', 'A') === 'https://408farmers.com/home/qr/10001/rate/' && flyer.routeFor('10001', 'B') === 'https://408farmers.com/home/qr/10001/fit/');
check('existing query QR remains compatible', flyer.readLocation({ pathname: '/home/', search: '?campaign_zip=95118&campaign_variant=A&utm_medium=qr' }).campaignId === 'home_flyer_95118_rate');
check('invalid or incomplete routes safely decline campaign mode', !flyer.parsePath('/home/qr/9511/rate/').active && !flyer.parsePath('/home/qr/95118/savings/').active && !flyer.parsePath('/home/qr/95118/').active);

const rate = flyer.matchedCopy(flyer.parsePath('/home/qr/95118/rate/'));
const fit = flyer.matchedCopy(flyer.parsePath('/home/qr/95118/fit/'));
check('rate creative is message matched and bounded', rate.title.includes('Competitive Farmers Rate in 95118') && rate.lead === 'Every home is rated differently.' && !/guarantee|save \$|eligible/i.test(Object.values(rate).join(' ')));
check('fit creative is message matched and non-decisional', fit.title.includes('Strong Fit for Farmers in 95118') && /not a quote or eligibility decision/i.test(fit.reassurance));
check('campaign copy never replaces engagement answers', !['home_review_goal', 'housing_context', 'review_timing'].some(field => JSON.stringify(flyer.COPY).includes(field)));
check('home surface exposes every bounded campaign copy target', ['badge', 'eyebrow', 'title', 'lead', 'copy', 'cta', 'reassurance'].every(name => home.includes(`data-home-campaign-${name}`)));
check('short paths route through the one canonical Home document', read('_worker.js').includes("path.startsWith('/home/qr/')") && read('_worker.js').includes("asset: '/home/'") && !redirects.includes('/home/index.html')); 
check('campaign events are bounded journey events', journey.EVENTS.CAMPAIGN_MATCHED === 'home_campaign_matched' && journey.EVENTS.QR_ROUTE_RESOLVED === 'home_qr_route_resolved' && baseline.includes("'campaign_entry', 'message_variant', 'route_type'"));
check('manifest preserves the same three-question and lead journey', manifest.homeCampaignMatching.sameJourney === '/home/' && manifest.homeCampaignMatching.engagementQuestionsChanged === false && manifest.homeCampaignMatching.leadCaptureChanged === false);
check('campaign routing is privacy bounded', /No name, email, phone, street address/.test(contract.privacy) && !/campaignZip|campaignVariant|campaignId/.test(score));
check('assessment and Protection Score stay unchanged', manifest.homeCampaignMatching.assessmentQuestionsChanged === false && manifest.homeCampaignMatching.protectionScoreChanged === false && contract.scoring.campaignFieldsAffectProtectionScore === false);

console.log(`408-HOME-2.7 QA: ${checks.length}/${checks.length} passed`);
