import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const checks = [],
  errors = [],
  url = process.env.GAME_URL || 'http://127.0.0.1:4173';
let page;
try {
  page = await browser.newPage({ viewport: { width: 1440, height: 980 } });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url);
  await page.waitForSelector('body[data-ready="true"]');
  await page.clock.install();
  const snap = () => page.evaluate(() => deadzone.snapshot());
  async function pad(n) {
    const coords = [
      [-15, 0],
      [-7, 0],
      [-6, 8],
      [2, 0],
      [4, -9],
      [12, -1],
      [13, 8],
      [-15, -9],
    ];
    await page.clock.runFor(650);
    const p = await page.evaluate(([x, z]) => deadzone.project(x, z, 0.4), coords[n]);
    await page.mouse.click(p.x, p.y);
  }
  const initial = await snap(),
    coreBefore = await page.evaluate(() => deadzone.project(18, 4));
  await page.keyboard.down('w');
  await page.clock.runFor(900);
  await page.keyboard.up('w');
  const moved = await snap(),
    coreAfter = await page.evaluate(() => deadzone.project(18, 4));
  assert.ok(Math.hypot(moved.player.x - initial.player.x, moved.player.z - initial.player.z) > 3);
  assert.ok(Math.hypot(coreBefore.x - coreAfter.x, coreBefore.y - coreAfter.y) > 5);
  assert.match(await page.locator('#tutorial-text').textContent(), /1\/5/);
  checks.push('桌機 WASD 移動、鏡頭跟隨與教學完成判定');
  await page.locator('#build-mode').click();
  await pad(0);
  assert.equal((await snap()).credits, 200);
  await page.locator('#upgrade').click();
  assert.equal((await snap()).credits, 130);
  await page.keyboard.press('2');
  await page.clock.runFor(900);
  const deployed = await snap();
  assert.equal(deployed.towers[0].level, 2);
  await page.reload();
  await page.locator('#continue-game').waitFor({ state: 'visible' });
  assert.equal((await snap()).paused, true);
  await page.locator('#continue-game').click();
  const restored = await snap();
  assert.equal(restored.credits, 130);
  assert.equal(restored.towers[0].level, 2);
  assert.equal(restored.weapon, 'plasma');
  assert.ok(Math.abs(restored.player.x - deployed.player.x) < 0.01);
  checks.push('準備階段建塔／升級／切槍與人物位置保存，重載可續玩');
  await page.locator('#next-wave').click();
  await page.clock.runFor(6000);
  assert.equal((await snap()).phase, 'wave');
  await page.reload();
  await page.locator('#continue-game').click();
  assert.equal((await snap()).phase, 'ready');
  assert.equal((await snap()).wave, 0);
  assert.equal((await snap()).credits, 130);
  checks.push('戰鬥中重整回到最近部署，不保存半場敵人或重複波次獎勵');
  await page.locator('#settings').click();
  await page.locator('#quality').selectOption('low');
  await page.locator('#close-settings').click();
  await page.clock.runFor(150);
  const low = await snap();
  await page.locator('#settings').click();
  await page.locator('#quality').selectOption('high');
  await page.locator('#close-settings').click();
  await page.clock.runFor(150);
  const high = await snap();
  assert.equal(low.quality, 'low');
  assert.equal(high.quality, 'high');
  assert.ok(high.render.calls > low.render.calls);
  assert.ok(high.batching.after < high.batching.before);
  checks.push('低／高畫質切換有效，同場景陰影繪製量與靜態合併有紀錄');
  await page.locator('#settings').click();
  await page.locator('#replay-tutorial').click();
  assert.equal(await page.locator('#tutorial').isVisible(), true);
  await page.locator('#tutorial-skip').click();
  await page.keyboard.press('p');
  const paused = (await snap()).player;
  await page.keyboard.down('d');
  await page.clock.runFor(600);
  await page.keyboard.up('d');
  assert.equal((await snap()).player.x, paused.x);
  await page.locator('#resume').click();
  await page.screenshot({ path: 'artifacts/third-person-desktop.png', fullPage: true });
  checks.push('教學可重看與略過；暫停不接受移動');
  // Fault injection targets storage only, not combat state.
  await page.evaluate(() => localStorage.setItem('deadzone-checkpoint-v1', '{"version":999}'));
  await page.reload();
  await page.locator('#new-game').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#continue-game').isVisible(), false);
  await page.locator('#new-game').click();
  assert.equal((await snap()).credits, 300);
  checks.push('不相容存檔提供新戰局入口，遊戲不白屏');
  const mobile = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 1,
  });
  mobile.on('pageerror', (e) => errors.push(e.message));
  await mobile.goto(url);
  await mobile.waitForSelector('body[data-ready="true"]');
  await mobile.clock.install();
  await mobile.locator('#tutorial-skip').click();
  const session = await mobile.context().newCDPSession(mobile);
  const box = await mobile.locator('#move-stick').boundingBox(),
    aim = await mobile.locator('#aim-stick').boundingBox();
  const touches = [
    { x: box.x + box.width / 2, y: box.y + box.height / 2 - 27, id: 1 },
    { x: aim.x + aim.width / 2 - 22, y: aim.y + aim.height / 2 - 15, id: 2 },
  ];
  const msnap = () => mobile.evaluate(() => deadzone.snapshot());
  await mobile.locator('#next-wave').click();
  const before = await msnap();
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: touches });
  await mobile.clock.runFor(900);
  const during = await msnap();
  assert.ok(Math.hypot(during.player.x - before.player.x, during.player.z - before.player.z) > 2);
  assert.ok(during.heat > 0);
  await session.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  await mobile.clock.runFor(350);
  const stopped = await msnap();
  await mobile.clock.runFor(350);
  assert.equal((await msnap()).player.x, stopped.player.x);
  assert.ok((await msnap()).heat <= stopped.heat);
  await mobile.locator('.weapon-dock [data-weapon="cryo"]').tap();
  assert.equal((await msnap()).weapon, 'cryo');
  for (const selector of ['#move-stick', '#aim-stick', '.weapon-dock', '#pause', '#build-mode']) {
    const r = await mobile.locator(selector).boundingBox();
    assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.width <= 391 && r.y + r.height <= 845);
  }
  assert.equal(
    await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    true,
  );
  await mobile.screenshot({ path: 'artifacts/third-person-mobile.png' });
  await mobile.locator('#build-mode').tap();
  assert.equal(await mobile.locator('.command-panel').isVisible(), true);
  await mobile.locator('[data-tower="pulse"]').tap();
  assert.equal(await mobile.locator('.command-panel').isVisible(), false);
  await mobile.locator('#build-mode').tap();
  await mobile.setViewportSize({ width: 844, height: 390 });
  await mobile.clock.runFor(250);
  for (const selector of ['#move-stick', '#aim-stick', '.weapon-dock', '#pause']) {
    const r = await mobile.locator(selector).boundingBox();
    assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.width <= 845 && r.y + r.height <= 391);
  }
  await mobile.screenshot({ path: 'artifacts/third-person-landscape.png' });
  checks.push('390×844／844×390 觸控模擬可同時移動射擊、取消停止、常駐切槍、建造抽屜，無捲頁');
  assert.deepEqual(errors, []);
  const report = {
    date: '2026-09-06',
    checks,
    errors,
    quality: {
      low: { calls: low.render.calls, triangles: low.render.triangles },
      high: { calls: high.render.calls, triangles: high.render.triangles },
    },
    batching: high.batching,
    physicalMobileTested: false,
  };
  await fs.writeFile('artifacts/third-person-report.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} catch (e) {
  if (page)
    await page
      .screenshot({ path: 'artifacts/third-person-failure.png', fullPage: true })
      .catch(() => {});
  throw e;
} finally {
  await browser.close();
}
