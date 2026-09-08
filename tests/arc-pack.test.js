import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { Game, WEAPONS, TOWERS, PATH_LENGTH } from '../src/game.js';
import { checkpoint, restore } from '../src/save.js';

test('裝甲一般減傷四成；電弧武器與塔無視裝甲且施加減速', () => {
  for (const def of [WEAPONS.arc, TOWERS.arc]) {
    const g = new Game();
    const e = { id: 1, type: 'armored', hp: 200, slow: 0, x: -20, z: -5 };
    g.enemies = [e];
    g.damage(e, 50);
    assert.equal(e.hp, 170);
    g.hit(e, def);
    assert.equal(e.hp, 170 - def.damage);
    assert.equal(e.slow, .8);
  }
});

test('裝甲感染者第四波出現，抵達終點扣 12 血且不產生 NaN', () => {
  const g = new Game();
  g.wave = 4; g.phase = 'wave'; g.spawnLeft = 1; g.spawnIndex = 2;
  g.spawn();
  assert.equal(g.enemies[0].type, 'armored');
  assert.ok(Number.isFinite(g.enemies[0].hp + g.enemies[0].speed + g.enemies[0].reward));
  g.spawnLeft = 1; g.spawnTimer = 100;
  g.enemies[0].distance = PATH_LENGTH - .001;
  g.update(.05);
  assert.equal(g.health, 88);
});

test('電弧塔部署升級存檔還原與出售金額一致；電弧切換不繞過熱量冷卻', () => {
  const g = new Game();
  assert.ok(g.build(0, 'arc'));
  assert.ok(g.upgrade(g.towers[0].id));
  g.switchWeapon('arc');
  const loaded = restore(checkpoint(g));
  assert.equal(loaded.weapon, 'arc');
  assert.equal(loaded.towers[0].level, 2);
  assert.equal(loaded.towers[0].type, 'arc');
  assert.ok(loaded.sell(loaded.towers[0].id));
  assert.equal(loaded.credits, 223);
  g.startWave(); g.fire({ x: 0, z: 0 });
  const heat = g.heat;
  g.switchWeapon('pulse'); g.switchWeapon('arc');
  assert.equal(g.heat, heat);
  assert.equal(g.fire({ x: 0, z: 0 }), false);
});

test('MCP 三模型各自只含一場景，武器定位點與敵人動畫齊全', () => {
  const manifest = JSON.parse(fs.readFileSync('public/models/arc-pack/manifest.json', 'utf8'));
  for (const name of ['arc-rifle', 'arc-tower', 'armored-infected']) {
    const bytes = fs.readFileSync(`public/models/arc-pack/${name}.glb`);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), manifest.find(a => a.id === name).sha256);
    const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
    assert.equal(gltf.scenes.length, 1);
    assert.ok(bytes.length < 50000);
    if (name === 'arc-rifle') for (const marker of ['Grip', 'Muzzle']) assert.ok(gltf.nodes.some(n => n.name === marker));
    if (name === 'armored-infected') assert.equal(gltf.animations.length, 2);
  }
});
