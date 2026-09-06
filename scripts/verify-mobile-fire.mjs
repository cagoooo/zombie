import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const url=process.env.GAME_URL||'http://127.0.0.1:4173/';
const browser=await chromium.launch({channel:'msedge',headless:true});
const results=[],errors=[];
try{
  for(const [width,height] of [[390,844],[844,390],[320,640],[768,1024]]){
    const p=await browser.newPage({viewport:{width,height},isMobile:true,hasTouch:true});
    p.on('pageerror',e=>errors.push(e.message));await p.goto(url);
    await p.waitForSelector('body[data-ready="true"]');await p.locator('#tutorial-skip').tap();
    await p.locator('#next-wave').tap();
    const cdp=await p.context().newCDPSession(p);
    const snap=()=>p.evaluate(()=>deadzone.snapshot());
    const center=async id=>{const b=await p.locator(id).boundingBox();return {x:b.x+b.width/2,y:b.y+b.height/2};};
    const fire=await center('#aim-stick'),move=await center('#move-stick');
    const before=await snap();
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...fire,id:1}]});
    await p.waitForTimeout(300);const held=await snap();assert.ok(held.heat>0);assert.ok(held.shooting);
    assert.ok(Math.abs(held.player.angle-before.player.angle)<.001);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:fire.x+25,y:fire.y-25,id:1}]});
    await p.waitForTimeout(120);assert.ok(Math.abs((await snap()).player.angle-held.player.angle)<.001);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    assert.equal((await snap()).shooting,false);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:move.x,y:move.y-28,id:2},{...fire,id:3}]});
    await p.waitForTimeout(450);const moving=await snap();
    assert.ok(Math.hypot(moving.player.x-held.player.x,moving.player.z-held.player.z)>1);
    assert.ok(Math.abs(Math.atan2(moving.aim.x-moving.player.x,moving.aim.z-moving.player.z)-moving.player.angle)<.001);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});assert.equal((await snap()).shooting,false);
    // Real multi-touch pinch on the non-canvas header; CSS must also protect HUD touches.
    for(let i=0;i<7;i++){
      await cdp.send('Input.dispatchTouchEvent',{type:i?'touchMove':'touchStart',touchPoints:[{x:width/2-20-i*8,y:25,id:4},{x:width/2+20+i*8,y:25,id:5}]});
    }
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await p.locator('#aim-stick').tap();await p.locator('#aim-stick').tap();
    assert.equal(await p.evaluate(()=>visualViewport.scale),1);
    await cdp.send('Emulation.setPageScaleFactor',{pageScaleFactor:2});
    await p.waitForFunction(()=>document.documentElement.classList.contains('browser-zoomed'));
    await p.locator('#reset-viewport').tap();
    await p.waitForFunction(()=>visualViewport.scale<=1.02);
    assert.equal(await p.locator('#zoom-recovery').isVisible(),false);
    assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await p.locator('#settings').tap();
    // Settings remain reachable and closable after the gesture guard.
    await p.locator('#close-settings').tap();
    await p.screenshot({path:`artifacts/mobile-fire-${width}x${height}.png`});
    results.push({width,height,centerFires:true,dragDoesNotAim:true,movementTurns:true,cancelStops:true,viewportScale:1,zoomRecovery:true});
    await p.close();
  }
  assert.deepEqual(errors,[]);
  const report={url,results,errors,physicalDevicesTested:false};
  await fs.writeFile('artifacts/mobile-fire-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
