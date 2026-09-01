#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const executablePath = process.env.CHROMIUM_PATH;
if (!executablePath || !fs.existsSync(executablePath)) process.exit(2);
const mime = {'.css':'text/css','.html':'text/html','.js':'text/javascript','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.ico':'image/x-icon'};
const server = http.createServer((req,res)=>{ let rel=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/+/, ''); if(!rel||rel.endsWith('/')) rel+='index.html'; const target=path.resolve(root,rel); if(!target.startsWith(`${root}${path.sep}`)||!fs.existsSync(target)){res.writeHead(404).end();return;} res.writeHead(200,{'content-type':mime[path.extname(target)]||'application/octet-stream'}); fs.createReadStream(target).pipe(res); });
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const checks=[]; const check=(name,value)=>{assert.ok(value,name);checks.push(name)};
try {
  for (const route of ['/healthcare/','/teachers/','/tech/','/engineers/']) {
    const context=await browser.newContext({viewport:{width:320,height:568},reducedMotion:'reduce'});
    const page=await context.newPage(); const errors=[]; page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`${base}${route}`,{waitUntil:'load'}); await page.waitForFunction(()=>document.querySelector('form[data-progressive-ready="true"]'));
    check(`${route}: renders inviting CTA`,(await page.locator('button[type="submit"]').innerText()).includes('See Which Professional Discounts May Apply'));
    check(`${route}: stays reflow safe`,await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth));
    await page.selectOption('[name="occupation_segment"]',{index:1}); await page.locator('[data-cro-next]').click();
    const handoff=await page.locator('.cro-handoff-note').innerText();
    check(`${route}: sustains intent into handoff`,handoff.includes('keeps your professional role connected')&&handoff.includes('verify which Farmers professional discounts may be available'));
    check(`${route}: has no runtime error`,errors.length===0);
    await context.close();
  }
} finally { await browser.close(); await new Promise(resolve=>server.close(resolve)); }
console.log(JSON.stringify({sprint:'408-CRO-1.6.2-browser',passed:checks.length,failed:0,checks},null,2));
