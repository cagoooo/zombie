import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, PATH_LENGTH, pathPoint } from '../src/game.js';
const tick = (game, seconds) => {
  for (let n = 0; n < seconds * 20; n++) game.update(0.05);
};
test('路徑終點抵達能源核心且轉彎連續', () => {
  assert.equal(PATH_LENGTH, 65);
  assert.deepEqual(pathPoint(9), { x: -11, z: -5, angle: Math.PI / 2 });
  assert.equal(pathPoint(18).z, 4);
  assert.equal(pathPoint(PATH_LENGTH).x, 18);
});
test('建造扣款且阻止重複基座與能源透支', () => {
  const g = new Game();
  assert.equal(g.build(0, 'pulse'), true);
  assert.equal(g.credits, 200);
  assert.equal(g.build(0, 'cryo'), false);
  assert.equal(g.build(1, 'plasma'), true);
  assert.equal(g.build(2, 'pulse'), false);
  assert.equal(g.credits, 25);
  assert.equal(g.build(99, 'pulse'), false);
});
test('升級與出售按實際投入成本結算', () => {
  const g = new Game();
  g.build(0, 'pulse');
  const t = g.towers[0];
  assert.equal(g.upgrade(t.id), true);
  assert.equal(g.credits, 130);
  assert.equal(t.level, 2);
  assert.equal(g.upgrade(t.id), false);
  assert.equal(g.sell(t.id), true);
  assert.equal(g.credits, 249);
  assert.equal(g.towers.length, 0);
  assert.equal(g.sell(t.id), false);
});
test('暫停時不能移動、開火、建造或開始波次', () => {
  const g = new Game();
  g.startWave();
  tick(g, 1);
  g.paused = true;
  const snapshot = JSON.stringify(g);
  tick(g, 3);
  assert.equal(g.fire({ x: -20, z: -5 }), false);
  assert.equal(g.build(0, 'pulse'), false);
  assert.equal(g.startWave(), false);
  assert.equal(JSON.stringify(g), snapshot);
});
test('三種武器切換共用熱量與射擊冷卻', () => {
  const g = new Game();
  g.startWave();
  g.fire({ x: 0, z: 0 });
  const heat = g.heat;
  g.switchWeapon('plasma');
  assert.equal(g.heat, heat);
  assert.equal(g.fire({ x: 0, z: 0 }), false);
  assert.equal(g.switchWeapon('unknown'), false);
});
test('連射達到過熱後會鎖定並自動冷卻', () => {
  const g = new Game();
  g.startWave();
  let overheated = false;
  for (let i = 0; i < 400; i++) {
    g.update(0.05);
    g.fire({ x: 0, z: 0 });
    if (g.overheated) {
      overheated = true;
      break;
    }
  }
  assert.equal(overheated, true);
  g.switchWeapon('cryo');
  assert.equal(g.fire({ x: 0, z: 0 }), false);
  tick(g, 4);
  assert.equal(g.overheated, false);
  assert.ok(g.heat < 23);
});
test('電漿同時傷害鄰近敵人，冰霜施加減速', () => {
  const g = new Game();
  Object.assign(g.player, {x:-15,z:-4});
  g.startWave();
  g.spawn();
  g.spawn();
  g.enemies[0].hp = 100;
  g.enemies[1].hp = 100;
  g.switchWeapon('plasma');
  assert.equal(g.fire({ x: -20, z: -5 }), true);
  assert.equal(g.enemies[0].hp, 36);
  assert.equal(g.enemies[1].hp, 36);
  tick(g, 0.75);
  g.switchWeapon('cryo');
  g.fire(g.enemies[0]);
  assert.ok(g.enemies[0].slow > 0);
});
test('同一隻殭屍不能重複計算擊退獎勵', () => {
  const g = new Game();
  g.startWave();
  g.spawn();
  const e = g.enemies[0];
  g.damage(e, 9999);
  g.damage(e, 9999);
  assert.equal(g.kills, 1);
  assert.equal(g.credits, 312);
});
test('守塔會自主選擇射程內敵人並射擊', () => {
  const g = new Game();
  g.build(7, 'pulse');
  g.startWave();
  tick(g, 8);
  assert.ok(g.kills > 0);
  assert.ok(g.events.some((e) => e.type === 'shot' && e.towerId));
});
test('敵人抵達核心扣血，失敗後不可再開始或建造', () => {
  const g = new Game();
  g.startWave();
  tick(g, 100);
  assert.equal(g.health, 17);
  assert.equal(g.phase, 'ready');
  g.startWave();
  tick(g, 100);
  assert.equal(g.phase, 'lost');
  assert.equal(g.health, 0);
  assert.equal(g.startWave(), false);
  assert.equal(g.build(0, 'pulse'), false);
});
test('第 5、10 波最後一隻是巨型殭屍', () => {
  for (const wave of [5, 10]) {
    const g = new Game();
    g.wave = wave - 1;
    g.startWave();
    while (g.spawnLeft > 0) g.spawn();
    assert.equal(g.enemies.at(-1).type, 'boss');
  }
});
test('10 波可以結束且 reset 完整復原', () => {
  const g = new Game();
  for (let wave = 1; wave <= 10; wave++) {
    assert.equal(g.startWave(), true);
    while (g.spawnLeft > 0) g.spawn();
    for (const e of g.enemies) g.damage(e, 100000);
    g.update(0.05);
    assert.equal(g.phase, wave === 10 ? 'won' : 'ready');
  }
  assert.equal(g.startWave(), false);
  assert.ok(g.kills > 200);
  g.reset();
  assert.equal(g.phase, 'ready');
  assert.equal(g.credits, 300);
  assert.equal(g.wave, 0);
  assert.equal(g.kills, 0);
  assert.deepEqual(g.enemies, []);
});
test('使用正常資源與武器規則可完成 10 波防守', () => {
  const g = new Game(),
    plan = [
      [0, 'pulse'],
      [1, 'cryo'],
      [7, 'plasma'],
      [4, 'pulse'],
      [3, 'plasma'],
      [5, 'pulse'],
      [2, 'pulse'],
      [6, 'plasma'],
    ];
  let steps = 0;
  while (!['won', 'lost'].includes(g.phase) && steps < 20000) {
    for (const [pad, type] of plan) {
      if (!g.towers.some((t) => t.pad === pad)) {
        g.build(pad, type);
        break;
      }
    }
    if (g.towers.length === 8) for (const t of g.towers) g.upgrade(t.id);
    if (g.phase === 'ready') g.startWave();
    g.update(0.05);
    const target = g.enemies.filter((e) => e.hp > 0).sort((a, b) => b.distance - a.distance)[0];
    if (target) g.fire(target);
    g.events = [];
    steps++;
  }
  assert.equal(g.phase, 'won');
  assert.equal(g.wave, 10);
  assert.equal(g.kills, 245);
  assert.ok(g.credits >= 0);
});
