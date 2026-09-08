import test from 'node:test';
import assert from 'node:assert/strict';
import { stickVector } from '../src/controls.js';

test('搖桿中心微移不漂移，出中心後連續增速且斜向不超速', () => {
  assert.deepEqual(stickVector(.05, .05), { x: 0, y: 0 });
  assert.deepEqual(stickVector(.12, 0), { x: 0, y: 0 });
  const slow = stickVector(.13, 0), fast = stickVector(.8, 0);
  assert.ok(slow.x > 0 && slow.x < .02 && fast.x > slow.x);
  const diagonal = stickVector(1, 1);
  assert.ok(Math.abs(Math.hypot(diagonal.x, diagonal.y) - 1) < 1e-10);
  assert.equal(diagonal.x, diagonal.y);
  assert.deepEqual(stickVector(NaN, 0), { x: 0, y: 0 });
});
