import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Game,BRANCHES,TOWERS,towerStats,PATH_LENGTH} from '../src/game.js';
import {checkpoint,restore} from '../src/save.js';
import fs from 'node:fs';
import crypto from 'node:crypto';

test('兩件 MCP 素材 SHA256、單場景、三角面與預算正確',()=>{
 const root=new URL('../public/models/support-pack/',import.meta.url);
 for(const asset of JSON.parse(fs.readFileSync(new URL('manifest.json',root),'utf8'))){
  const b=fs.readFileSync(new URL(asset.name+'.glb',root));
  assert.equal(crypto.createHash('sha256').update(b).digest('hex'),asset.sha256);
  const gltf=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString());
  assert.equal(gltf.scenes.length,1);assert.equal(b.length,asset.bytes);assert.ok(b.length<150000);
  const tris=gltf.meshes.flatMap(m=>m.primitives).reduce((n,p)=>n+gltf.accessors[p.indices].count/3,0);
  assert.equal(tris,asset.triangles);
 }
});

test('護盾吸收溢出、出售上限、戰鬥重建不回填，清波恢復',()=>{
 const g=new Game();g.credits=2000;g.build(0,'shield');g.build(1,'shield');g.build(2,'shield');
 assert.equal(g.shield,40);assert.equal(g.shieldMax,40);
 g.phase='wave';g.spawnLeft=1;g.spawnTimer=100;g.shield=5;
 g.enemies=[{id:99,type:'tank',hp:1,distance:PATH_LENGTH,speed:0,slow:0}];g.update(.01);
 assert.equal(g.health,91);assert.equal(g.shield,0);
 g.sell(g.towers[0].id);g.build(0,'shield');assert.equal(g.shield,0);
 g.spawnLeft=0;g.update(.01);assert.equal(g.shield,40);
 g.sell(g.towers[0].id);g.sell(g.towers[0].id);assert.equal(g.shield,20);
 g.reset();assert.equal(g.shield,0);
});
test('修復僅清波一次、額外上限8，支援不射擊不可升級或改策略',()=>{
 const g=new Game();g.credits=2000;
 for(const p of [0,1,2])g.build(p,'repair');
 assert.equal(g.repairBonus,8);assert.equal(g.upgrade(g.towers[0].id),false);
 assert.equal(g.setTowerStrategy(g.towers[0].id,'strongest'),false);
 g.health=50;g.phase='wave';g.spawnLeft=0;g.update(.01);assert.equal(g.health,63);
 g.update(.1);assert.equal(g.health,63);
 g.phase='wave';g.health=99;g.update(.01);assert.equal(g.health,100);
});
test('八條分支要求明選，費用與預覽共用，鎖定後不能免費換分支',()=>{
 for(const [type,branches] of Object.entries(BRANCHES))for(const branch of Object.keys(branches)){
   const g=new Game();g.credits=2000;g.build(0,type);const t=g.towers[0];g.upgrade(t.id);
   assert.equal(g.upgrade(t.id),false);assert.equal(g.upgrade(t.id,'legacy'),false);
   const preview=towerStats(t,3,branch),cost=g.upgradeCost(t),credits=g.credits;
   assert.ok(g.upgrade(t.id,branch));assert.equal(g.credits,credits-cost);assert.deepEqual(towerStats(t),preview);
   assert.equal(g.upgrade(t.id,branch),false);assert.equal(restore(checkpoint(g)).towers[0].branch,branch);
   const s=towerStats(t);g.phase='wave';g.spawnLeft=1;g.spawnTimer=100;
   const enemy={id:999,type:'armored',hp:10000,reward:0,distance:5,speed:0,slow:0,x:-15,z:-5};g.enemies=[enemy];g.update(.01);
   assert.ok(Math.abs(10000-enemy.hp-s.damage*s.armored*(TOWERS[type].disrupt?1:.6))<1e-8);
   assert.equal(enemy.slow,s.slow);assert.equal(t.cooldown,s.cooldown);
 }
});
test('舊Lv3保留標準能力，拒絕非法分支與護盾，存檔不補滿消耗護盾',()=>{
 const g=new Game();g.credits=2000;g.build(0,'pulse');const t=g.towers[0];g.upgrade(t.id);g.upgrade(t.id,'heavy');
 const old=checkpoint(g);delete old.towers[0].branch;delete old.shield;
 const legacy=restore(old);assert.equal(legacy.towers[0].branch,'legacy');assert.equal(towerStats(legacy.towers[0]).damage,23*2.3);
 g.build(1,'shield');g.shield=7;assert.equal(restore(checkpoint(g)).shield,7);
 const invalid=checkpoint(g);invalid.shield=41;assert.throws(()=>restore(invalid));
 const invalidBranch=checkpoint(g);invalidBranch.towers[0].branch='wide';assert.throws(()=>restore(invalidBranch));
});
test('兩套含支援站與分支的正常資源配置十波可通關；純支援無射擊會失敗',()=>{
 for(const support of ['shield','repair']){
  const g=new Game();const plan=[[0,'pulse'],[1,'cryo'],[7,'plasma'],[4,'arc'],[3,'plasma'],[5,'pulse'],[2,support],[6,'plasma']];
  for(let step=0;step<25000&&!['won','lost'].includes(g.phase);step++){
   for(const [pad,type] of plan)if(!g.towers.some(t=>t.pad===pad)){g.build(pad,type);break;}
   if(g.towers.length===8)for(const t of g.towers)g.upgrade(t.id,Object.keys(BRANCHES[t.type]??{})[0]);
   if(g.phase==='ready')g.startWave();g.update(.05);
   const e=g.enemies.filter(e=>e.hp>0).sort((a,b)=>b.distance-a.distance)[0];if(e)g.fire(e);g.useEMP();g.events=[];
  }
  assert.equal(g.phase,'won',support);assert.ok(g.towers.some(t=>t.type===support));assert.ok(g.credits>=0);
 }
 const g=new Game();g.build(0,'shield');
 for(let step=0;step<25000&&!['lost','won'].includes(g.phase);step++){if(g.phase==='ready')g.startWave();g.update(.1);g.events=[];}
 assert.equal(g.phase,'lost');
});
