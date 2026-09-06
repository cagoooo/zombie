import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const url = process.env.GAME_URL || 'http://127.0.0.1:5173/';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const errors = [],
  checks = [];
async function ready(page) {
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url);
  await page.waitForSelector('body[data-ready="true"]');
  if (await page.locator('#continue-game').isVisible())
    await page.locator('#continue-game').click();
  if (await page.locator('#tutorial-skip').isVisible())
    await page.locator('#tutorial-skip').click();
}
async function playing(page) {
  await page.waitForFunction(() => deadzone.snapshot().audio.state === 'playing');
  const before = await page.evaluate(() => deadzone.snapshot().audio.currentTime);
  await page.waitForFunction((time) => deadzone.snapshot().audio.currentTime > time + 0.3, before);
}
try {
  const page = await browser.newPage();
  await ready(page);
  assert.equal(await page.evaluate(() => deadzone.snapshot().audio.state), 'off');
  await page.locator('#next-wave').click();
  await playing(page);
  assert.equal(await page.locator('#bgm').count(), 1);
  const initial = await page.evaluate(() => deadzone.snapshot().audio);
  assert.ok(initial.duration > 50);
  assert.equal(initial.loop, true);
  checks.push('首次開波經使用者手勢啟動，實際 MP3 解碼及時間前進');
  await page.locator('#pause').click();
  const paused = await page.evaluate(() => deadzone.snapshot().audio.currentTime);
  await page.waitForTimeout(500);
  assert.equal(await page.evaluate(() => deadzone.snapshot().audio.currentTime), paused);
  await page.locator('#resume').click();
  await playing(page);
  checks.push('暫停停止音樂時間，繼續由原位置播放');
  await page.locator('#settings').click();
  await page.locator('#music-volume').fill('0');
  await page.locator('#close-settings').click();
  assert.equal(await page.evaluate(() => deadzone.snapshot().audio.state), 'silent');
  await page.locator('#settings').click();
  await page.locator('#music-volume').fill('23');
  await page.locator('#close-settings').click();
  await playing(page);
  await page.locator('#sound').click();
  assert.equal(await page.evaluate(() => deadzone.snapshot().audio.paused), true);
  await page.reload();
  await page.waitForSelector('body[data-ready="true"]');
  if (await page.locator('#continue-game').isVisible())
    await page.locator('#continue-game').click();
  assert.equal(await page.evaluate(() => deadzone.snapshot().settings.music), 23);
  await page.locator('#next-wave').click();
  assert.equal(await page.evaluate(() => deadzone.snapshot().audio.paused), true);
  await page.locator('#sound').click();
  await playing(page);
  checks.push('獨立音量、零音量、靜音重載記憶及手動恢復');
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  assert.equal(await page.evaluate(() => deadzone.snapshot().audio.paused), true);
  await page.evaluate(() => {
    delete document.hidden;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  assert.equal(await page.evaluate(() => deadzone.snapshot().paused), true);
  await page.locator('#resume').click();
  await playing(page);
  checks.push('分頁可見性事件模擬：停止 BGM、戰鬥暫停、返回後手動繼續');
  // Seek only the media timeline to exercise native looping without changing game state.
  await page.evaluate(() => {
    const a = document.querySelector('#bgm');
    a.currentTime = a.duration - 0.3;
  });
  await page.waitForFunction(() => document.querySelector('#bgm').currentTime < 2);
  await playing(page);
  checks.push('原生循環越過曲尾，維持唯一音樂元素');
  await page.close();
  const broken = await browser.newPage();
  await broken.route('**/audio/*.mp3', (route) => route.abort());
  await ready(broken);
  await broken.locator('#sound').click();
  await broken.waitForFunction(() => deadzone.snapshot().audio.state === 'error');
  await broken.locator('#settings').click();
  assert.equal(await broken.locator('#retry-music').isVisible(), true);
  await broken.unroute('**/audio/*.mp3');
  await broken.locator('#retry-music').click();
  await broken.locator('#close-settings').click();
  await playing(broken);
  checks.push('實際音檔請求失敗可見提示，設定重試成功恢復');
  await broken.close();
  for (const [width, height] of [
    [320, 640],
    [390, 844],
    [844, 390],
    [768, 1024],
    [1024, 768],
  ]) {
    const p = await browser.newPage({
      viewport: { width, height },
      isMobile: true,
      hasTouch: true,
    });
    await ready(p);
    await p.locator('#settings').tap();
    await p.locator('#enable-music').tap();
    await p.locator('#music-volume').fill('40');
    await p.locator('#close-settings').tap();
    await playing(p);
    assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await p.locator('#settings').tap();
    await p.locator('#music-volume').scrollIntoViewIfNeeded();
    await p.screenshot({ path: `artifacts/bgm-${width}x${height}.png` });
    await p.close();
  }
  checks.push('五尺寸手機／平板設定可捲動、音量與開關可觸控');
  assert.deepEqual(errors, []);
  const report = { url, checks, initial, errors, physicalDevicesTested: false };
  await fs.writeFile('artifacts/bgm-report.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
