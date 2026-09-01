#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const redirects = fs.readFileSync(path.join(root, '_redirects'), 'utf8');
const workerSource = fs.readFileSync(path.join(root, '_worker.js'), 'utf8');

// Static redirect rules are applied by env.ASSETS.fetch(). Directory ->
// index.html rewrites can therefore loop with Pages pretty-path handling.
assert(!/\/(?:home|contact|buyer|life|life-ops|neighbor|score|auto-bundle|healthcare|teachers|tech|engineers)\/?(?:\*|)\s+\/[^\s]+\/index\.html\s+200/m.test(redirects), 'application index.html rewrites must not live in _redirects');
assert(workerSource.includes("const canonicalDirectories = new Set"));
assert(workerSource.includes("path.startsWith('/home/qr/')"));
assert(workerSource.includes("return { asset: '/home/' }"));

let source = workerSource.replace('export default {', 'globalThis.__worker = {');
const runner = new Function('TextEncoder','TextDecoder','URL','Request','Response','Headers','crypto','btoa','atob', `${source}\nreturn globalThis.__worker;`);
const worker = runner(TextEncoder, TextDecoder, URL, Request, Response, Headers, globalThis.crypto,
  globalThis.btoa || ((v)=>Buffer.from(v,'binary').toString('base64')),
  globalThis.atob || ((v)=>Buffer.from(v,'base64').toString('binary')));
const seen=[];
const env={ASSETS:{fetch:async(req)=>{const u=new URL(req.url); seen.push(u.pathname); return new Response('asset:'+u.pathname,{status:200});}}};

(async()=>{
  const canonical=['/home/','/contact/','/buyer/','/life/','/life-ops/','/neighbor/','/score/'];
  for (const route of canonical){ seen.length=0; const r=await worker.fetch(new Request('https://408farmers.com'+route),env); assert.equal(r.status,200); assert.deepEqual(seen,[route]); }
  seen.length=0;
  let r=await worker.fetch(new Request('https://408farmers.com/home/qr/95118/rate/'),env);
  assert.equal(r.status,200); assert.deepEqual(seen,['/home/']);
  seen.length=0;
  r=await worker.fetch(new Request('https://408farmers.com/home'),env);
  assert.equal(r.status,308); assert.equal(r.headers.get('location'),'https://408farmers.com/home/'); assert.equal(seen.length,0);
  console.log('Advanced Mode redirect-loop hotfix QA: 10/10 passed');
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
