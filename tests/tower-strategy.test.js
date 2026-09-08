import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, TOWERS, towerTarget, towerStats } from '../src/game.js';
import { checkpoint, restore } from '../src/save.js';

test('三策略分別挑選前方、最近、最高現有生命；排除死亡及射程外', () => {
  const t = { type: 'pulse', level: 1, x: 0, z: 0 };
  const enemies = [
    {id:1, x:5,z:0,hp:20,distance:30},
    {id:2, x:1,z:0,hp:40,distance:10},
    {id:3, x:4,z:0,hp:100,distance:20},
    {id:4, x:0,z:0,hp:0,distance:60},
    {id:5, x:8,z:0,hp:500,distance:60},
  ];
  for (const [strategy, expected] of [['first',1],['nearest',2],['strongest',3]]) {
    t.strategy = strategy;
    assert.equal(towerTarget(t,enemies).id,expected);
  }
  enemies[2].hp = 10;
  assert.equal(towerTarget(t,enemies).id,2);
  assert.equal(towerTarget(t,[]),undefined);
  const tied = [{id:9,x:1,z:0,hp:40,distance:20},{id:8,x:1,z:0,hp:40,distance:20}];
  assert.equal(towerTarget(t,tied).id,8);
});

test('每座塔獨立策略；切換不花能源也不重置射擊冷卻，暫停與終局禁改', () => {
  const g = new Game(); g.build(0,'pulse');g.build(1,'cryo');
  const t = g.towers[0]; t.cooldown = .4;
  const credits = g.credits;
  assert.ok(g.setTowerStrategy(t.id,'nearest'));
  assert.equal(g.towers[1].strategy,'first');
  assert.equal(g.credits,credits);assert.equal(t.cooldown,.4);
  assert.equal(g.setTowerStrategy(t.id,'unknown'),false);
  assert.equal(g.setTowerStrategy(999,'first'),false);
  g.paused=true;assert.equal(g.setTowerStrategy(t.id,'first'),false);
  g.paused=false;g.phase='won';assert.equal(g.setTowerStrategy(t.id,'first'),false);
});

test('四種塔三級預覽與實際傷害、冷卻一致', () => {
  for (const type of Object.keys(TOWERS).filter(type=>!TOWERS[type].support)) for (const level of [1,2,3]) {
    const g = new Game();g.build(0,type); const t=g.towers[0];t.level=level;
    const e={id:99,type:'basic',hp:10000,reward:0,distance:5,speed:0,slow:0,x:-20,z:-5};
    g.enemies=[e];g.phase='wave';g.spawnLeft=0;
    const stats=towerStats(t);g.update(.01);
    assert.ok(Math.abs((10000-e.hp)-stats.damage)<1e-9);
    assert.equal(t.cooldown,stats.cooldown);
    assert.equal(stats.rate,1/stats.cooldown);
  }
});

test('舊存檔補最前方、新存檔保留策略；拒絕非法策略且升級出售金額不變', () => {
  const g = new Game();g.build(0,'pulse');const t=g.towers[0];
  g.setTowerStrategy(t.id,'strongest');g.upgrade(t.id);
  const saved=checkpoint(g), loaded=restore(saved);
  assert.equal(loaded.towers[0].strategy,'strongest');
  assert.equal(loaded.towers[0].level,2);
  assert.ok(loaded.sell(loaded.towers[0].id));assert.equal(loaded.credits,249);
  delete saved.towers[0].strategy;
  assert.equal(restore(saved).towers[0].strategy,'first');
  for (const strategy of [null,'bad','__proto__']) {
    saved.towers[0].strategy=strategy;assert.throws(()=>restore(saved));
  }
});

