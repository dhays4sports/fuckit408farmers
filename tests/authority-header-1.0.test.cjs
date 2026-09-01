const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const runtimePages = [
  'index.html', '404.html', 'privacy.html', 'terms.html',
  'home/index.html', 'home/thank-you.html',
  'auto-bundle/index.html', 'auto-bundle/thank-you.html',
  'buyer/index.html', 'buyer/thank-you.html',
  'life/index.html', 'life/thank-you.html', 'life-ops/index.html',
  'tech/index.html', 'tech/thank-you.html',
  'healthcare/index.html', 'healthcare/thank-you.html',
  'teachers/index.html', 'teachers/thank-you.html',
  'engineers/index.html', 'engineers/thank-you.html',
  'score/index.html', 'contact/index.html', 'neighbor/index.html',
  'local/index.html', 'local/detail/index.html',
  'local/join/index.html', 'local/join/thank-you.html'
];

test('every runtime page carries the authority-first header', () => {
  for (const relative of runtimePages) {
    const html = fs.readFileSync(path.join(root, relative), 'utf8');
    assert.match(html, /data-authority-build="408-AUTHORITY-1\.0"/, relative);
    assert.match(html, /farmers-insurance-official\.svg/, relative);
    assert.match(html, /Virginia Tam Insurance Agency, Inc\./, relative);
    assert.match(html, /Dylan Haysbert · CA License #4528400/, relative);
    assert.doesNotMatch(
      html,
      /agency-authority-header__farmers[^\n]*farmers-authorized-agency/,
      `${relative} must not use the Authorized Agency credential in the top header`
    );
  }
});

test('official logo is local, unchanged in markup, and shared CSS is reachable', () => {
  const logo = fs.readFileSync(path.join(root, 'shared/assets/farmers-insurance-official.svg'), 'utf8');
  assert.match(logo, /viewBox="0 0 380\.41 202\.93"/);
  assert.match(logo, /fill: #263b80/);
  assert.match(logo, /fill: #df1e33/);

  for (const stylesheet of ['styles.css', 'buyer.css', 'score.css', 'referral-bridge.css']) {
    const css = fs.readFileSync(path.join(root, 'shared', stylesheet), 'utf8');
    const importIndex = css.indexOf('@import url("./authority-header.css")');
    assert.notEqual(importIndex, -1, stylesheet);
    const firstRule = css.search(/(?:^|\n)(?!@import)[.#:[a-zA-Z]/);
    assert.ok(firstRule === -1 || importIndex < firstRule, `${stylesheet} loads authority CSS before rules`);
  }
});

test('408FARMERS mnemonic brand remains present for continuity', () => {
  const primaryPages = [
    'index.html', 'home/index.html', 'auto-bundle/index.html', 'buyer/index.html',
    'life/index.html', 'tech/index.html', 'healthcare/index.html',
    'teachers/index.html', 'engineers/index.html', 'score/index.html'
  ];
  for (const relative of primaryPages) {
    const html = fs.readFileSync(path.join(root, relative), 'utf8');
    assert.match(html, /408-farmers-(?:logo|nav-logo)/, relative);
  }
});
