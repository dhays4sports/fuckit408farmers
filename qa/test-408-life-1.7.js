#!/usr/bin/env node
'use strict';
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path');
const {pathToFileURL}=require('url');
const root=path.resolve(__dirname,'..'),read=r=>fs.readFileSync(path.join(root,r),'utf8'),exists=r=>fs.existsSync(path.join(root,r));
const checks=[]; function check(name,value){assert.ok(value,name);checks.push(name)}

async function loadWorker(){
  const src=read('_worker.js');
  const transformed=src.replace('export default {','const worker = {')+'\nexport { worker, normalizeConversion, funnelShape, productionReadiness, BUILD };\n';
  const temp=path.join(os.tmpdir(),`408-life17-${process.pid}-${Date.now()}.mjs`); fs.writeFileSync(temp,transformed);
  try{return await import(pathToFileURL(temp).href+'?v='+Date.now())}finally{fs.unlinkSync(temp)}
}
class ConversionStatement{
  constructor(db,sql){this.db=db;this.sql=sql.replace(/\s+/g,' ').trim();this.args=[]} bind(...args){this.args=args;return this}
  async run(){
    if(/INSERT INTO life_conversion_events/i.test(this.sql)){
      const [event_id,journey_id,event_name,occurred_at,landing_variant,creative_code,utm_source,utm_medium,utm_campaign,utm_content,campaign_id,campaign_variant]=this.args;
      const unique=journey_id+'|'+event_name; if(this.db.unique.has(unique)||this.db.events.some(e=>e.event_id===event_id))return {meta:{changes:0}};
      this.db.unique.add(unique);this.db.events.push({event_id,journey_id,event_name,occurred_at,landing_variant,creative_code,utm_source,utm_medium,utm_campaign,utm_content,campaign_id,campaign_variant});return {meta:{changes:1}};
    }
    throw new Error('Unhandled run '+this.sql)
  }
  async all(){
    if(/FROM life_conversion_events/i.test(this.sql)){
      const groups=new Map(); for(const e of this.db.events){const k=e.event_name+'|'+e.creative_code;groups.set(k,(groups.get(k)||0)+1)}
      return {results:[...groups.entries()].map(([k,n])=>{const [event_name,creative_code]=k.split('|');return {event_name,creative_code,event_count:n}})};
    }
    return {results:[]};
  }
  async first(){return null}
}
class ConversionD1{constructor(){this.events=[];this.unique=new Set();this.execCalls=0}async exec(){this.execCalls++;return {count:0}}prepare(sql){return new ConversionStatement(this,sql)}}
function conversionPayload(event='landing_view',id='11111111-1111-4111-8111-111111111111'){
  return {schema_version:'408-life-conversion-v1',event_id:id,journey_id:'22222222-2222-4222-8222-222222222222',event_name:event,attribution:{channel:'life_campaign',landing_variant:'20_minutes',creative_code:'B',utm_source:'meta',utm_medium:'paid_social',utm_campaign:'life_insurability',utm_content:'20_minutes',campaign_id:'life-2026-01',campaign_variant:'B'}};
}
function request(payload,headers={}){return new Request('https://408farmers.com/api/life/conversion',{method:'POST',headers:Object.assign({'Origin':'https://408farmers.com','Sec-Fetch-Site':'same-origin','Content-Type':'application/json','X-Life-Conversion-Version':'1'},headers),body:JSON.stringify(payload)})}

