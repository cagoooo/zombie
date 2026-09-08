import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const browser = await chromium.launch({channel:'msedge',headless:true});
const errors=[], results=[];
try {
  for (const [width,height] of [[1440,980],[320,640],[390,844],[844,390],[768,1024]]) {
    const p=await browser.newPage({viewport:{width,height},hasTouch:width<1000,isMobile:width<1000,serviceWorkers:'block'});
    p.on('pageerror',e=>errors.push(e.message));
    await p.goto(process.env.GAME_URL || 'http://127.0.0.1:4173/');
    await p.waitForSelector('body[data-ready="true"]');await p.locator('#tutorial-skip').click();
    async function pick() {
      if (!await p.evaluate(()=>deadzone.snapshot().buildMode)) await p.locator('#build-mode').click();
      await p.locator('[data-tower="pulse"]').click();
      await p.waitForTimeout(700);
      const q=await p.evaluate(()=>deadzone.project(-15,0,.4));await p.mouse.click(q.x,q.y);
    }
    await pick();
    await p.locator('#tower-strategy').selectOption('nearest');
    assert.equal(await p.evaluate(()=>deadzone.snapshot().towers[0].strategy),'nearest');
    await p.locator('#tower-strategy').selectOption('strongest');
    await p.waitForFunction(()=>JSON.parse(localStorage.getItem('deadzone-checkpoint-v1')).towers[0]?.strategy==='strongest');
    assert.match(await p.locator('.upgrade-preview').innerText(),/23.0/);
    assert.match(await p.locator('.upgrade-preview').innerText(),/38.0/);
    assert.match(await p.locator('#upgrade-budget').innerText(),/剩餘 130/);
    await p.reload();await p.waitForSelector('body[data-ready="true"]');await p.locator('#continue-game').click();
    await pick();assert.equal(await p.locator('#tower-strategy').inputValue(),'strongest');
    await p.locator('#upgrade').click();
    assert.equal(await p.evaluate(()=>deadzone.snapshot().towers[0].level),2);
    assert.ok(await p.locator('#upgrade').isDisabled());
    assert.match(await p.locator('#upgrade-budget').innerText(),/尚缺 10/);
    assert.match(await p.locator('#sell').innerText(),/119/);
    assert.match(await p.locator('.upgrade-preview').innerText(),/52.9/);
    await p.locator('#tower-strategy').scrollIntoViewIfNeeded();
    assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    assert.equal(await p.evaluate(()=>visualViewport.scale),1);
    await p.screenshot({path:`artifacts/r2-${width}x${height}.png`,fullPage:true});
    await p.locator('#sell').click();
    assert.equal(await p.evaluate(()=>deadzone.snapshot().credits),249);
    await p.locator('#build-mode').click();await p.locator('#next-wave').click();
    await p.waitForFunction(()=>deadzone.snapshot().enemies.length>0);
    results.push({width,height,strategySaved:true,upgradePreview:true,insufficientBlocked:true,refund:249,combat:true});
    await p.close();
  }
  assert.deepEqual(errors,[]);
  await fs.mkdir('artifacts',{recursive:true});
  await fs.writeFile('artifacts/r2-browser.json',JSON.stringify({url:process.env.GAME_URL||'http://127.0.0.1:4173/',results,errors,physicalDevicesTested:false},null,2));
  console.log(JSON.stringify(results));
} finally {await browser.close();}
