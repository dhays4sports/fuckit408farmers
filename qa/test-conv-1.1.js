#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const BUILD = '408-CONV-1.1';
const pages = ['home/index.html','tech/index.html','engineers/index.html','healthcare/index.html','teachers/index.html'];
const checks=[];
function check(name, fn){ fn(); checks.push(name); console.log('PASS', name); }
function storage(){ const m=new Map(); return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)}; }
function runtime(){
  const window={
    location:{origin:'https://408farmers.com',pathname:'/home/',search:'?utm_source=door_flyer',assign(){}},
    sessionStorage:storage(),localStorage:storage(),crypto:{randomUUID:()=> 'conv-session'},dataLayer:[],
    LANDING_PAGE_CONFIG:{coverageFitTransitionUrl:'https://coveragefit.com/transition/',coverageFitHomeUrl:'https://coveragefit.com/home/',coverageFitFallbackUrl:'/home#form'},
    CustomEvent:function(type,init){this.type=type;this.detail=init?.detail;}
  };
  const document={readyState:'complete',querySelectorAll:()=>[],addEventListener(){},dispatchEvent(){}};
  const context=vm.createContext({window,document,URL,URLSearchParams,Object,Date,Math,String,JSON,console});
  vm.runInContext(read('shared/coveragefit-launch.js'),context);
  vm.runInContext(read('shared/prospect-profile.js'),context);
  return window;
}
check('all supported forms declare the current sender and direct assessment route',()=>{
  for(const rel of pages){ const html=read(rel); const expectedBuild=rel==='home/index.html'?'408-HOME-2.9':BUILD; assert(html.includes(`data-sender-build="${expectedBuild}"`),rel); assert(html.includes('data-handoff-contract="coveragefit-handoff-v1"'),rel); assert(html.includes('data-cf-next="/assessment/"'),rel); }
});
check('Home CTA continues into the Coverage Review',()=> assert(['Start My 5-Minute Coverage Review','Continue to My Coverage Review'].some(copy => read('home/index.html').includes(copy))));
check('launcher retains Home default unless an explicit next route is supplied',()=>{
  const url=new URL(runtime().CoverageFitLauncher.buildUrl({entry:'generic_exploratory'}));
  assert.equal(url.pathname,'/transition/'); assert.equal(url.searchParams.get('next'),'/home/');
});
check('validated form handoff can explicitly continue to assessment',()=>{
  const w=runtime();
  const profile={firstName:'Dylan',lastName:'Test',phone:'4085551212',email:'dylan@example.com',propertyAddress:'123 Main St, Fremont, CA 94539',reviewContext:'Current policy renewal',address:{street:'123 Main St',city:'Fremont',state:'CA',postalCode:'94539',country:'US',selectionMethod:'autocomplete'}};
  const url=new URL(w.CoverageFitLauncher.buildUrl({profile,entry:'home_lander_form',assessment:'home',next:'/assessment/',extra:{launch_surface:'home_lander',lead_captured:'true',lead_capture_status:'confirmed',sender_build:BUILD,handoff_contract:'coveragefit-handoff-v1',handoff_version:'1.1',contact_consent:'true',consent_at:'2026-08-05T14:00:00.000Z',consent_version:'408farmers-contact-v1',submitted_at:'2026-08-05T14:00:00.000Z'}}));
  assert.equal(url.origin+url.pathname,'https://coveragefit.com/transition/');
  assert.equal(url.searchParams.get('next'),'/assessment/');
  for(const [key,val] of Object.entries({sender_build:BUILD,handoff_contract:'coveragefit-handoff-v1',handoff_version:'1.1',contact_consent:'true',consent_version:'408farmers-contact-v1',lead_capture_status:'confirmed'})) assert.equal(url.searchParams.get(key),val,key);
  assert.equal(url.searchParams.get('first_name'),'Dylan'); assert.equal(url.searchParams.get('property_zip'),'94539'); assert.equal(url.searchParams.get('utm_source'),'door_flyer');
});
check('profile builder records required-checkbox consent provenance',()=>{
  const w=runtime(); const values={first_name:'Dylan',last_name:'Test',phone:'4085551212',email:'Dylan@Example.com',property_address:'123 Main St',property_formatted_address:'123 Main St, Fremont, CA 94539',property_street:'123 Main St',property_city:'Fremont',property_county:'Alameda',property_state:'CA',property_zip:'94539',property_country:'US',property_place_id:'place-1',address_selection_method:'autocomplete',segment:'Premium increased',campaign:'Home Review',source:'408farmers.com/home',submitted_at:'2026-08-05T14:00:00.000Z',utm_source:'door_flyer',utm_medium:'offline',utm_campaign:'fremont_01',utm_content:'',utm_term:'',consent:'on'};
  const elements={}; for(const [k,v] of Object.entries(values)) elements[k]={value:v,checked:k==='consent'};
  const profile=w.ProspectProfileBuilder.fromForm({elements});
  assert.equal(profile.contactPermission.confirmed,true); assert.equal(profile.contactPermission.basis,'408farmers_required_form_checkbox'); assert.equal(profile.contactPermission.capturedAt,values.submitted_at); assert.equal(profile.contactPermission.version,'408farmers-contact-v1');
});
check('shared submit controller transmits zero-repeat provenance only after validation',()=>{
  const code=read('shared/script.js');
  for(const token of ["next: form.dataset.cfNext || '/assessment/'","contact_consent:","consent_at:","consent_version:","submitted_at:","keepalive:true","Promise.race"]) assert(code.includes(token),token);
  assert(code.indexOf('if (!form.checkValidity())') < code.indexOf('contact_consent:'), 'validation must precede handoff construction');
});
check('manifest aligns to the current receiver contract',()=>{
  const m=JSON.parse(read('handoff-manifest.json')); assert.equal(m.build,BUILD); assert.ok(['CoverageFit v3.20.51','CoverageFit v3.20.52','CoverageFit v3.20.53','CoverageFit v3.20.54','CoverageFit v3.20.55','CoverageFit v3.20.56','CoverageFit v3.20.57','CoverageFit v3.20.58','CoverageFit v3.20.59','CoverageFit v3.20.60','CoverageFit v3.20.61','CoverageFit v3.20.62'].includes(m.receiver)); assert.equal(m.minimumCompatibleReceiver,'CoverageFit v3.20.13'); assert.equal(m.coverageFit.launch,'https://coveragefit.com/transition/?next=%2Fassessment%2F'); assert.equal(m.handoff.consentVersion,'408farmers-contact-v1');
});
console.log(`\nCONV-1.1 sender QA: ${checks.length}/${checks.length} passed`);
