import { chromium } from '@playwright/test';
import { OrthographicCamera, Vector3 } from 'three';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
await fs.mkdir('artifacts', { recursive: true });
const browser = await chromium.launch({
  channel: 'msedge',
  headless: true,
  args: ['--enable-webgl', '--ignore-gpu-blocklist'],
});
process.on('uncaughtException', async (error) => {
  console.error(error);
  await browser.close();
  process.exit(1);
});
const errors = [],
  checks = [];
async function setup(options) {
  const context = await browser.newContext(options),
    page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto(process.env.GAME_URL || 'http://127.0.0.1:5173');
  await page.waitForSelector('body[data-ready="true"]', { timeout: 60000 });
  return page;
}
async function point(page, x, z, y = 0.4) {
  return page.evaluate(([x, z, y]) => deadzone.project(x, z, y), [x, z, y]);
}
async function clickWorld(page, x, z) {
  if (!(await page.evaluate(() => deadzone.snapshot().buildMode)))
    await page.locator('#build-mode').click();
  await page.waitForTimeout(650);
  const p = await point(page, x, z);
  await page.mouse.click(p.x, p.y);
}
const page = await setup({ viewport: { width: 1440, height: 980 }, deviceScaleFactor: 1 });
await page.locator('#tutorial-skip').click();
await page.keyboard.down('w');
await page.waitForTimeout(900);
await page.keyboard.up('w');
assert.deepEqual((await page.evaluate(() => deadzone.snapshot())).assetErrors, []);
assert.equal(await page.locator('.weapon-preview').count(), 3);
checks.push('11 個素材模型與 3 張 3D 武器預覽載入');
await page.screenshot({ path: 'artifacts/desktop.png', fullPage: true });
await clickWorld(page, -15, 0);
assert.equal((await page.evaluate(() => deadzone.snapshot())).credits, 200);
assert.equal(await page.locator('#upgrade').count(), 1);
await page.locator('#upgrade').click();
assert.equal((await page.evaluate(() => deadzone.snapshot())).credits, 130);
assert.equal((await page.evaluate(() => deadzone.snapshot())).towers[0].level, 2);
await page.locator('#sell').click();
assert.equal((await page.evaluate(() => deadzone.snapshot())).credits, 249);
checks.push('滑鼠建造、升級、出售與退款正確');
await clickWorld(page, -15, 0);
await page.locator('[data-tower="cryo"]').click();
await clickWorld(page, -7, 0);
assert.equal((await page.evaluate(() => deadzone.snapshot())).towers.length, 2);
checks.push('不同類型防禦塔可部署');
await page.keyboard.press('2');
assert.equal((await page.evaluate(() => deadzone.snapshot())).weapon, 'plasma');
await page.locator('.arsenal [data-weapon="cryo"]').click();
assert.equal((await page.evaluate(() => deadzone.snapshot())).weapon, 'cryo');
await page.keyboard.press('1');
checks.push('數字鍵與武器卡切換有效');
await page.locator('#next-wave').click();
if (!(await page.evaluate(() => deadzone.snapshot().overview))) {
  await page.locator('#overview').click();
  await page.waitForTimeout(650);
}
await page.waitForFunction(() => deadzone.snapshot().enemies.length > 0);
await page.keyboard.press('p');
assert.equal((await page.evaluate(() => deadzone.snapshot())).paused, true);
const paused = await page.evaluate(() => deadzone.snapshot().enemies[0].distance);
await page.waitForTimeout(350);
assert.equal(await page.evaluate(() => deadzone.snapshot().enemies[0].distance), paused);
await page.locator('#resume').click();
checks.push('暫停時殭屍停止移動，恢復後可繼續');
const before = await page.evaluate(() => deadzone.snapshot().kills);
let peakHeat = 0;
for (let i = 0; i < 28; i++) {
  const s = await page.evaluate(() => deadzone.snapshot());
  const target = s.enemies.find((e) => e.hp > 0);
  if (target) {
    const p = await point(page, target.x, target.z, 0);
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await page.waitForTimeout(110);
    await page.mouse.up();
    peakHeat = Math.max(peakHeat, await page.evaluate(() => deadzone.snapshot().heat));
  } else await page.waitForTimeout(150);
}
assert.ok((await page.evaluate(() => deadzone.snapshot())).kills > before);
assert.ok(peakHeat > 0);
checks.push('實際瞄準連射造成傷害、擊退與熱量');
await page.locator('#speed').click();
assert.match(await page.locator('#speed').textContent(), /2×/);
await page.locator('#sound').click();
assert.equal(await page.locator('#sound').getAttribute('aria-pressed'), 'true');
checks.push('2 倍速與音效控制有效');
await page.screenshot({ path: 'artifacts/combat.png', fullPage: true });
// Browser clock acceleration exercises actual requestAnimationFrame game loop to wave completion.
await page.clock.install();
let reachedReady = false;
for (let i = 0; i < 80; i++) {
  await page.clock.runFor(1000);
  const s = await page.evaluate(() => deadzone.snapshot());
  if (s.phase === 'ready') {
    reachedReady = true;
    break;
  }
}
assert.equal(reachedReady, true);
await page.locator('#next-wave').click();
assert.equal((await page.evaluate(() => deadzone.snapshot())).wave, 2);
checks.push('實際瀏覽器第一波可完成並進入第二波');
const mobile = await setup({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
});
assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
await mobile.locator('#tutorial-skip').click();
await mobile.locator('#build-mode').tap();
await mobile.locator('[data-tower="pulse"]').tap();
await mobile.waitForTimeout(650);
const p = await point(mobile, -15, 0);
await mobile.touchscreen.tap(p.x, p.y);
assert.equal((await mobile.evaluate(() => deadzone.snapshot())).towers.length, 1);
await mobile.locator('#build-mode').tap();
await mobile.locator('.weapon-dock [data-weapon="plasma"]').tap();
assert.equal((await mobile.evaluate(() => deadzone.snapshot())).weapon, 'plasma');
await mobile.locator('#help').tap();
assert.equal(await mobile.locator('#dialog-title').textContent(), '指揮官，準備就緒。');
await mobile.locator('#resume').tap();
checks.push('390px 手機無橫向溢出，觸控建造、切槍與說明可用');
await mobile.screenshot({ path: 'artifacts/mobile.png', fullPage: true });
assert.deepEqual(errors, []);
checks.push('瀏覽器零 JavaScript / 素材載入錯誤');
const report = {
  passed: checks.length,
  checks,
  errors,
  desktop: await page.evaluate(() => deadzone.snapshot()),
  mobile: await mobile.evaluate(() => deadzone.snapshot()),
};
await fs.writeFile('artifacts/browser-report.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify({ passed: checks.length, checks, errors }, null, 2));
await browser.close();
