const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('/auto-bundle uses housing, current coverage, then minimum identity', () => {
  const html = read('auto-bundle/index.html');
  const housing = html.indexOf('data-bundle-step="housing"');
  const coverage = html.indexOf('data-bundle-step="coverage"');
  const capture = html.indexOf('data-bundle-step="capture"');
  assert.ok(housing > 0 && housing < coverage && coverage < capture);
  for (const key of ['homeowner', 'renter']) assert.match(html, new RegExp(`data-bundle-housing="${key}"`));
  for (const key of ['both', 'home_only', 'auto_only', 'neither', 'not_sure']) assert.match(html, new RegExp(`data-bundle-status="${key}"`));
  assert.match(html, /Continue to my Snapshot/);
  assert.match(html, /Continue without saving/);
});

test('/auto-bundle checkpoint asks only for first name, mobile, and consent', () => {
  const html = read('auto-bundle/index.html');
  const start = html.indexOf('data-bundle-step="capture"');
  const section = html.slice(start, html.indexOf('</fieldset>', start));
  assert.match(section, /name="first_name"[^>]*required/);
  assert.match(section, /name="phone"[^>]*required/);
  assert.match(section, /name="consent"[^>]*required/);
  assert.match(section, /name="automated_marketing_sms_consent"/);
  for (const forbidden of ['last_name', 'email', 'property_address', 'current_carrier', 'renewal_date']) {
    assert.doesNotMatch(section, new RegExp(`name="${forbidden}"`));
  }
});

test('/auto-bundle keeps attribution, secure handoff, optional invitation, and callback continuity', () => {
  const html = read('auto-bundle/index.html');
  const flow = read('shared/auto-bundle-progressive-1.0.js');
  const profile = read('shared/prospect-profile.js');
  for (const field of ['source_key', 'campaign_id', 'campaign_variant', 'creative', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']) {
    assert.match(html, new RegExp(`name="${field}"`));
  }
  assert.match(html, /data-handoff-contract="coveragefit-secure-discovery-handoff-v1"/);
  assert.match(html, /data-coveragefit-invitation="true"/);
  assert.match(html, /callback-scheduling-continuity\.js/);
  assert.match(flow, /408farmers:continue-without-saving/);
  assert.match(profile, /bundleStatus: field\(form, 'bundle_status'\)/);
});
