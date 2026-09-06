import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.js';
import { canStand, rayStop } from '../src/world.js';
import { checkpoint, restore } from '../src/save.js';
import { screenVector } from '../src/controls.js';

test('角色移動、斜向速度、奔跑及暫停符合規則', () => {
  const make = () => {
    const g = new Game();
    Object.assign(g.player, { x: 0, z: 0 });
    return g;
  };
  const a = make(),
    b = make(),
    c = make();
  for (let i = 0; i < 30; i++) {
    a.move(1, 0, 1 / 60);
    b.move(1, 1, 1 / 60);
    c.move(1, 0, 1 / 60, true);
  }
  assert.ok(Math.abs(Math.hypot(b.player.x, b.player.z) - a.player.x) < 1e-8);
  assert.ok(c.player.x > a.player.x);
  a.paused = true;
  const before = { ...a.player };
  a.move(1, 0, 0.1);
  assert.equal(a.player.x, before.x);
  const v = screenVector(1, 0);
  assert.ok(v.x > 0 && v.z < 0);
  assert.ok(Math.abs(Math.hypot(v.x, v.z) - 1) < 1e-8);
});
test('主要障礙、已建塔及邊界阻擋人物，角色不能被新塔包住', () => {
  const g = new Game();
  Object.assign(g.player, { x: -5, z: -6 });
  for (let i = 0; i < 180; i++) g.move(0, -1, 1 / 60);
  assert.ok(g.player.z > -8.1);
  assert.ok(canStand(g.player.x, g.player.z));
  Object.assign(g.player, { x: -15, z: 0 });
  assert.equal(g.build(0, 'pulse'), false);
  Object.assign(g.player, { x: 0, z: 0 });
  g.build(0, 'pulse');
  assert.equal(canStand(-15, 0, g.towers), false);
  for (let i = 0; i < 1000; i++) g.move(1, 0, 1 / 60);
  assert.ok(g.player.x <= 20.62);
});
test('武器從角色位置發射，超射程與貨櫃遮擋不傷害敵人', () => {
  const g = new Game();
  g.startWave();
  g.spawn();
  let e = g.enemies[0];
  g.fire(e);
  assert.equal(e.hp, e.maxHp);
  Object.assign(g.player, { x: -15, z: -4 });
  g.cooldown = 0;
  g.fire(e);
  assert.ok(e.hp < e.maxHp);
  const shot = g.events.filter((e) => e.type === 'shot').at(-1);
  assert.equal(shot.from.x, -15);
  Object.assign(g.player, { x: -5, z: -6 });
  Object.assign(e, { x: -5, z: -11.5, hp: 100 });
  g.cooldown = 0;
  g.fire(e);
  assert.equal(e.hp, 100);
  assert.ok(rayStop(g.player, e) < 1);
});
test('準備階段存檔往返保留經濟與塔，戰鬥中不覆蓋檢查點', () => {
  const g = new Game();
  g.build(0, 'pulse');
  g.upgrade(g.towers[0].id);
  g.switchWeapon('cryo');
  g.wave = 2;
  const data = checkpoint(g),
    copy = restore(JSON.stringify(data));
  assert.deepEqual(checkpoint(copy), data);
  assert.equal(copy.enemies.length, 0);
  assert.equal(copy.phase, 'ready');
  g.startWave();
  assert.equal(checkpoint(g), null);
  const reward = copy.credits;
  copy.startWave();
  assert.equal(copy.credits, reward);
});
test('拒絕不相容、損毀、越界、重複塔、非法退款與非有限值存檔', () => {
  const g = new Game();
  g.build(0, 'pulse');
  const base = checkpoint(g);
  for (const patch of [
    { version: 9 },
    { wave: 10 },
    { credits: -1 },
    { health: 0 },
    { player: { x: 999, z: 0, angle: 0 } },
    { player: { x: 0, z: 0, angle: NaN } },
    { towers: [...base.towers, ...base.towers] },
    { towers: [{ ...base.towers[0], spent: 999 }] },
  ])
    assert.throws(() => restore({ ...base, ...patch }));
  assert.throws(() => restore('{broken'));
  assert.throws(() => restore(null));
  assert.throws(() => restore({ ...base, weapon: 'constructor' }));
  assert.throws(() => restore({ ...base, towers: [{ ...base.towers[0], type: 'constructor' }] }));
});
