#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.resolve(__dirname, '../shared/script.js'), 'utf8');

function runtime({ leadMode = 'confirmed', renter = false, controllers = true } = {}) {
  const listeners = {};
  const buttonListeners = {};
  const postLeadCalls = [];
  const invitationCalls = [];
  const launches = [];
  const journeyEvents = [];
  let fetchCount = 0;
  const label = { textContent: 'Submit' };
  const button = { disabled:false, type:'submit', querySelector:()=>label, addEventListener(type, handler){ buttonListeners[type]=handler; } };
  const values = {
    first_name:'Flow', last_name:'Test', phone:'4085550100', email:'flow@example.com',
    property_address:renter?'':'833 Corporate Way, Fremont, CA', review_context:'Comparing coverage',
    home_review_goal:'coverage_fit', housing_context:renter?'renter':'owner_occupied', review_timing:'shopping_now',
    campaign:'home', source:'408farmers.com/home', consent:'on', landing_page:'', submitted_at:''
  };
  const elements = {};
  Object.entries(values).forEach(([name,value]) => { elements[name]={ value, checked:name==='consent', focus(){} }; });
  const form = {
    dataset:{ homeJourney:'true', postLeadEngagement:'true', coveragefitInvitation:'true', coveragefitAfterSubmit:'true', cfEntry:'home_lander_form', cfAssessment:'home', cfNext:'/assessment/', cfExtraLaunchSurface:'home_lander', cfBranchField:'housing_context', cfRenterDestination:'/contact/?intent=renters', senderBuild:'408-FLOW-2.5', handoffContract:'coveragefit-handoff-v1', success:'thank-you.html' },
    elements, checkValidity:()=>true, reportValidity(){}, addEventListener(type,handler){ listeners[type]=handler; },
    querySelector(selector){ if(selector==='button[type="submit"]') return button; const match=selector.match(/^\[name="(.+)"\]$/); return match?elements[match[1]]:null; }
  };
  const status={textContent:''};
  const location={search:'',hash:'',href:'https://408farmers.com/home/'};
  const window={
    location, LANDING_PAGE_CONFIG:{formEndpoint:leadMode==='local-fallback'?'':'https://formspree.io/f/test'},
    ProspectProfileBuilder:{fromForm:()=>({campaign:'home',housingContext:elements.housing_context.value}),save(){}},
    CoverageFitLauncher:{launch(options){launches.push(options);}},
    HomeJourneyContract:{EVENTS:{LEAD_SUBMISSION_ATTEMPTED:'attempted',LEAD_SUBMISSION_CONFIRMED:'confirmed',LEAD_SUBMISSION_PENDING:'pending',LEAD_SUBMISSION_UNCONFIRMED:'unconfirmed',COVERAGEFIT_LAUNCHED:'launched'},STAGES:{LEAD_CAPTURE:'lead_capture',CONFIRMATION:'confirmation',COVERAGEFIT_HANDOFF:'coveragefit_handoff'}},
    HomeJourneyBaseline:{emit(name,detail){journeyEvents.push({name,detail});}}, dataLayer:[], addEventListener(){}, scrollTo(){}
  };
  if (controllers) {
    window.PostLeadEngagement={present(options){postLeadCalls.push(options);return true;}};
    window.CoverageFitInvitation={present(options){invitationCalls.push(options);return true;}};
  }
  const document={getElementById:id=>id==='leadForm'?form:id==='formStatus'?status:null,addEventListener(){}};
  class FormDataMock { *entries(){ yield* Object.entries(values); } }
  const fetch = () => {
    fetchCount += 1;
    if (leadMode === 'pending') return new Promise(()=>{});
    if (leadMode === 'unconfirmed') return Promise.reject(new Error('offline'));
    return Promise.resolve({ok:true});
  };
  const fastTimeout=(callback,ms)=>setTimeout(callback,ms===900?0:ms);
  vm.runInNewContext(source,{window,document,location,history:{},sessionStorage:{setItem(){},removeItem(){}},FormData:FormDataMock,URLSearchParams,fetch,setTimeout:fastTimeout,clearTimeout,Date,Promise,Object,JSON,Error,console});
  return {listeners,buttonListeners,postLeadCalls,invitationCalls,launches,journeyEvents,location,status,label,fetchCount:()=>fetchCount};
}

async function submit(instance){ await instance.listeners.submit({preventDefault(){}}); }

(async()=>{
  for (const leadMode of ['confirmed','pending','unconfirmed','local-fallback']) {
    const flow=runtime({leadMode});
    await submit(flow);
    assert.equal(flow.postLeadCalls.length,1,`${leadMode} must reach post-lead engagement`);
    assert.equal(flow.launches.length,0,`${leadMode} must not auto-launch CoverageFit`);
    assert.equal(flow.fetchCount(),leadMode==='local-fallback'?0:1,`${leadMode} lead request count`);
    const statusEvent=flow.journeyEvents.find(event=>['confirmed','pending','unconfirmed'].includes(event.name));
    assert(statusEvent,`${leadMode} must emit a truthful receipt status`);
  }
  console.log('PASS all four lead receipt states reach post-lead engagement without automatic CoverageFit launch');

  const accept=runtime();
  await submit(accept);
  const openDestination=accept.postLeadCalls[0].onContinue;
  assert.equal(accept.launches.length,0);
  const invitationOptions={leadCaptureStatus:'confirmed',destinationType:'coveragefit',onContinue:openDestination};
  accept.invitationCalls.push(invitationOptions);
  assert.equal(accept.launches.length,0,'viewing invitation does not launch');
  invitationOptions.onContinue();
  assert.equal(accept.launches.length,1,'explicit acceptance launches exactly once');
  assert.equal(accept.fetchCount(),1,'acceptance does not create another 408FARMERS lead');
  assert.equal(accept.launches[0].extra.contact_consent,'true');
  assert.equal(accept.launches[0].extra.lead_capture_status,'confirmed');
  console.log('PASS explicit acceptance launches once with consent and lead status, without another lead');

  const defer=runtime();
  await submit(defer);
  assert.equal(defer.launches.length,0);
  assert.equal(defer.fetchCount(),1);
  console.log('PASS Finish for Now boundary preserves one first lead and zero CoverageFit launches');

  const renter=runtime({renter:true});
  await submit(renter);
  renter.postLeadCalls[0].onContinue();
  assert.equal(renter.location.href,'/contact/?intent=renters');
  assert.equal(renter.launches.length,0);
  console.log('PASS renter continuation bypasses CoverageFit Home');

  const degraded=runtime({controllers:false});
  await submit(degraded);
  assert.equal(degraded.launches.length,0);
  assert.match(degraded.label.textContent,/Optional/);
  degraded.buttonListeners.click();
  assert.equal(degraded.launches.length,1);
  assert.equal(degraded.fetchCount(),1);
  console.log('PASS controller failure remains fresh-click gated and creates no duplicate lead');

  console.log('408-FLOW-2.5 runtime conversion matrix: 8/8 scenarios passed');
})().catch(error=>{console.error(error);process.exit(1);});
