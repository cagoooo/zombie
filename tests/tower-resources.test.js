import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Battlefield } from '../src/scene.js';

test('連續重開與重建冰凍塔共用水晶幾何，不逐局累積 GPU 資源', () => {
  const view = Object.assign(Object.create(Battlefield.prototype), {
    scene: new THREE.Scene(), geometries: new Map(), materials: new Map(),
    towerMeshes: new Map(), enemyMeshes: new Map(), corpses: [], effects: [],
    padMeshes: [{ plus: { visible: true } }], rangeRing: { visible: false },
  });
  let crystal, count;
  for (let i = 0; i < 50; i++) {
    view.addTower({ id: 1, pad: 0, type: 'cryo', x: 0, z: 0 });
    const current = view.towerMeshes.get(1).head.children.find(n => n.geometry?.type === 'OctahedronGeometry');
    if (!crystal) { crystal = current.geometry; count = view.geometries.size; }
    assert.equal(current.geometry, crystal);
    assert.equal(view.geometries.size, count);
    view.reset();
    assert.equal(view.towerMeshes.size, 0);
    assert.equal(view.scene.children.length, 0);
  }
  for (const item of view.geometries.values()) item.dispose();
  for (const item of view.materials.values()) item.dispose();
});
