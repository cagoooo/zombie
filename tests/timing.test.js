import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FixedStepper } from '../src/timing.js';
import { Game } from '../src/game.js';

test('10／30／60 FPS 的一分鐘遊戲時間一致', () => {
  for (const fps of [10, 30, 60]) {
    const clock = new FixedStepper();
    let time = 0;
    for (let frame = 0; frame < fps * 60; frame++) {
      clock.advance(1 / fps, {}, (dt) => (time += dt));
    }
    assert.ok(Math.abs(time - 60) < 1e-6);
  }
});

test('低幀率與高幀率的正常連射次數一致', () => {
  const results = [10, 30, 60].map((fps) => {
    const clock = new FixedStepper(),
      game = new Game();
    game.startWave();
    let shots = 0;
    for (let frame = 0; frame < fps * 20; frame++) {
      clock.advance(1 / fps, {}, (dt) => {
        game.update(dt);
        if (game.fire({ x: 0, z: 0 })) shots++;
        game.events = [];
      });
    }
    return shots;
  });
  assert.ok(results[0] > 0);
  assert.equal(new Set(results).size, 1);
});

test('兩倍速推進兩倍邏輯時間，暫停不補算背景時間', () => {
  const clock = new FixedStepper();
  let time = 0;
  for (let i = 0; i < 10; i++) clock.advance(0.1, { speed: 2 }, (dt) => (time += dt));
  assert.ok(Math.abs(time - 2) < 1e-6);
  clock.advance(10, { paused: true }, () => assert.fail('暫停時不應更新'));
  clock.advance(1 / 60, {}, (dt) => (time += dt));
  assert.ok(Math.abs(time - (2 + 1 / 60)) < 1e-6);
});

test('長時間卡頓限制追趕，異常時間輸入不進入無限迴圈', () => {
  const clock = new FixedStepper();
  let calls = 0;
  clock.advance(100, { speed: 2 }, () => calls++);
  assert.equal(calls, 30);
  for (const elapsed of [NaN, Infinity, -1]) {
    clock.advance(elapsed, {}, () => assert.fail('異常時間不應推進'));
  }
});
