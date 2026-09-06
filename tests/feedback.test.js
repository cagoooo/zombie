import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.js';

test('手機前方射線命中最近敵人，排除後方、側方、超射程與障礙後方', () => {
  for (const weapon of ['pulse','plasma','cryo']) {
    const g=new Game();g.startWave();g.weapon=weapon;g.aimAssist=false;
    Object.assign(g.player,{x:0,z:0});
    const enemy=(x,z)=>({x,z,hp:1000,reward:0,slow:0,type:'basic'});
    const near=enemy(0,3),far=enemy(0,7),behind=enemy(0,-1),side=enemy(3,2),beyond=enemy(0,30);
    g.enemies=[far,behind,side,beyond,near];
    assert.equal(g.fire({x:0,z:26},true),true);
    assert.ok(near.hp<1000);assert.equal(far.hp,1000);assert.equal(behind.hp,1000);assert.equal(side.hp,1000);assert.equal(beyond.hp,1000);
    g.cooldown=0;g.enemies=[enemy(0,9)];
    // Existing scenery at (1,8) blocks this offset line.
    g.player.x=1;g.enemies[0].x=1;
    g.fire({x:1,z:26},true);assert.equal(g.enemies[0].hp,1000);
  }
});

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
