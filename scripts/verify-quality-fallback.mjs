import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const url = process.env.GAME_URL || 'http://127.0.0.1:4173';
const errors = [], checks = [], measurements = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 980 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(url);
  await page.waitForSelector('body[data-ready="true"]');
  await page.locator('#tutorial-skip').click();
  const snap = () => page.evaluate(() => deadzone.snapshot());
  for (const quality of ['low', 'medium', 'high', 'low']) {
    await page.locator('#settings').click();
    await page.locator('#quality').selectOption(quality);
    await page.locator('#close-settings').click();
    // Real rAF timestamps, no accelerated clock. This is a desktop headless baseline.
    const timing = await page.evaluate(() => new Promise(resolve => {
      const samples = []; let previous = 0, warm = 30;
      function frame(t) {
        if (previous && warm-- <= 0) samples.push(t - previous);
        previous = t;
        if (samples.length < 180) requestAnimationFrame(frame);
        else {
          samples.sort((a,b) => a-b);
          resolve({ frames: samples.length, medianMs: samples[90], p95Ms: samples[171], maxMs: samples.at(-1) });
        }
      }
      requestAnimationFrame(frame);
    }));
    const state = await snap();
    measurements.push({ quality, ...timing, calls: state.render.calls, triangles: state.render.triangles, memory: state.memory });
  }
  assert.deepEqual(measurements[0].memory, measurements[3].memory);
  checks.push('低中高再回低畫質，180 幀真實 rAF 取樣；回低畫質後幾何與貼圖計數一致');
  for (const pattern of ['**/models/Characters_Sam_SingleWeapon.gltf*', '**/models/**']) {
    const fault = await browser.newPage();
    fault.on('pageerror', e => errors.push(e.message));
    await fault.route(pattern, r => r.abort());
    await fault.goto(url);
    await fault.locator('#continue-fallback').waitFor({ state: 'visible' });
    const failed = await fault.evaluate(() => deadzone.snapshot());
    assert.equal(failed.assetsReady, false);
    assert.equal(failed.paused, true);
    const expected = pattern === '**/models/**' ? 11 : 1;
    assert.equal(await fault.locator('.asset-failure').count(), expected);
    await fault.locator('#continue-fallback').click();
    await fault.locator('#next-wave').click();
    await fault.waitForFunction(() => deadzone.snapshot().enemies.length > 0);
    assert.equal(await fault.evaluate(() => deadzone.snapshot().phase), 'wave');
    await fault.unroute(pattern);
    await fault.reload();
    await fault.waitForSelector('body[data-ready="true"]');
    assert.equal(await fault.evaluate(() => deadzone.snapshot().assetsReady), true);
    checks.push(expected === 11 ? '整個模型目錄失敗時 11 項提示、備援開波，恢復網路後重載正常' : '守衛模型失敗可用幾何角色開波，恢復網路後重載正常');
    await fault.close();
  }
  assert.deepEqual(errors, []);
  const report = { date: '2026-09-06', browser: await browser.version(), viewport: '1440x980 @1', scene: '初始準備階段、無敵人、無塔', method: 'Edge headless 真實 rAF；取樣受本機負載影響，非 GPU 計時或手機 FPS 保證', measurements, checks, errors, physicalMobileTested: false };
  await fs.writeFile('artifacts/quality-fallback-report.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); }
