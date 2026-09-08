import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { Game } from '../src/game.js';
import { checkpoint, SAVE_KEY } from '../src/save.js';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const results = [], errors = [];
try {
  for (const [width, height, mobile] of [[1440,980,false],[320,640,true],[390,844,true],[844,390,true],[768,1024,true]]) {
    const p = await browser.newPage({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, serviceWorkers: 'block' });
    p.on('pageerror', e => errors.push(e.message));
    const g = new Game(); g.wave = 3;
    await p.addInitScript(({ key, save }) => localStorage.setItem(key, JSON.stringify(save)), { key: SAVE_KEY, save: checkpoint(g) });
    await p.goto(process.env.GAME_URL || 'http://127.0.0.1:4173/');
    await p.waitForSelector('body[data-ready="true"]');
    await p.locator('#continue-game').click();
    if (await p.locator('#tutorial-skip').isVisible()) await p.locator('#tutorial-skip').click();
    const weapon = p.locator(mobile ? '.weapon-dock [data-weapon="arc"]' : '.arsenal [data-weapon="arc"]');
    await weapon.click();
    assert.equal(await p.evaluate(() => deadzone.snapshot().weapon), 'arc');
    await p.locator('#build-mode').click();
    await p.locator('[data-tower="arc"]').click();
    await p.waitForTimeout(700);
    const pad = await p.evaluate(() => deadzone.project(-15, 0, .4));
    await p.mouse.click(pad.x, pad.y);
    assert.equal(await p.evaluate(() => deadzone.snapshot().towers[0]?.type), 'arc');
    await p.locator('#upgrade').click();
    assert.equal(await p.evaluate(() => deadzone.snapshot().towers[0].level), 2);
    if (await p.evaluate(() => deadzone.snapshot().buildMode)) await p.locator('#build-mode').click();
    await p.locator('#next-wave').click();
    await p.waitForFunction(() => deadzone.snapshot().enemies.some(e => e.type === 'armored'), { timeout: 20000 });
    if (mobile) { const b=await p.locator('#aim-stick').boundingBox(); await p.touchscreen.tap(b.x+b.width/2,b.y+b.height/2); }
    else { await p.keyboard.press('4'); await p.mouse.move(650, 350); await p.mouse.down(); }
    await p.waitForTimeout(250);
    assert.ok(await p.evaluate(() => deadzone.snapshot().heat > 0));
    await p.mouse.up();

    assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    const s = await p.evaluate(() => deadzone.snapshot());
    assert.deepEqual(s.assetErrors, []); assert.equal(s.assetsLoaded.length, 14);
    await p.screenshot({ path: `artifacts/arc-pack-${width}x${height}.png`, fullPage: true });
    results.push({ width, height, weapon: s.weapon, tower: s.towers[0].type, wave: s.wave, armored: true, models: 14 });
    await p.close();
  }
  assert.deepEqual(errors, []);
  await fs.writeFile('artifacts/arc-pack-browser.json', JSON.stringify({ results, errors, physicalDevicesTested: false }, null, 2));
  console.log(JSON.stringify(results));
} finally { await browser.close(); }
