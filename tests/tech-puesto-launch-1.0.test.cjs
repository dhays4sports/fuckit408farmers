const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('TECH uses the required tap-first role, housing, minimum identity sequence', () => {
  const html = read('tech/index.html');
  const role = html.indexOf('data-tech-step="role"');
  const housing = html.indexOf('data-tech-step="housing"');
  const capture = html.indexOf('data-tech-step="capture"');
  assert.ok(role > 0 && role < housing && housing < capture);
  for (const key of ['software_engineering','it_cybersecurity','data_analytics','product_program','design_ux','tech_operations_support','other_tech']) assert.match(html, new RegExp(`data-tech-role="${key}"`));
  assert.match(html, /data-tech-housing="homeowner"/);
  assert.match(html, /data-tech-housing="renter"/);
  assert.match(html, /Keep your review connected\./);
  assert.match(html, /Continue to my Snapshot/);
  assert.match(html, /Continue without saving/);
});

test('TECH early checkpoint asks only for minimum fallback identity', () => {
  const html = read('tech/index.html');
  const section = html.slice(html.indexOf('data-tech-step="capture"'), html.indexOf('</fieldset>', html.indexOf('data-tech-step="capture"')));
  assert.match(section, /name="first_name"/);
  assert.match(section, /name="phone"/);
  assert.match(section, /name="consent"[^>]*required/);
  for (const forbidden of ['last_name','property_address','current_carrier','renewal_date','preferred_contact_time']) assert.doesNotMatch(section, new RegExp(`name="${forbidden}"`));
  assert.doesNotMatch(html, /data-post-lead-engagement|data-coveragefit-invitation/);
});

test('TECH preserves professional boundaries, attribution, and secure handoff context', () => {
  const html = read('tech/index.html');
  const flow = read('shared/tech-puesto-launch-1.0.js');
  const handoff = read('shared/script.js');
  assert.match(html, /name="professional_program"[^>]*value="technology"/);
  for (const field of ['campaign_id','campaign_variant','creative','utm_source','utm_medium','utm_campaign','utm_content','utm_term']) assert.match(html, new RegExp(`name="${field}"`));
  for (const event of ['landing_viewed','role_selected','housing_selected','early_capture_presented','early_capture_skipped']) assert.match(flow, new RegExp(event));
  for (const event of ['early_lead_confirmed','coveragefit_started']) assert.match(handoff, new RegExp(event));
  for (const field of ['professional_program','professional_role','professional_role_label']) assert.match(handoff, new RegExp(field));
  assert.match(html, /This does not authorize automated marketing texts/);
  assert.doesNotMatch(flow, /eligible\s*=\s*true|qualified\s*=\s*true|approved\s*=\s*true/i);
});
