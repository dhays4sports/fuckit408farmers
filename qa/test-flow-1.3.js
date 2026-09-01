const fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
let p=0,f=0; const check=(n,v)=>{try{assert.ok(v,n);console.log('PASS',n);p++;}catch(e){console.error('FAIL',n);f++;}};
const profile=read('shared/prospect-profile.js'), launcher=read('shared/coveragefit-launch.js');
check('runtime preserves FLOW-1.3 after buyer or CRO release',['408-BUY-1.5','408-CRO-1.1','408-CRO-1.2','408-CRO-1.3','408-CRO-1.4', '408-CRO-1.5', '408-CRO-1.6', '408-CRO-1.6.1', '408-CRO-1.6.2', '408-CRO-1.6.2.1','408-LIFE-1.1','408-LIFE-1.2','408-LIFE-1.3','408-LIFE-1.4','408-LIFE-1.4.1','408-LIFE-1.5','408-LIFE-1.6','408-LIFE-1.7','408-FLOW-1.5','408-HOME-2.1','408-HOME-2.2','408-HOME-2.3','408-HOME-2.4','408-HOME-2.5','408-HOME-2.6','408-HOME-2.7','408-HOME-2.8','408-HOME-2.9','408-FLOW-2.1','408-FLOW-2.2','408-FLOW-2.3','408-FLOW-2.4','408-CF-RPT-1.1','408-FLOW-2.5'].includes(read('VERSION').trim()));
check('profile has distinct semantic fields',/reviewContext: field\(form, 'review_context'\)/.test(profile)&&/occupationSegment: field\(form, 'occupation_segment'\)/.test(profile)&&/housingContext: field\(form, 'housing_context'\)/.test(profile));
check('launcher uses distinct handoff params',/reviewContext: 'review_context'/.test(launcher)&&/occupationSegment: 'occupation_segment'/.test(launcher)&&/housingContext: 'housing_context'/.test(launcher));
for(const page of ['healthcare','teachers','tech','engineers']){
  const html=read(`${page}/index.html`);
  check(`${page} role is occupation context`,html.includes('name="occupation_segment"')&&!html.includes('name="segment"'));
  check(`${page} has separate review reason`,html.includes('name="review_context" value="Professional eligibility and home coverage review"'));
}
const home=read('home/index.html'),buyer=read('buyer/index.html'),bundle=read('auto-bundle/index.html');
check('home uses review_context',home.includes('name="review_context"')&&!home.includes('name="segment"'));
check('buyer uses review_context',buyer.includes('name="review_context" value="Buying a home"')&&!buyer.includes('name="segment"'));
check('bundle housing is separate',bundle.includes('name="housing_context"')&&bundle.includes('name="review_context" value="Home and auto together"')&&!bundle.includes('name="segment"'));
console.log(`FLOW-1.3 sender: ${p} passed, ${f} failed`); process.exit(f?1:0);
