import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const url='https://cagoooo.github.io/zombie/';
const resources=[],errors=[];
const main=await fetch(url);assert.equal(main.status,200);const html=await main.text();
assert.ok(html.includes('property="og:title"')&&html.includes('property="og:image"'));
const og=html.match(/property="og:image" content="([^"]+)"/)[1].replaceAll('&amp;','&');
assert.ok(og.startsWith(url+'og-deadzone-v1.png?v='));
const paths=['','favicon.svg','favicon.ico','apple-touch-icon.png','manifest.webmanifest','sw.js','version.json','models/pulse-mk2.glb','audio/urgent-srg774-loop-v1.mp3','audio/LICENSE.txt'];
const manifest=await (await fetch(url+'manifest.webmanifest')).json();paths.push(...manifest.icons.map(i=>i.src));
const skins=JSON.parse(await fs.readFile('src/skin-catalog.json','utf8')).filter(skin=>skin.variant==='polar');
paths.push(...skins.map(skin=>skin.file));
for(const name of [...new Set(paths)]) {
  const r=await fetch(url+name);assert.equal(r.status,200,name);const bytes=Buffer.from(await r.arrayBuffer());assert.ok(bytes.length>0);
  const skin=skins.find(skin=>skin.file===name);if(skin)assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),skin.sha256);
  resources.push({path:name||'index',status:r.status,type:r.headers.get('content-type'),bytes:bytes.length});
}
const image=await fetch(og,{headers:{'User-Agent':'facebookexternalhit/1.1'}});assert.equal(image.status,200);assert.match(image.headers.get('content-type'),/image\/png/);
const imageBytes=Buffer.from(await image.arrayBuffer()),local=await fs.readFile('public/og-deadzone-v1.png');
assert.equal(crypto.createHash('sha256').update(imageBytes).digest('hex'),crypto.createHash('sha256').update(local).digest('hex'));
assert.equal(imageBytes.readUInt32BE(16),1734);assert.equal(imageBytes.readUInt32BE(20),907);
const pkg=JSON.parse(await fs.readFile('package.json','utf8'));
const version=await (await fetch(url+'version.json')).json();assert.equal(version.version,pkg.version);assert.ok(html.includes(version.id));
const browser=await chromium.launch({channel:'msedge',headless:true});
let desktop;
try {
  desktop=await browser.newPage({viewport:{width:1440,height:1000}});desktop.on('pageerror',e=>errors.push(e.message));
  await desktop.goto(url);await desktop.waitForSelector('body[data-ready="true"]');await desktop.waitForFunction(()=>!!navigator.serviceWorker.controller);
  assert.equal(await desktop.evaluate(()=>deadzone.snapshot().assetsReady),true);
  assert.equal(await desktop.evaluate(()=>deadzone.snapshot().assetsLoaded.length),11);
  assert.equal(await desktop.locator('.weapon-preview').count(),3);
  assert.equal(await desktop.locator('#update-card').isVisible(),false);
  const scope=await desktop.evaluate(async()=>(await navigator.serviceWorker.getRegistration()).scope);assert.equal(scope,url);
  await desktop.locator('#tutorial-skip').click();
  await desktop.locator('#open-cosmetics').click();
  for(const target of ['guard','pulse','plasma','cryo']){
    await desktop.locator(`[data-skin-target="${target}"]`).click();await desktop.locator(`[data-skin-id="${target}-polar"]`).click();
    await desktop.waitForFunction(()=>!document.querySelector('#apply-cosmetics').disabled);
  }
  await desktop.screenshot({path:'artifacts/live-cosmetics.png'});
  await desktop.locator('#apply-cosmetics').click();
  assert.ok(Object.values(await desktop.evaluate(()=>deadzone.snapshot().cosmetics.applied)).every(id=>id.endsWith('-polar')));
  await desktop.locator('#build-mode').click();await desktop.waitForTimeout(700);
  const pad=await desktop.evaluate(()=>deadzone.project(-15,0,.4));await desktop.mouse.click(pad.x,pad.y);assert.equal(await desktop.evaluate(()=>deadzone.snapshot().towers.length),1);
  await desktop.locator('#next-wave').click();await desktop.waitForFunction(()=>deadzone.snapshot().enemies.length>0);await desktop.keyboard.press('2');assert.equal(await desktop.evaluate(()=>deadzone.snapshot().weapon),'plasma');
  await desktop.waitForFunction(()=>deadzone.snapshot().audio.currentTime > .3);
  const bgm=await desktop.evaluate(()=>deadzone.snapshot().audio);
  assert.equal(bgm.state,'playing');assert.equal(bgm.source,url+'audio/urgent-srg774-loop-v1.mp3');
  await desktop.locator('#pause').click();assert.equal(await desktop.evaluate(()=>deadzone.snapshot().paused),true);await desktop.locator('#resume').click();
  await desktop.screenshot({path:'artifacts/live-desktop.png',fullPage:true});
  const sizes=[];
  for(const [width,height] of [[390,844],[1024,768]]){
    const p=await browser.newPage({viewport:{width,height},isMobile:true,hasTouch:true});p.on('pageerror',e=>errors.push(e.message));
    await p.goto(url);await p.waitForSelector('body[data-ready="true"]');assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await p.locator('#tutorial-skip').tap();await p.locator('#next-wave').tap();await p.waitForFunction(()=>deadzone.snapshot().enemies.length>0);await p.locator('.weapon-dock [data-weapon="cryo"]').tap();assert.equal(await p.evaluate(()=>deadzone.snapshot().weapon),'cryo');
    const f=await p.locator('.site-credit').boundingBox(),d=await p.locator('.weapon-dock').boundingBox();assert.ok(d.y+d.height<=f.y);
    await p.screenshot({path:`artifacts/live-${width}x${height}.png`});sizes.push({width,height,combat:true,footer:true});await p.close();
  }
  assert.deepEqual(errors,[]);
  const report={date:'2026-09-06',url,version,resources,bgm,og:{url:og,width:1734,height:907,bytes:imageBytes.length,sha256:crypto.createHash('sha256').update(imageBytes).digest('hex'),publicFetch:true},scope,models:11,previews:3,desktopCombat:true,sizes,errors,physicalDevicesTested:false,socialPostTested:false};
  await fs.writeFile('artifacts/live-release-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
