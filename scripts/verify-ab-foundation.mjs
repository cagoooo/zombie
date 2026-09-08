import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 980 }, serviceWorkers: 'block' }),
    runtimeErrors = [];
  page.on('pageerror', (e) => runtimeErrors.push(e.message));
  const blocked = '**/models/Textures/colormap.png';
  await page.route(blocked, (r) => r.abort());
  await page.goto(process.env.GAME_URL || 'http://127.0.0.1:5173');
  await page.locator('#continue-fallback').waitFor({ state: 'visible' });
  const failed = await page.evaluate(() => deadzone.snapshot());
  assert.equal(failed.assetsReady, false);
  assert.equal(failed.paused, true);
  assert.ok(failed.assetErrors.some((url) => url.includes('colormap.png')));
  assert.equal(await page.locator('.asset-failure').count(), 2);
  assert.equal(await page.locator('.weapon-preview').count(), 2);
  assert.equal(await page.locator('.weapon svg').count(), 2);
  await page.unroute(blocked);
  await page.locator('.asset-failure button').first().click();
  await page.waitForFunction(() => document.querySelectorAll('.asset-failure').length === 1);
  assert.equal(await page.locator('.weapon-preview').count(), 3);
  await page.locator('#retry-assets').click();
  await page.waitForFunction(() => deadzone.snapshot().assetsReady);
  assert.equal(await page.locator('.weapon-preview').count(), 4);
  assert.equal(await page.locator('#loading-panel').isVisible(), false);
  assert.equal(await page.evaluate(() => deadzone.snapshot().paused), false);
  await page.locator('#settings').click();
  await page.locator('#effects-volume').fill('27');
  await page.locator('#ambient-volume').fill('13');
  await page.locator('#reduce-motion').check();
  await page.locator('#aim-assist').uncheck();
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => deadzone.snapshot().paused), false);
  await page.reload();
  await page.waitForSelector('body[data-ready="true"]');
  if (await page.locator('#continue-game').isVisible())
    await page.locator('#continue-game').click();
  assert.deepEqual(await page.evaluate(() => deadzone.snapshot().settings), {
    effects: 27,
    music: 35,
    ambient: 13,
    reducedMotion: true,
    aimAssist: false,
    quality: 'medium',
  });
  await page.locator('#pause').click();
  await page.locator('#settings').click();
  await page.locator('#close-settings').click();
  assert.equal(await page.evaluate(() => deadzone.snapshot().paused), true);
  await page.locator('#resume').click();
  await page.route(blocked, (r) => r.abort());
  await page.reload();
  await page.locator('#continue-fallback').click();
  await page.waitForSelector('body[data-ready="true"]');
  if (await page.locator('#continue-game').isVisible())
    await page.locator('#continue-game').click();
  if (await page.locator('#tutorial-skip').isVisible()) await page.locator('#tutorial-skip').click();
  await page.locator('#open-cosmetics').click();
  await page.locator('[data-skin-target="plasma"]').click();
  await page.waitForFunction(()=>!document.querySelector('#apply-cosmetics').disabled);
  assert.match(await page.locator('#cosmetic-status').textContent(),/備援造型/);
  await page.locator('#reset-cosmetics').click();
  await page.waitForFunction(()=>!document.querySelector('#apply-cosmetics').disabled);
  await page.locator('#apply-cosmetics').click();
  await page.locator('.arsenal [data-weapon="plasma"]').click();
  await page.locator('#next-wave').click();
  await page.waitForFunction(() => deadzone.snapshot().enemies.length > 0);
  assert.equal(await page.evaluate(() => deadzone.snapshot().weapon), 'plasma');
  assert.deepEqual(runtimeErrors, []);
  const report = {
    date: new Date().toISOString(),
    injectedFailure: 'Texture request blocked in isolated browser',
    checks: [
      '失敗時暫停並列出兩項貼圖依賴錯誤',
      '內嵌貼圖的 Blender MK2 保持正常',
      '逐項重試與全部重試後恢復四張預覽',
      '備援造型可切槍開局',
      '原模型缺檔時外觀介面可恢復並套用備援造型',
      '音量與減少動態、瞄準輔助設定重載後保留',
      '設定關閉恢復原本暫停狀態',
    ],
    runtimeErrors,
  };
  await fs.writeFile('artifacts/ab-foundation-report.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
