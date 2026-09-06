import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.js';

test('關閉瞄準輔助後偏離目標的射擊不造成傷害', () => {
  for (const assist of [true, false]) {
    const g = new Game();
    Object.assign(g.player, {x:-15,z:-4});
    g.startWave();
    g.spawn();
    g.aimAssist = assist;
    const e = g.enemies[0],
      hp = e.hp;
    g.fire({ x: e.x + 1.5, z: e.z });
    assert.equal(e.hp < hp, assist);
    assert.equal(g.events.filter((e) => e.type === 'hit').length, assist ? 1 : 0);
  }
});
test('致命傷回饋先受擊再死亡，重複傷害不再發送死亡或獎勵', () => {
  const g = new Game();
  g.startWave();
  g.spawn();
  g.events = [];
  const e = g.enemies[0],
    credits = g.credits;
  g.damage(e, e.hp);
  g.damage(e, 100);
  assert.deepEqual(
    g.events.map((e) => e.type),
    ['hit', 'kill'],
  );
  assert.equal(g.kills, 1);
  assert.equal(g.credits, credits + e.reward);
});