(async()=>{
  const version=read('VERSION').trim(),manifest=JSON.parse(read('handoff-manifest.json')),life=read('life/index.html'),conv=read('shared/life-conversion.js'),worker=read('_worker.js'),ops=read('shared/life-ops.js'),opsHtml=read('life-ops/index.html'),cert=read('LIFE-PRODUCTION-CERTIFICATION.md');
  check('runtime preserves LIFE-1.7', ['408-LIFE-1.7','408-FLOW-1.5','408-HOME-2.1','408-HOME-2.2','408-HOME-2.3','408-HOME-2.4','408-HOME-2.5','408-HOME-2.6','408-HOME-2.7','408-HOME-2.8','408-HOME-2.9','408-FLOW-2.1','408-FLOW-2.2','408-FLOW-2.3','408-FLOW-2.4','408-CF-RPT-1.1','408-FLOW-2.5'].includes(version) && manifest.runtime===version && manifest.lifeCampaignFoundation?.build==='408-LIFE-1.7');
  for(const f of ['shared/life-conversion.js','SPRINT-408-LIFE-1.7.md','LIFE-PRODUCTION-CERTIFICATION.md'])check('exists:'+f,exists(f));
  check('conversion module loads after campaign and before intake',life.indexOf('life-campaign.js')<life.indexOf('life-conversion.js')&&life.indexOf('life-conversion.js')<life.indexOf('life-intake.js'));
  check('five bounded conversion events exist',['landing_view','start_clicked','quick_questions_complete','application_details_started','application_start_submitted'].every(x=>conv.includes(x)&&worker.includes(x)));
  check('conversion measurement is same-origin only',conv.includes("var ENDPOINT = '/api/life/conversion';")&&conv.includes("credentials: 'same-origin'")&&worker.includes("const CONVERSION_PATH = '/api/life/conversion';"));
  check('conversion measurement is fail-open',conv.includes('.catch(function ()')&&/never blocks/i.test(conv));
  check('conversion IDs are memory-only',conv.includes('var journeyId = createId();')&&!/localStorage|sessionStorage|indexedDB|document\.cookie/.test(conv));
  check('conversion module never references applicant fields',!/(ssn_last4|date_of_birth|first_name|last_name|residential_address|email|phone|gender|protection_priority|income_runway|existing_life_coverage)/.test(conv));
  check('no third-party analytics introduced',!/fbq\(|facebook\.com\/tr|connect\.facebook|gtag\(|googletagmanager|dataLayer|CAPI|Meta Pixel/i.test(conv+life));
  check('Worker exact-key conversion normalization exists',worker.includes('function normalizeConversion(payload)')&&worker.includes("exactKeys(payload, ['schema_version','event_id','journey_id','event_name','attribution'])"));
  check('conversion D1 table has no applicant columns',worker.includes('CREATE TABLE IF NOT EXISTS life_conversion_events')&&!worker.split('CREATE TABLE IF NOT EXISTS life_conversion_events (')[1].split(');')[0].match(/ssn_last4|date_of_birth|first_name|last_name|residential_address|email|phone|gender/i));
  check('conversion events dedupe by journey + event',worker.includes('idx_life_conversion_journey_event')&&worker.includes('journey_id, event_name'));
  check('conversion endpoint does not block secure application endpoint',worker.includes('if (url.pathname === API_PATH) return handleApplicationInit')&&worker.includes('if (url.pathname === CONVERSION_PATH) return handleConversion'));
  check('protected conversion summary exists',worker.includes("const OPS_CONVERSIONS_PATH = '/api/life/producer/conversions';")&&ops.includes("var CONVERSIONS = '/api/life/producer/conversions';"));
  check('protected production readiness exists',worker.includes("const OPS_READINESS_PATH = '/api/life/producer/readiness';")&&ops.includes("var READINESS = '/api/life/producer/readiness';"));
  check('readiness checks critical Cloudflare bindings',['assets_binding','queue_db_binding','queue_schema','encryption_key','allowed_origin','access_team_domain','access_audience','producer_allowlist'].every(x=>worker.includes(x)));
  check('ops renders funnel and readiness',opsHtml.includes('Production readiness')&&opsHtml.includes('First-party conversion snapshot')&&ops.includes('renderFunnel')&&ops.includes('renderReadiness'));
  check('manifest enables bounded conversion analytics',manifest.lifeCampaignFoundation?.conversionMeasurementEnabled===true&&manifest.lifeCampaignFoundation?.conversionMeasurementMode==='first_party_same_origin_cloudflare_d1_non_pii');
  check('manifest keeps sensitive analytics disabled',manifest.lifeCampaignFoundation?.sensitiveAnalyticsEnabled===false);
  check('manifest marks release ready with explicit activation condition',manifest.lifeCampaignFoundation?.paidTrafficReady===true&&/readiness/i.test(manifest.lifeCampaignFoundation?.paidTrafficActivationCondition||'')&&manifest.lifeCampaignFoundation?.nextSprint===null);
  check('manifest does not falsely claim live smoke test',manifest.lifeCampaignFoundation?.liveProductionSmokeTestPerformed===false);
  check('production cert explicitly requires post-deploy canary',/canary/i.test(cert)&&/does not falsely claim/i.test(cert));

  const mod=await loadWorker(); const db=new ConversionD1(); const env={LIFE_ALLOWED_ORIGIN:'https://408farmers.com',LIFE_QUEUE_DB:db,LIFE_QUEUE_ENCRYPTION_KEY_B64:Buffer.alloc(32,9).toString('base64'),LIFE_ACCESS_TEAM_DOMAIN:'team.cloudflareaccess.com',LIFE_ACCESS_AUD:'aud',LIFE_PRODUCER_EMAILS:'producer@example.com',ASSETS:{fetch:async()=>new Response('asset')}};
  const normalized=mod.normalizeConversion(conversionPayload());
  check('normalizer accepts canonical conversion payload',normalized&&normalized.event_name==='landing_view'&&normalized.attribution.creative_code==='B');
  const withPii=conversionPayload(); withPii.email='person@example.com';
  check('normalizer rejects unexpected PII field',mod.normalizeConversion(withPii)===null);
  const badEvent=conversionPayload('date_of_birth_entered');
  check('normalizer rejects unknown event',mod.normalizeConversion(badEvent)===null);

  let response=await mod.worker.fetch(request(conversionPayload()),env);
  check('public conversion endpoint accepts valid event',response.status===202&&(await response.json()).ok===true&&db.events.length===1);
  response=await mod.worker.fetch(request(conversionPayload('landing_view','33333333-3333-4333-8333-333333333333')),env);
  check('same journey/event is deduplicated server-side',response.status===202&&db.events.length===1);
  response=await mod.worker.fetch(request(conversionPayload('start_clicked','44444444-4444-4444-8444-444444444444')),env);
  check('next funnel milestone is stored',response.status===202&&db.events.length===2);
  response=await mod.worker.fetch(request(conversionPayload(),{'Origin':'https://evil.example'}),env);
  check('conversion wrong origin fails closed',response.status===403&&db.events.length===2);
  const polluted=conversionPayload('quick_questions_complete','55555555-5555-4555-8555-555555555555'); polluted.attribution.utm_term='secret';
  check('conversion attribution rejects unallowlisted utm_term',mod.normalizeConversion(polluted)===null);

  const funnel=mod.funnelShape([{event_name:'landing_view',creative_code:'A',event_count:10},{event_name:'start_clicked',creative_code:'A',event_count:5},{event_name:'application_start_submitted',creative_code:'A',event_count:2}]);
  check('funnel computes bounded aggregate rates',funnel.totals.landing_view===10&&funnel.totals.application_start_submitted===2&&funnel.totals.rates.landing_to_submission===0.2&&funnel.creatives.A.rates.start_to_submission===0.4);
  const ready=await mod.productionReadiness(env);
  check('readiness passes fully configured local Cloudflare contract',ready.ready===true&&Object.values(ready.checks).every(Boolean));
  const notReady=await mod.productionReadiness({...env,LIFE_QUEUE_ENCRYPTION_KEY_B64:''});
  check('readiness fails when encryption secret is absent',notReady.ready===false&&notReady.checks.encryption_key===false);

  const report={sprint:'408-LIFE-1.7',passed:checks.length,failed:0,checks};fs.writeFileSync(path.join(root,'LIFE1_7_QA.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
