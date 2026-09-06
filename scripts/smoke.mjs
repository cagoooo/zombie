import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
await fs.mkdir('artifacts', { recursive: true });
const browser = await chromium.launch({
  channel: 'msedge',
  headless: true,
  args: ['--enable-webgl', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 980 },
  deviceScaleFactor: 1,
});
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
await page.goto('http://127.0.0.1:5173');
await page.waitForSelector('body[data-ready="true"]', { timeout: 60000 });
await page.screenshot({ path: 'artifacts/desktop.png', fullPage: true });
console.log(
  JSON.stringify(
    { errors, snapshot: await page.evaluate(() => window.deadzone.snapshot()) },
    null,
    2,
  ),
);
await browser.close();
