import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FrameMetrics } from '../src/performance.js';

test('耐久診斷固定容量，保留近期幀時間並累計真實活躍時間', () => {
  const metric = new FrameMetrics(3);
  for (const ms of [10, 20, 30, 40]) metric.record(ms, true);
  assert.deepEqual(metric.snapshot(), {
    samples: 3, capacity: 3, activeFrames: 4, activeSeconds: .1,
    recentFps: 100 / 3, medianMs: 30, p95Ms: 40,
  });
});

test('暫停、背景與無效值不污染效能結果，讀取不改變計數', () => {
  const metric = new FrameMetrics();
  metric.record(16, true);
  for (const ms of [NaN, Infinity, 0, -1]) metric.record(ms, true);
  metric.record(60000, false);
  const result = metric.snapshot();
  assert.equal(result.activeFrames, 1);
  assert.equal(result.p95Ms, 16);
  assert.deepEqual(metric.snapshot(), result);
});
