#!/usr/bin/env node
'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..'),read=r=>fs.readFileSync(path.join(root,r),'utf8'),exists=r=>fs.existsSync(path.join(root,r));
const checks=[]; function check(n,v){assert.ok(v,n);checks.push(n)}
const version=read('VERSION').trim(),life=read('life/index.html'),campaign=read('shared/life-campaign.js'),secure=read('shared/life-secure-submit.js'),worker=read('_worker.js'),ops=read('shared/life-ops.js'),opsHtml=read('life-ops/index.html'),routing=read('LIFE-CAMPAIGN-ROUTING.md'),manifest=JSON.parse(read('handoff-manifest.json'));
check('runtime preserves LIFE-1.6 campaign contract', ['408-LIFE-1.6','408-LIFE-1.7','408-FLOW-1.5','408-HOME-2.1','408-HOME-2.2','408-HOME-2.3','408-HOME-2.4','408-HOME-2.5','408-HOME-2.6','408-HOME-2.7','408-HOME-2.8','408-HOME-2.9','408-FLOW-2.1','408-FLOW-2.2','408-FLOW-2.3','408-FLOW-2.4','408-CF-RPT-1.1','408-FLOW-2.5'].includes(version)&&manifest.runtime===version&&['408-LIFE-1.6','408-LIFE-1.7'].includes(manifest.lifeCampaignFoundation?.build));
for(const f of ['shared/life-campaign.js','LIFE-CAMPAIGN-ROUTING.md','SPRINT-408-LIFE-1.6.md']) check('exists:'+f,exists(f));
check('life loads campaign module before intake',life.indexOf('life-campaign.js')>0&&life.indexOf('life-campaign.js')<life.indexOf('life-intake.js'));
check('hero exposes message matching hooks',['data-life-hero-title','data-life-hero-lead','data-life-hero-support','data-life-start'].every(x=>life.includes(x)));
check('all four canonical variants exist',['before_anything_changes','20_minutes','this_is_the_time','financial_picture'].every(x=>campaign.includes(x)));
check('creative A copy exists',campaign.includes('Before anything changes.'));
check('creative B copy exists',campaign.includes('20 minutes.'));
check('creative C copy exists',campaign.includes('This is the time.'));
check('creative D copy exists',campaign.includes('Your health is part of your financial picture.'));
check('unknown variant has explicit A fallback',campaign.includes("var DEFAULT_VARIANT = 'before_anything_changes';"));
check('resolution uses campaign variant content creative',campaign.includes('raw.campaign_variant')&&campaign.includes('raw.utm_content')&&campaign.includes('raw.creative'));
check('campaign layer has no persistent browser storage',!/localStorage|sessionStorage|indexedDB|document\.cookie/i.test(campaign));
check('campaign layer emits no analytics',!/dataLayer|gtag\(|fbq\(|pixel|capi/i.test(campaign));
check('campaign attribution stays allowlisted',campaign.includes("var ATTR_KEYS = ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','campaign_id','campaign_variant','creative'];"));
check('contact fallback receives only campaign parameters',campaign.includes('/\\/contact\\/?$/.test')&&!/first_name|last_name|date_of_birth|ssn_last4/.test(campaign));
check('secure submit requests memory attribution snapshot',secure.includes('window.LifeCampaignAttribution')&&secure.includes('snapshot()'));
check('secure submit clears attribution reference after serialization',secure.includes('payload.attribution = null;'));
check('worker top-level allowlist accepts attribution',worker.includes("'submission_id','attribution','engagement'"));
check('worker independently normalizes attribution',worker.includes('function normalizeAttribution')&&worker.includes("out.channel !== 'life_campaign'"));
check('worker allowlists canonical variants and creative pairings',worker.includes('LIFE_VARIANTS')&&worker.includes('LIFE_VARIANT_CODES')&&worker.includes('before_anything_changes')&&worker.includes('financial_picture'));
check('worker stores attribution inside encrypted normalized payload',worker.includes('source: \'408farmers.com/life\',\n    attribution,')&&worker.includes('encryptQueuePayload(normalized, env)'));
check('producer queue list exposes minimum campaign context',worker.includes('creative_code: attribution.creative_code')&&worker.includes('utm_source: attribution.utm_source'));
check('producer detail exposes campaign context only after authorization',worker.includes('attribution: payload.attribution')&&worker.includes('authorizedProducer(request, env)'));
check('ops UI renders attribution with textContent-based detail helper',opsHtml.includes('Campaign attribution')&&ops.includes("detail('campaign_creative'")&&ops.includes('textContent'));
check('canonical routing document contains four Meta links',(routing.match(/utm_source=meta/g)||[]).length===4&&['campaign_variant=A','campaign_variant=B','campaign_variant=C','campaign_variant=D'].every(x=>routing.includes(x)));
check('manifest declares message matching',manifest.lifeCampaignFoundation?.campaignMessageMatchingEnabled===true&&Object.keys(manifest.lifeCampaignFoundation?.campaignVariants||{}).length===4);
check('manifest declares attribution with bounded analytics only after LIFE-1.7',manifest.lifeCampaignFoundation?.campaignAttributionEnabled===true&&(manifest.lifeCampaignFoundation?.build==='408-LIFE-1.7' ? manifest.lifeCampaignFoundation?.campaignAttributionAnalyticsScope==='first_party_non_pii_conversion_events_only' : manifest.lifeCampaignFoundation?.campaignAttributionAnalyticsEnabled===false));
check('attribution persistence remains encrypted queue only',/encrypted_with_application_payload/.test(manifest.lifeCampaignFoundation?.campaignAttributionPersistence||''));
check('sensitive analytics remains disabled',manifest.lifeCampaignFoundation?.sensitiveAnalyticsEnabled===false);
check('LIFE-1.6 gate resolves at LIFE-1.7',manifest.lifeCampaignFoundation?.build==='408-LIFE-1.7' ? (manifest.lifeCampaignFoundation?.paidTrafficReady===true&&manifest.lifeCampaignFoundation?.nextSprint===null) : (manifest.lifeCampaignFoundation?.paidTrafficReady===false&&/LIFE-1\.7/.test(manifest.lifeCampaignFoundation?.paidTrafficGate||'')&&manifest.lifeCampaignFoundation?.nextSprint==='408-LIFE-1.7'));
check('no Netlify regression',!exists('netlify.toml')&&!exists('netlify')&&!/netlify/i.test(worker));
check('Cloudflare secure queue remains intact',worker.includes('LIFE_QUEUE_DB')&&worker.includes('AES-GCM')&&worker.includes('Cf-Access-Jwt-Assertion'));

function runCampaign(search){
  const nodes={
    '[data-life-hero-title]':{innerHTML:'',attrs:{},setAttribute(k,v){this.attrs[k]=v;}},
    '[data-life-hero-lead]':{textContent:''}, '[data-life-hero-support]':{textContent:''},
    '[data-life-start]':{innerHTML:'',href:'https://408farmers.com/life/#life-start'}
  };
  const body={classList:{contains:x=>x==='life-page'},dataset:{}};
  const document={body,readyState:'complete',querySelector:s=>nodes[s]||null,querySelectorAll:s=>[],addEventListener(){}};
  const window={URL,URLSearchParams,location:{search,origin:'https://408farmers.com'},document};
  vm.runInNewContext(campaign,{window,document,Object,String,Array,RegExp});
  return {window,nodes,body};
}
const defaultRun=runCampaign('');
check('runtime default resolves to Creative A',defaultRun.window.LifeCampaignAttribution.variant==='before_anything_changes'&&defaultRun.body.dataset.lifeCreativeCode==='A'&&/Before/.test(defaultRun.nodes['[data-life-hero-title]'].innerHTML));
const bRun=runCampaign('?utm_source=meta&utm_medium=paid_social&utm_campaign=life_insurability&utm_content=20_minutes&campaign_variant=B');
check('runtime Creative B message matches 20-minute ad',bRun.window.LifeCampaignAttribution.variant==='20_minutes'&&bRun.body.dataset.lifeCreativeCode==='B'&&/20/.test(bRun.nodes['[data-life-hero-title]'].innerHTML));
const dRun=runCampaign('?utm_content=financial_picture&campaign_variant=D');
check('runtime Creative D message matches financial-picture ad',dRun.window.LifeCampaignAttribution.variant==='financial_picture'&&dRun.body.dataset.lifeCreativeCode==='D'&&/financial picture/.test(dRun.nodes['[data-life-hero-title]'].innerHTML));
const fallbackRun=runCampaign('?utm_content=made_up&campaign_variant=Z');
check('runtime malformed creative safely falls back to A',fallbackRun.window.LifeCampaignAttribution.variant==='before_anything_changes'&&fallbackRun.window.LifeCampaignAttribution.snapshot().creative_code==='A');
const report={sprint:'408-LIFE-1.6',passed:checks.length,failed:0,checks}; fs.writeFileSync(path.join(root,'LIFE1_6_QA.json'),JSON.stringify(report,null,2)+'\n'); console.log(JSON.stringify(report,null,2));
