const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const worker = fs.readFileSync(path.resolve(__dirname,'../_worker.js'),'utf8');
const workerUrl = pathToFileURL(path.resolve(__dirname,'../_worker.js')).href;

test('ordinary lead relay allowlists the bounded source and contact-basis fields', () => {
  for (const field of ['source_key','last_name','email','contact_basis','contact_basis_version','contact_basis_timestamp','route_path']) {
    assert.match(worker,new RegExp(`\\['${field}'`),field);
  }
});

test('life application operational projection is privacy-minimized', () => {
  const section = worker.slice(worker.indexOf('function lifeOperationalLeadFields'),worker.indexOf('async function handleApplicationInit'));
  for (const allowed of ['first_name','last_name','email','phone','source_key','campaign_id','submitted_at']) assert.match(section,new RegExp(allowed));
  for (const forbidden of ['date_of_birth','residential_address','ssn_last4','protection_priority','income_runway','existing_life_coverage']) assert.doesNotMatch(section,new RegExp(forbidden));
  assert.match(section,/requested_transaction_follow_up/);
  assert.match(section,/web_408_life/);
});

test('secure life queue success remains independent from downstream CRM availability', () => {
  const handler = worker.slice(worker.indexOf('async function handleApplicationInit'),worker.indexOf('function pageAssetRoute'));
  assert.match(handler,/await queueInsert\(normalized, env\)/);
  assert.match(handler,/deliverCoverageFitLead\(lifeOperationalLeadFields\(normalized\), env\)\.catch\(\(\) => null\)/);
  assert.match(handler,/return jsonResponse\(202,\s*\{\s*ok\s*:\s*true/);
});

test('life application writes encrypted queue first and emits only the privacy-safe operational projection', async () => {
  const sqlRuns=[];
  const db={
    async exec(sql){ sqlRuns.push({type:'exec',sql}); },
    prepare(sql){
      return { bind(...values){ return { async run(){ sqlRuns.push({type:'run',sql,values}); return {meta:{changes:1}}; } }; } };
    }
  };
  const payload={
    schema_version:'408-life-application-init-v2',
    submission_mode:'carrier_application_start',
    submission_id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    attribution:{channel:'life_campaign',landing_variant:'before_anything_changes',creative_code:'A',utm_source:'direct',utm_medium:'direct',utm_campaign:'life_insurability',utm_content:'before_anything_changes',utm_term:'',campaign_id:'life-direct',campaign_variant:'A'},
    engagement:{protection_priority:['family_income'],income_runway:'3_to_6_months',existing_life_coverage:'none'},
    applicant:{first_name:'Maya',middle_name:'',last_name:'Chen',gender:'female',residential_address:'123 Private St',residential_address_2:'',residential_city:'Fremont',residential_state:'CA',residential_zip:'94539',email:'maya@example.com',phone:'4085551234'},
    sensitive:{date_of_birth:'1990-01-02',ssn_last4:'1234'},
    acknowledgement:{application_preparation:true,sensitive_use_notice:true},
    anti_bot:{website:'',elapsed_ms:5000}
  };
  const originalFetch=global.fetch,calls=[],tasks=[];
  global.fetch=async(url,init)=>{calls.push({url:String(url),init});return Response.json({ok:true,durable:true,checkpointId:'408d_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',crm:{state:'pending'}},{status:201});};
  try {
    const module=(await import(`${workerUrl}?lifeProjection=${Date.now()}`)).default;
    const request=new Request('https://408farmers.com/api/life/application-init',{method:'POST',headers:{Origin:'https://408farmers.com','Sec-Fetch-Site':'same-origin','Content-Type':'application/json','X-Life-Request-Version':'2'},body:JSON.stringify(payload)});
    const response=await module.fetch(request,{LIFE_QUEUE_DB:db,LIFE_QUEUE_ENCRYPTION_KEY_B64:Buffer.alloc(32,7).toString('base64'),COVERAGEFIT_LEAD_SYNC_SECRET:'test-secret-that-is-longer-than-thirty-two-characters',ASSETS:{fetch:originalFetch}},{waitUntil(task){tasks.push(task);}});
    assert.equal(response.status,202);
    assert.ok(sqlRuns.some(row=>row.type==='run' && /INSERT INTO life_application_queue/.test(row.sql)));
    await Promise.all(tasks);
    assert.equal(calls.length,1);
    const operational=JSON.parse(calls[0].init.body);
    assert.equal(operational.source_key,'web_408_life');
    assert.equal(operational.first_name,'Maya');
    assert.equal(operational.email,'maya@example.com');
    assert.equal(operational.contact_basis,'requested_transaction_follow_up');
    for (const forbidden of ['date_of_birth','residential_address','residential_city','residential_zip','ssn_last4','protection_priority','income_runway','existing_life_coverage']) assert.equal(forbidden in operational,false,forbidden);
  } finally { global.fetch=originalFetch; }
});
