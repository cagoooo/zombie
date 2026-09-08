import {test} from 'node:test';import assert from 'node:assert/strict';
import {Game,BRANCHES} from '../src/game.js';import {MAPS,pointOnMap} from '../src/maps.js';import {canStand} from '../src/world.js';import {checkpoint,restore,saveKey} from '../src/save.js';
import fs from 'node:fs';import crypto from 'node:crypto';

test('四件 MCP 素材單場景、SHA256、動畫與磁軌握點／槍口契約',()=>{
 const root=new URL('../public/models/factory-pack/',import.meta.url);
 for(const item of JSON.parse(fs.readFileSync(new URL('manifest.json',root),'utf8'))){
  const b=fs.readFileSync(new URL(item.name+'.glb',root));const j=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)));
  assert.equal(j.scenes.length,1);assert.equal(b.length,item.bytes);assert.ok(b.length<150000);assert.ok(item.triangles<1500);
  assert.equal(crypto.createHash('sha256').update(b).digest('hex'),item.sha256);
  if(item.name==='rail-rifle'){assert.ok(j.nodes.some(n=>n.name==='Grip'));assert.ok(j.nodes.some(n=>n.name==='Muzzle'));}else assert.equal(j.animations.length,2);
 }
});

test('兩圖路線終點、基座、出生點與分圖檢查點一致；舊圖保留245上限',()=>{
 for(const map of Object.values(MAPS)){
  const end=pointOnMap(map.length,map);assert.deepEqual([end.x,end.z],map.core);assert.ok(canStand(map.spawn.x,map.spawn.z,[],map));
  const g=new Game(map.id);g.build(2,'pulse');const copy=restore(checkpoint(g));assert.equal(copy.mapId,map.id);assert.equal(copy.towers[0].z,map.pads[2][1]);
  g.reset();assert.equal(g.mapId,map.id);
 }
 assert.notEqual(saveKey('outpost-1'),saveKey('factory-2'));assert.equal(MAPS['outpost-1'].maxKills,245);assert.equal(MAPS['factory-2'].maxKills,249);
});
test('磁軌沿同射線僅傷最近兩敵，後者65%；側方、第三敵與障礙後方不命中',()=>{
 const g=new Game();g.phase='wave';g.weapon='rail';g.player.x=-11;g.player.z=-2;
 const enemy=(id,z,x=-11)=>({id,type:'basic',hp:200,x,z,slow:0,reward:0});g.enemies=[enemy(1,0),enemy(2,2),enemy(3,4),enemy(4,1,-8)];
 assert.ok(g.fire({x:-11,z:8},true));assert.deepEqual(g.enemies.map(e=>e.hp),[105,138.25,200,200]);
 g.cooldown=0;g.player.x=15;g.player.z=-11;g.enemies=[enemy(5,-3,15)];g.fire({x:15,z:0},true);assert.equal(g.enemies[0].hp,200);
});
test('護盾先吸收傷害，電弧剝盾倍增且溢出正確；減速可中止衝刺',()=>{
 const g=new Game('factory-2');g.wave=6;g.spawnLeft=1;g.spawn('shielded');const e=g.enemies[0];e.shield=60;const hp=e.hp;
 g.damage(e,20);assert.equal(e.shield,40);assert.equal(e.hp,hp);g.damage(e,30,1,true);assert.equal(e.shield,0);assert.equal(e.hp,hp-10);
 g.enemies=[];g.spawn('dasher',5,false);const d=g.enemies[0];g.player.x=d.x;g.player.z=d.z+2;g.phase='wave';g.spawnLeft=1;g.spawnTimer=100;
 g.update(.1);assert.equal(d.dashState,1);assert.ok(d.dashTimer>0);
 g.damage(d,0,2);g.update(.1);assert.equal(d.dashState,3);
});
test('裂核者半血預警後只召喚四援軍；援軍仍在時不得勝利',()=>{
 const g=new Game('factory-2');g.wave=10;g.phase='wave';g.spawnLeft=1;g.spawn('boss',5);const b=g.enemies[0];b.hp=b.maxHp*.5;
 g.update(.1);assert.ok(b.phaseTwo);assert.equal(g.enemies.length,1);
 for(let i=0;i<20;i++)g.update(.1);assert.equal(g.enemies.length,5);assert.ok(b.summoned);
 for(let i=0;i<20;i++)g.update(.1);assert.equal(g.enemies.length,5);
 g.damage(b,100000);g.update(.1);assert.equal(g.phase,'wave');for(const e of g.enemies)g.damage(e,100000);g.update(.1);assert.equal(g.phase,'won');
});
test('兩圖各兩套正常資源配置十波通關，無防守正常失敗',()=>{
 for(const map of Object.values(MAPS))for(const support of ['shield','repair']){
  const g=new Game(map.id);const plan=[[0,'pulse'],[1,'cryo'],[7,'plasma'],[4,'arc'],[3,'plasma'],[5,'pulse'],[2,support],[6,'plasma']];
  for(let step=0;step<30000&&!['won','lost'].includes(g.phase);step++){
   for(const [p,t] of plan)if(!g.towers.some(t=>t.pad===p)){g.build(p,t);break;}
   if(g.towers.length===8)for(const t of g.towers)g.upgrade(t.id,Object.keys(BRANCHES[t.type]??{})[0]);
   if(g.phase==='ready')g.startWave();g.update(.05);const e=g.enemies.filter(e=>e.hp>0).sort((a,b)=>b.distance-a.distance)[0];if(e)g.fire(e);g.useEMP();g.events=[];
  }
  assert.equal(g.phase,'won',map.id+'/'+support);assert.ok(g.kills<=map.maxKills);assert.ok(g.credits>=0);
 }
 const g=new Game('factory-2');for(let i=0;i<30000&&!['won','lost'].includes(g.phase);i++){if(g.phase==='ready')g.startWave();g.update(.1);g.events=[];}assert.equal(g.phase,'lost');
});


test('每種武器切換均保有可渲染瞄準幾何，磁軌不再中斷畫面',async()=>{
 const {Battlefield}=await import('../src/scene.js');const {WEAPONS}=await import('../src/game.js');const THREE=await import('three');
 const view={aimRing:{geometry:new THREE.RingGeometry(.5,.6,16)}};
 for(const type of Object.keys(WEAPONS)){Battlefield.prototype.setWeapon.call(view,type);assert.ok(view.aimRing.geometry?.isBufferGeometry,type);view.aimRing.geometry.computeBoundingSphere();assert.ok(Number.isFinite(view.aimRing.geometry.boundingSphere.radius));}
 for(const geometry of Object.values(view.aimShapes))geometry.dispose();
});
