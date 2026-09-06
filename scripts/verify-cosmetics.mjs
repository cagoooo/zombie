import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const browser=await chromium.launch({channel:'msedge',headless:true});
const url=process.env.GAME_URL||'http://127.0.0.1:5173/';
const checks=[],errors=[],measurements=[];
const targets=['guard','pulse','plasma','cryo'];
async function ready(p){p.on('pageerror',e=>errors.push(e.message));await p.goto(url);await p.waitForSelector('body[data-ready="true"]');if(await p.locator('#continue-game').isVisible())await p.locator('#continue-game').click();if(await p.locator('#tutorial-skip').isVisible())await p.locator('#tutorial-skip').click();}
async function choose(p,target,variant){await p.locator(`[data-skin-target="${target}"]`).click();await p.locator(`[data-skin-id="${target}-${variant}"]`).click();await p.waitForFunction(()=>!document.querySelector('#apply-cosmetics').disabled);}
async function equip(p,variant){await p.locator('#open-cosmetics').click();for(const target of targets)await choose(p,target,variant);await p.locator('#apply-cosmetics').click();await p.waitForFunction(()=>document.querySelector('#cosmetics-overlay').hidden);}
async function settle(p){await p.evaluate(()=>new Promise(resolve=>{let frames=5;function tick(){if(--frames)requestAnimationFrame(tick);else resolve();}requestAnimationFrame(tick);}));}
const snap=p=>p.evaluate(()=>deadzone.snapshot());
try{
  const p=await browser.newPage({viewport:{width:1440,height:1000}});await ready(p);
  const before=await snap(p);
  await p.locator('#open-cosmetics').click();await choose(p,'guard','polar');
  await p.screenshot({path:'artifacts/cosmetic-guard-polar.png'});
  await p.keyboard.press('w');await p.keyboard.press('2');
  assert.equal((await snap(p)).weapon,before.weapon);assert.deepEqual((await snap(p)).player,before.player);
  await p.locator('#close-cosmetics').click();assert.equal((await snap(p)).cosmetics.applied.guard,'guard-original');
  checks.push('預覽不改裝備；模態鎖住移動與換槍，取消不套用');
  await equip(p,'polar');await settle(p);
  assert.deepEqual((await snap(p)).cosmetics.selected,Object.fromEntries(targets.map(t=>[t,t+'-polar'])));
  for(const key of ['health','credits','wave','kills','heat'])assert.equal((await snap(p))[key],before[key]);
  await p.reload();await p.waitForSelector('body[data-ready="true"]');if(await p.locator('#continue-game').isVisible())await p.locator('#continue-game').click();
  assert.equal((await snap(p)).cosmetics.applied.guard,'guard-polar');assert.equal((await snap(p)).cosmetics.applied.plasma,'plasma-polar');
  assert.equal((await snap(p)).grip.bone,'Middle1L');
  const idleGrip=(await snap(p)).grip.gunPosition;
  await p.keyboard.down('w');await p.waitForTimeout(400);await p.keyboard.up('w');
  assert.notDeepEqual((await snap(p)).grip.gunPosition,idleGrip);
  assert.ok((await snap(p)).grip.gunPosition.every(Number.isFinite));
  checks.push('四項外觀原子套用與重載保存；經濟、熱量及波次不變');
  await p.locator('#open-cosmetics').click();await choose(p,'plasma','polar');await p.screenshot({path:'artifacts/cosmetic-plasma-polar.png'});await p.locator('#rotate-cosmetic').click();await p.locator('#close-cosmetics').click();
  for(const quality of ['low','medium','high']){
    await p.locator('#settings').click();await p.locator('#quality').selectOption(quality);await p.locator('#close-settings').click();
    for(const variant of ['original','polar']){await equip(p,variant);await settle(p);const s=await snap(p);measurements.push({quality,variant,drawCalls:s.render.calls,memory:s.memory});}
  }
  await equip(p,'original');await settle(p);const baseline=(await snap(p)).memory;
  for(let index=0;index<50;index++){
    await p.locator('#open-cosmetics').click();await choose(p,'guard',index%2?'original':'polar');await p.locator('#apply-cosmetics').click();
  }
  await settle(p);assert.deepEqual((await snap(p)).memory,baseline);
  checks.push('三檔畫質比較、50 次換裝及預覽關閉後 GPU 幾何／貼圖回到暖機基線');
  await p.locator('#next-wave').click();assert.equal(await p.locator('#open-cosmetics').isVisible(),false);
  checks.push('戰鬥中不開放外觀套用');await p.close();
  const f=await browser.newPage();await f.route('**/models/skins/**',r=>r.abort());await ready(f);
  await f.locator('#open-cosmetics').click();await f.locator('[data-skin-id="guard-polar"]').click();await f.locator('#retry-cosmetic').waitFor({state:'visible'});
  assert.equal(await f.locator('#apply-cosmetics').isDisabled(),true);assert.equal((await snap(f)).cosmetics.applied.guard,'guard-original');
  await f.unroute('**/models/skins/**');await f.locator('#retry-cosmetic').click();await f.waitForFunction(()=>!document.querySelector('#apply-cosmetics').disabled);await f.locator('#apply-cosmetics').click();
  assert.equal((await snap(f)).cosmetics.applied.guard,'guard-polar');
  checks.push('真實 404／網路故障保留原版，重試後才可套用');await f.close();
  const saved=await browser.newPage();
  await saved.addInitScript(()=>localStorage.setItem('deadzone-cosmetics-v1',JSON.stringify({version:1,selected:{guard:'guard-polar',pulse:'pulse-polar',plasma:'plasma-polar',cryo:'cryo-polar'}})));
  await saved.route('**/models/skins/**',r=>r.abort());await ready(saved);
  assert.deepEqual((await snap(saved)).cosmetics.selected,Object.fromEntries(targets.map(t=>[t,t+'-original'])));
  await saved.locator('#next-wave').click();assert.equal((await snap(saved)).phase,'wave');await saved.close();
  checks.push('已保存外觀全部缺檔時回原版，仍可開始戰局；握槍跟隨匯入後的手部骨架');
  const race=await browser.newPage();await race.route('**/models/skins/guard-polar-v1.glb',async r=>{await new Promise(resolve=>setTimeout(resolve,800));await r.continue();});await ready(race);
  await race.locator('#open-cosmetics').click();await race.locator('[data-skin-id="guard-polar"]').click();await race.locator('[data-skin-id="guard-original"]').click();await race.waitForTimeout(1200);await race.locator('#apply-cosmetics').click();
  assert.equal((await snap(race)).cosmetics.applied.guard,'guard-original');checks.push('較慢的舊預覽回應不覆蓋最後選擇');await race.close();
  for(const [width,height] of [[320,640],[390,844],[844,390],[768,1024],[1024,768]]){
    const m=await browser.newPage({viewport:{width,height},hasTouch:true,isMobile:true});await ready(m);await m.locator('#open-cosmetics').tap();await choose(m,'guard','polar');
    await m.locator('#apply-cosmetics').tap();assert.equal((await snap(m)).cosmetics.applied.guard,'guard-polar');
    assert.ok(await m.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await m.locator('#open-cosmetics').tap();await m.screenshot({path:`artifacts/cosmetic-${width}x${height}.png`});await m.locator('#reset-cosmetics').tap();await m.waitForFunction(()=>!document.querySelector('#apply-cosmetics').disabled);await m.locator('#apply-cosmetics').tap();assert.equal((await snap(m)).cosmetics.applied.guard,'guard-original');await m.close();
  }
  checks.push('五種手機／平板尺寸：開啟、選擇、套用、恢復原版與可捲動內容');
  assert.deepEqual(errors,[]);
  const report={url,checks,measurements,baseline,errors,physicalDevicesTested:false};await fs.writeFile('artifacts/cosmetics-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
