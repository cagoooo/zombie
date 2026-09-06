import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
const browser=await chromium.launch({channel:'msedge',headless:true});
const errors=[],checks=[],sizes=[];
const root=path.resolve('dist'),original=JSON.parse(await fs.readFile(root+'/version.json','utf8'));
let generation=0;
const versions=[original,{...original,id:original.id+'b',sequence:2},{...original,id:original.id+'c',sequence:3}];
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.glb':'model/gltf-binary','.gltf':'model/gltf+json'};
const server=http.createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://localhost');
    if(!url.pathname.startsWith('/zombie/')){res.writeHead(404);res.end();return;}
    const name=decodeURIComponent(url.pathname.slice(8))||'index.html';
    const file=path.resolve(root,name);if(!file.startsWith(root+path.sep))throw Error();
    let body=await fs.readFile(file);
    if(name==='version.json')body=Buffer.from(JSON.stringify(versions[generation]));
    else if(/\.(js|html)$/.test(name))body=Buffer.from(body.toString().replaceAll(original.id,versions[generation].id).replaceAll('"sequence":1','"sequence":'+versions[generation].sequence));
    res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(body);
  }catch{res.writeHead(404);res.end('missing');}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const url='http://127.0.0.1:'+server.address().port+'/zombie/';
let page;
try {
  page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url);await page.waitForSelector('body[data-ready="true"]');
  await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  assert.equal(await page.locator('#update-card').isVisible(),false);
  assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'),'https://cagoooo.github.io/zombie/');
  await page.evaluate(async()=>{await caches.open('other-project-cache');localStorage.setItem('unrelated-preference','keep');});
  checks.push('首次 SW 安裝不提示／不自動重載；子路徑資源和靜態 OG 正確');
  generation=1;await page.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();await r.update();});
  await page.locator('#update-card').waitFor({state:'visible'});
  await page.locator('#dismiss-update').click();
  await page.evaluate(()=>{for(const e of ['focus','online','pageshow'])dispatchEvent(new Event(e));});
  await page.waitForTimeout(1200);assert.equal(await page.locator('#update-card').isVisible(),false);
  checks.push('真更新顯示一次，稍後關閉後 focus／online／pageshow 不重複提示');
  await page.reload();await page.waitForSelector('body[data-ready="true"]');
  await page.locator('#update-card').waitFor({state:'visible'});
  let navigations=0;page.on('framenavigated',frame=>{if(frame===page.mainFrame())navigations++;});
  await page.locator('#apply-update').click();
  await page.waitForFunction(()=>document.querySelector('meta[name="app-build"]')?.content.endsWith('b'));
  await page.waitForSelector('body[data-ready="true"]');await page.waitForTimeout(1800);
  assert.equal(navigations,1);assert.equal(await page.locator('#update-card').isVisible(),false);
  assert.equal(await page.evaluate(async()=> (await caches.keys()).includes('other-project-cache')),true);
  assert.equal(await page.evaluate(()=>localStorage.getItem('unrelated-preference')),'keep');
  checks.push('已有 waiting 時重整仍提示；套用只重載一次，不清其他專案快取或本機存檔');
  generation=2;await page.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();await r.update();});
  await page.locator('#update-card').waitFor({state:'visible'});await page.locator('#apply-update').click();
  await page.waitForSelector('body[data-ready="true"]');await page.waitForTimeout(1400);
  generation=0;await page.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();await r.update();});
  await page.waitForTimeout(1300);assert.equal(await page.locator('#update-card').isVisible(),false);
  checks.push('連續第二個真版本可更新，CDN 舊 SW 不提示也不自動降版');
  generation=2;
  for(const [width,height,touch] of [[320,640,true],[390,844,true],[844,390,true],[768,1024,true],[1024,768,true],[1180,820,true],[1440,1000,false]]) {
    const ctx=await browser.newContext({viewport:{width,height},isMobile:touch,hasTouch:touch,deviceScaleFactor:1});
    const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(url);await p.waitForSelector('body[data-ready="true"]');
    assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,width+' horizontal overflow');
    for(const selector of touch?['.site-credit','#move-stick','#aim-stick','.weapon-dock','#pause','#build-mode']:['.site-credit']) {
      const b=await p.locator(selector).boundingBox();assert.ok(b&&b.x>=-1&&b.x+b.width<=width+1,selector+' x '+width);
      if(touch)assert.ok(b.y>=0&&b.y+b.height<=height+1,selector+' y '+height);
    }
    const footer=await p.locator('.site-credit').boundingBox();
    if(touch){const dock=await p.locator('.weapon-dock').boundingBox();assert.ok(dock.y+dock.height<=footer.y, 'dock overlaps footer');}
    await p.locator('#settings').click();const close=await p.locator('#close-settings').boundingBox();
    await p.locator('#close-settings').click();
    await p.locator('#tutorial-skip').click();await p.locator('#next-wave').click();await p.waitForFunction(()=>deadzone.snapshot().enemies.length>0);
    if(touch)await p.locator('.weapon-dock [data-weapon="cryo"]').tap();else await p.keyboard.press('3');
    assert.equal(await p.evaluate(()=>deadzone.snapshot().weapon),'cryo');
    await p.screenshot({path:`artifacts/release-${width}x${height}.png`,fullPage:true});sizes.push({width,height,touch,footerVisible:true,combat:true});await ctx.close();
  }
  checks.push('七種桌機／手機／平板尺寸：無橫向溢出、頁尾不擋操作、設定返回、開波切槍');
  const recovery=await browser.newPage();await recovery.goto(url);await recovery.waitForSelector('body[data-ready="true"]');
  await recovery.evaluate(async()=>{await caches.open('other-project-cache');localStorage.setItem('recovery-save','keep');});
  let recoveryLoads=0;recovery.on('framenavigated',f=>{if(f===recovery.mainFrame())recoveryLoads++;});
  await recovery.evaluate(()=>{setTimeout(()=>import('./assets/missing-release.js'),0);});
  await recovery.waitForFunction(()=>sessionStorage.getItem('deadzone:chunk-recovery:/zombie/')==='1');
  await recovery.waitForTimeout(2200);await recovery.waitForSelector('body[data-ready="true"]');assert.equal(recoveryLoads,1);
  assert.equal(await recovery.evaluate(()=>localStorage.getItem('recovery-save')),'keep');
  assert.equal(await recovery.evaluate(async()=>(await caches.keys()).includes('other-project-cache')),true);
  await recovery.evaluate(()=>{setTimeout(()=>import('./assets/missing-release-again.js'),0);});
  await recovery.locator('#chunk-recovery button').waitFor({state:'visible'});await recovery.waitForTimeout(1600);assert.equal(recoveryLoads,1);
  checks.push('實際缺失 chunk 只自癒一次；第二次顯示手動重試，存檔與其他專案快取保留');
  await recovery.close();
  assert.deepEqual(errors,[]);
  const report={date:'2026-09-06',url,checks,sizes,errors,physicalDevicesTested:false};await fs.writeFile('artifacts/release-browser-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}catch(e){if(page)await page.screenshot({path:'artifacts/release-failure.png',fullPage:true});throw e;}
finally{await browser.close();server.close();}
