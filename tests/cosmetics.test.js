import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { SKINS, TARGETS, defaults, normalizeCosmetics, validateCatalog } from '../src/cosmetics-core.js';
test('外觀偏好拒絕跨裝備 ID、未知 ID 與不相容資料版本',()=>{
  assert.deepEqual(normalizeCosmetics(null),defaults());
  assert.deepEqual(normalizeCosmetics({version:2,selected:{guard:'guard-polar'}}),defaults());
  const value=normalizeCosmetics({version:1,selected:{guard:'pulse-polar',pulse:'pulse-polar',plasma:'unknown',cryo:'cryo-original'}});
  assert.equal(value.guard,'guard-original');assert.equal(value.pulse,'pulse-polar');assert.equal(value.plasma,'plasma-original');
});
test('八項素材來源、檔案摘要、骨架動畫與槍口契約一致',()=>{
  assert.equal(SKINS.length,8);assert.equal(validateCatalog(SKINS),true);
  for(const skin of SKINS){
    const bytes=fs.readFileSync('public/'+skin.file);
    assert.equal(bytes.length,skin.bytes);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),skin.sha256);
    if(skin.variant!=='polar')continue;
    const gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));
    for(const name of skin.animations) assert.ok(gltf.animations.some(clip=>clip.name===name));
    if(skin.target!=='guard') for(const name of ['Grip','Muzzle'])assert.ok(gltf.nodes.some(node=>node.name===name));
    assert.ok(!['damage','range','heat','cooldown','collision'].some(key=>key in skin));
  }
  assert.ok(SKINS.filter(s=>s.variant==='polar').reduce((sum,s)=>sum+s.bytes,0)<2_000_000);
});
test('素材契約拒絕重複、缺省與越界路徑',()=>{
  assert.throws(()=>validateCatalog([...SKINS,SKINS[0]]));
  assert.throws(()=>validateCatalog(SKINS.filter(s=>s.target!=='guard')));
  assert.throws(()=>validateCatalog(SKINS.map((s,i)=>i?s:{...s,file:'models/../secret'})));
  assert.deepEqual(TARGETS,['guard','pulse','plasma','cryo']);
});
