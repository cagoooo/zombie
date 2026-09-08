import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/game.js';
import {MAPS} from '../src/maps.js';
import {wavePreview} from '../src/waves.js';
import {checkpoint,restore} from '../src/save.js';
import {installPagePause} from '../src/lifecycle.js';
import {FixedStepper} from '../src/timing.js';

test('兩圖二十波情報逐一符合實際出生，Boss 援軍獨立標示',()=>{
 for(const map of Object.values(MAPS))for(let wave=1;wave<=10;wave++){
  const g=new Game(map.id);g.wave=wave;g.spawnLeft=map.waves[wave-1];const counts={};
  while(g.spawnLeft){g.spawn();const type=g.enemies.at(-1).type;counts[type]=(counts[type]||0)+1;}
  const info=wavePreview(map,wave);assert.deepEqual(info.counts,counts);assert.equal(info.total,g.enemies.length);
  assert.equal(info.reinforcements,map.newEnemies&&wave===10?4:0);
 }assert.equal(wavePreview(MAPS['outpost-1'],11),null);
});
test('扣血與破盾分計，裝甲減傷後統計，致命過量與重複命中不灌水',()=>{
 const g=new Game();const e={hp:30,shield:20,type:'armored',slow:0,reward:1};
 g.damage(e,15,0,true,'weapon:arc');assert.deepEqual(g.report.sources['weapon:arc'],{hp:5,shield:20,kills:0});
 g.damage(e,100,0,false,'tower:0:pulse');g.damage(e,100,0,false,'tower:0:pulse');
 assert.deepEqual(g.report.sources['tower:0:pulse'],{hp:25,shield:0,kills:1});assert.equal(g.kills,1);
});
test('實際武器、塔與 EMP 來源各自歸因',()=>{
 const g=new Game();g.build(0,'pulse');g.phase='wave';g.spawnLeft=1;g.spawnTimer=100;g.spawn('basic',5,false);g.update(.1);
 assert.ok(g.report.sources['tower:0:pulse']?.hp>0);
 g.player.x=-11;g.player.z=-2;g.enemies=[{id:999,type:'basic',x:-11,z:0,hp:100,slow:0,reward:0}];g.weapon='rail';g.fire({x:-11,z:4},true);
 assert.equal(g.report.sources['weapon:rail'].hp,95);g.useEMP();assert.equal(g.report.sources['skill:emp'].hp,5);assert.equal(g.report.sources['skill:emp'].kills,1);
});
test('核心損傷、護盾與修復只統計實際變化',()=>{
 const g=new Game();g.build(0,'shield');g.credits=1000;g.build(1,'repair');g.health=98;g.phase='wave';g.wave=1;g.spawnLeft=0;g.update(.01);
 assert.equal(g.report.supportRepair,2);assert.equal(g.report.baseRepair,0);
 g.health=10;g.shield=5;g.phase='wave';g.spawnLeft=1;g.spawnTimer=100;g.spawn('boss',g.map.length,false);g.update(.01);
 assert.equal(g.report.breaches,1);assert.equal(g.report.shieldAbsorbed,5);assert.equal(g.report.coreDamage,10);
});
test('統計存檔往返、舊存檔部分紀錄、非法來源與重開清空',()=>{
 const g=new Game();g.damage({hp:2,shield:0,slow:0,type:'basic',reward:0},20,0,false,'weapon:pulse');
 const raw=checkpoint(g);assert.deepEqual(restore(raw).report,g.report);
 const legacy=structuredClone(raw);delete legacy.report;assert.equal(restore(legacy).report.complete,false);
 const bad=structuredClone(raw);bad.report.sources['weapon:unknown']={hp:1,shield:0,kills:0};assert.throws(()=>restore(bad));
 const excess=structuredClone(raw);excess.report.sources['weapon:pulse'].kills=200;assert.throws(()=>restore(excess));
 g.reset();assert.equal(g.report.complete,true);assert.deepEqual(g.report.sources,{});
});
test('失焦、隱藏與 pagehide 共用暫停閘門，重複事件不覆蓋狀態，恢復不自動開火',()=>{
 const win=new EventTarget(),doc=new EventTarget();doc.hidden=false;
 let paused=false,shooting=true,cleared=0,pauses=0;
 const off=installPagePause(win,doc,{clearInput:()=>{shooting=false;cleared++;},shouldPause:()=>!paused,pause:()=>{paused=true;pauses++;}});
 win.dispatchEvent(new Event('blur'));doc.hidden=true;doc.dispatchEvent(new Event('visibilitychange'));win.dispatchEvent(new Event('pagehide'));
 assert.equal(pauses,1);assert.equal(cleared,3);assert.equal(shooting,false);
 doc.hidden=false;doc.dispatchEvent(new Event('visibilitychange'));assert.equal(paused,true);
 const stepper=new FixedStepper();let elapsed=0;stepper.advance(60,{paused:true},dt=>elapsed+=dt);assert.equal(elapsed,0);
 stepper.advance(1/60,{paused:false},dt=>elapsed+=dt);assert.ok(elapsed<.02);
 off();win.dispatchEvent(new Event('blur'));assert.equal(cleared,3);
});
