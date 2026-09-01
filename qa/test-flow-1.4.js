const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const manifest = JSON.parse(read('handoff-manifest.json'));
const checks = [];
const check = (name, value) => { assert.ok(value, name); checks.push(name); };

check('408 runtime preserves FLOW-1.4 after buyer or CRO release', ['408-BUY-1.5','408-CRO-1.1','408-CRO-1.2','408-CRO-1.3','408-CRO-1.4', '408-CRO-1.5', '408-CRO-1.6', '408-CRO-1.6.1', '408-CRO-1.6.2', '408-CRO-1.6.2.1','408-LIFE-1.1','408-LIFE-1.2','408-LIFE-1.3','408-LIFE-1.4','408-LIFE-1.4.1','408-LIFE-1.5','408-LIFE-1.6','408-LIFE-1.7','408-FLOW-1.5','408-HOME-2.1','408-HOME-2.2','408-HOME-2.3','408-HOME-2.4','408-HOME-2.5','408-HOME-2.6','408-HOME-2.7','408-HOME-2.8','408-HOME-2.9','408-FLOW-2.1','408-FLOW-2.2','408-FLOW-2.3','408-FLOW-2.4','408-CF-RPT-1.1','408-FLOW-2.5'].includes(read('VERSION').trim()));
check('FLOW synchronization advances to 1.4', manifest.flowNormalization.build === '408-FLOW-1.4');
check('receiver is CoverageFit v3.20.29', manifest.flowNormalization.transitionMessaging.receiver === 'CoverageFit v3.20.29');
check('transition remains receiver-driven', manifest.flowNormalization.transitionMessaging.status === 'receiver-driven' && manifest.flowNormalization.transitionMessaging.senderRuntimeChanged === false);
check('all major entry classes are synchronized', ['homebuyer','professional','home_auto','general_homeowner','time_sensitive'].every(value => manifest.flowNormalization.transitionMessaging.variants.includes(value)));
check('semantic parameters remain canonical', manifest.flowNormalization.semanticContext.reviewContextParam === 'review_context' && manifest.flowNormalization.semanticContext.occupationParam === 'occupation_segment' && manifest.flowNormalization.semanticContext.housingContextParam === 'housing_context');
check('legacy segment fallback remains documented', manifest.flowNormalization.semanticContext.legacyFallback === 'segment');
check('one assessment rule remains explicit', /one context-sensitive CoverageFit transition and one Home assessment/.test(manifest.flowNormalization.transitionMessaging.rule));

console.log(`408-FLOW-1.4 synchronization: ${checks.length}/${checks.length} passed`);
