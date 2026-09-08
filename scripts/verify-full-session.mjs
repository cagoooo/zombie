import { chromium } from '@playwright/test';
import { OrthographicCamera, Vector3 } from 'three';
import { PADS, TOWERS, BRANCHES } from '../src/game.js';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

await fs.mkdir('artifacts', { recursive: true });
const browser = await chromium.launch({
  channel: 'msedge',
  headless: true,
  args: ['--enable-webgl', '--ignore-gpu-blocklist'],
});
const errors = [],
  history = [];
let page;
try {
  page = await browser.newPage({ viewport: { width: 1440, height: 980 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto(process.env.GAME_URL || 'http://127.0.0.1:5173');
  await page.waitForSelector('body[data-ready="true"]');
  await page.locator('#tutorial-skip').click();
  await page.locator('#open-cosmetics').click();
  for(const target of ['guard','pulse','plasma','cryo']){
    await page.locator(`[data-skin-target="${target}"]`).click();
    await page.locator(`[data-skin-id="${target}-polar"]`).click();
    await page.waitForFunction(()=>!document.querySelector('#apply-cosmetics').disabled);
  }
  await page.locator('#apply-cosmetics').click();
  await page.waitForFunction(()=>deadzone.snapshot().grip.bone==='Middle1L');
  await page.clock.install();
  await page.keyboard.down('w');
  await page.clock.runFor(900);
  await page.keyboard.up('w');
  const snapshot = () => page.evaluate(() => deadzone.snapshot());
  async function point(x, z, y = 0.4) {
    return page.evaluate(([x, z, y]) => deadzone.project(x, z, y), [x, z, y]);
  }
  async function clickPad(pad) {
    if (!(await snapshot()).buildMode) await page.locator('#build-mode').click();
    await page.clock.runFor(650);
    const p = await point(...PADS[pad]);
    await page.mouse.click(p.x, p.y);
  }
  const plan = [
    [0, 'pulse'],
    [1, 'cryo'],
    [7, 'plasma'],
    [4, process.env.TOWER_STRATEGY_TEST ? 'arc' : 'pulse'],
    [3, 'plasma'],
    [5, 'pulse'],
    [2, 'pulse'],
    [6, 'plasma'],
  ];
  async function deploy() {
    for (const [pad, type] of plan) {
      const s = await snapshot();
      if (!s.towers.some((t) => t.pad === pad) && s.credits >= TOWERS[type].cost) {
        await page.locator(`[data-tower="${type}"]`).click();
        await clickPad(pad);
        assert.ok((await snapshot()).towers.some((t) => t.pad === pad));
        if (process.env.TOWER_STRATEGY_TEST) {
          await page.locator('#tower-strategy').selectOption(type === 'cryo' ? 'nearest' : type === 'arc' ? 'strongest' : 'first');
        }
      }
    }
    for (const tower of (await snapshot()).towers) {
      while (true) {
        const s = await snapshot(),
          t = s.towers.find((x) => x.id === tower.id);
        if (TOWERS[t.type].support || t.level >= 3 || s.credits < Math.round(TOWERS[t.type].cost * 0.7 * t.level)) break;
        await clickPad(t.pad);
        if(t.level === 2) await page.locator('#tower-branch').selectOption(Object.keys(BRANCHES[t.type])[0]);
        await page.locator('#upgrade').click();
        assert.ok((await snapshot()).towers.find((x) => x.id === t.id).level > t.level);
      }
    }
  }
  await page.locator('#speed').click();
  let seenWave = 0;
  for (let i = 0; i < 1400; i++) {
    await page.mouse.up();
    let s = await snapshot();
    if (['won', 'lost'].includes(s.phase)) break;
    if (s.phase === 'ready') {
      await deploy();
      await page.clock.runFor(120);
      await page.locator('#next-wave').click();
      s = await snapshot();
    }
    if (s.wave !== seenWave) {
      seenWave = s.wave;
      history.push({ wave: s.wave, health: s.health, credits: s.credits, towers: s.towers.length });
      console.log(`正在驗證第 ${s.wave} 波，核心 ${s.health}%`);
    }
    const target = s.enemies.filter((e) => e.hp > 0).sort((a, b) => b.distance - a.distance)[0];
    if (target) {
      const p = await point(target.x, target.z, 0);
      if (p.visible) {
        await page.mouse.move(p.x, p.y);
        await page.mouse.down();
      }
    }
    await page.clock.runFor(450);
  }
  await page.mouse.up();
  const won = await snapshot();
  assert.equal(won.phase, 'won');
  assert.equal(won.wave, 10);
  assert.ok(won.kills > 0);
  assert.match(await page.locator('#dialog-title').textContent(), /守住/);
  await page.screenshot({ path: 'artifacts/full-victory.png', fullPage: true });
  await page.locator('#resume').click();
  let restarted = await snapshot();
  assert.equal(restarted.phase, 'ready');
  assert.equal(restarted.health, 100);
  assert.equal(restarted.credits, 300);
  assert.equal(restarted.kills, 0);
  assert.equal(restarted.towers.length, 0);
  assert.equal(restarted.enemies.length, 0);
  const resourcesAfterWin = { memory: restarted.memory, effects: restarted.effectResources };
  assert.equal(restarted.effectResources.active, 0);
  assert.ok(Object.values(restarted.effectResources.pooled).every(n => n <= 12));
  // A second complete outcome uses ordinary UI only: no towers and no shots.
  for (let i = 0; i < 90; i++) {
    let s = await snapshot();
    if (s.phase === 'lost') break;
    if (s.phase === 'ready') {
      await page.clock.runFor(100);
      await page.locator('#next-wave').click();
    }
    await page.clock.runFor(2000);
  }
  const lost = await snapshot();
  assert.equal(lost.phase, 'lost');
  assert.equal(lost.health, 0);
  assert.match(await page.locator('#dialog-title').textContent(), /失守/);
  await page.screenshot({ path: 'artifacts/full-defeat.png', fullPage: true });
  await page.locator('#resume').click();
  restarted = await snapshot();
  assert.equal(restarted.credits, 300);
  assert.equal(restarted.health, 100);
  assert.equal(restarted.phase, 'ready');
  assert.equal(restarted.enemies.length, 0);
  assert.equal(restarted.towers.length, 0);
  await page.clock.runFor(100);
  await clickPad(0);
  await page.clock.runFor(100);
  await page.locator('#next-wave').click();
  await page.clock.runFor(2500);
  assert.equal((await snapshot()).wave, 1);
  assert.ok((await snapshot()).enemies.length > 0);
  assert.deepEqual(errors, []);
  const report = {
    date: new Date().toISOString(),
    browser: 'Microsoft Edge headless',
    configuration: process.env.TOWER_STRATEGY_TEST ? '四塔混合；冰凍最近、電弧最強、其餘最前方' : '原配置；最前方',
    viewport: '1440x980',
    method:
      'Normal pointer and button input with accelerated browser clock; read-only snapshots; no resource or combat cheats',
    history,
    win: { wave: won.wave, kills: won.kills, health: won.health },
    loss: { wave: lost.wave, health: lost.health },
    restartAfterWin: true,
    restartAfterLoss: true,
    thirdGameStarted: true,
    cosmetics: won.cosmetics,
    grip: won.grip,
    resourcesAfterWin,
    resourcesAfterLoss: { memory: restarted.memory, effects: restarted.effectResources },
    errors,
  };
  await fs.writeFile('artifacts/full-session-report.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  if (page) {
    await page
      .screenshot({ path: 'artifacts/full-session-failure.png', fullPage: true })
      .catch(() => {});
    console.error(await page.evaluate(() => deadzone?.snapshot()).catch(() => null));
  }
  throw error;
} finally {
  await browser.close();
}
