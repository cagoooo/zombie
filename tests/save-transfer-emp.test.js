import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, EMP } from '../src/game.js';
import { checkpoint, restore } from '../src/save.js';
import { readSaveFile, writeSaveFile, MAX_SAVE_BYTES, setupSaveTransfer, BACKUP_KEY } from '../src/save-transfer.js';
import { SAVE_KEY } from '../src/save.js';

test('匯出匯入保留準備部署、策略與技能冷卻；支援舊版原始檢查點', () => {
  const g = new Game();g.build(0,'arc');g.setTowerStrategy(g.towers[0].id,'strongest');g.empCooldown=31.5;
  const copy=readSaveFile(writeSaveFile(g));
  assert.deepEqual(checkpoint(copy),checkpoint(g));
  const old=checkpoint(g);delete old.empCooldown;
  assert.equal(readSaveFile(JSON.stringify(old)).empCooldown,0);
  g.phase='wave';assert.throws(()=>writeSaveFile(g));
});
test('非法 JSON、超大檔、錯誤包裝／地圖／冷卻拒絕匯入', () => {
  for (const text of ['<html>bad</html>','null','[]',' '.repeat(MAX_SAVE_BYTES+1),JSON.stringify({format:'other',formatVersion:1}),JSON.stringify({format:'deadzone-save',formatVersion:99})]) assert.throws(()=>readSaveFile(text));
  for (const cooldown of [-1,46,null,'0']) {
    const data=checkpoint(new Game());data.empCooldown=cooldown;
    assert.throws(()=>restore(data));
  }
  const data=checkpoint(new Game());data.map='unknown';assert.throws(()=>readSaveFile(JSON.stringify(data)));
});
test('EMP 範圍、裝甲克制與 Boss 抗性符合規格；同敵人不重複獎勵', () => {
  const g=new Game();g.phase='wave';g.player.x=0;g.player.z=0;
  const e=(id,type,x,hp=100)=>({id,type,x,z:0,hp,slow:0,reward:10});
  g.enemies=[e(1,'armored',8),e(2,'boss',1),e(3,'basic',8.01),e(4,'basic',1,0),e(5,'basic',1,10)];
  assert.ok(g.useEMP());
  assert.equal(g.enemies[0].hp,55);assert.equal(g.enemies[0].slow,2.5);
  assert.equal(g.enemies[1].hp,77.5);assert.equal(g.enemies[1].slow,.8);
  assert.equal(g.enemies[2].hp,100);assert.equal(g.kills,1);
  assert.equal(g.credits,310);assert.equal(g.empCooldown,45);
  assert.equal(g.useEMP(),false);assert.equal(g.kills,1);
});
test('EMP 無目標不耗冷卻；準備／暫停／終局禁用；遊戲時間冷卻可存檔且重開歸零', () => {
  const g=new Game();assert.equal(g.useEMP(),false);
  g.phase='wave';assert.equal(g.useEMP(),false);assert.equal(g.empCooldown,0);
  g.empCooldown=EMP.cooldown;g.paused=true;g.update(.1);assert.equal(g.empCooldown,45);
  g.phase='ready';g.paused=false;g.update(.1);assert.equal(g.empCooldown,44.9);
  assert.equal(restore(checkpoint(g)).empCooldown,44.9);
  g.phase='lost';assert.equal(g.useEMP(),false);g.update(.1);assert.equal(g.empCooldown,44.9);
  g.reset();assert.equal(g.empCooldown,0);
});

test('匯入預覽取消、替換前備份與儲存失敗保留原戰局', async (t) => {
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id,{hidden:true,textContent:'',value:'',files:[]});
    return elements.get(id);
  };
  const storage = new Map(); let rejectWrites=false;
  for (const [key,value] of Object.entries({
    document:{getElementById:element},
    localStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>{if(rejectWrites)throw Error('儲存空間不足');storage.set(key,value);}},
  })) {
    const original=Object.getOwnPropertyDescriptor(globalThis,key);
    Object.defineProperty(globalThis,key,{configurable:true,value});
    t.after(()=>{if(original)Object.defineProperty(globalThis,key,original);else delete globalThis[key];});
  }
  let game=new Game(); const before=checkpoint(game);
  const next=new Game();next.credits=550;next.empCooldown=20;
  const ui=setupSaveTransfer({getGame:()=>game,applyGame:next=>{game=next;}});
  async function choose() {
    element('import-file').files=[{size:1000,text:async()=>writeSaveFile(next)}];
    await element('import-file').onchange();
  }
  await choose();assert.equal(element('import-preview').hidden,false);
  assert.deepEqual(checkpoint(game),before);
  element('cancel-import').onclick();assert.deepEqual(checkpoint(game),before);
  await choose();rejectWrites=true;element('confirm-import').onclick();
  assert.deepEqual(checkpoint(game),before);assert.equal(storage.has(SAVE_KEY),false);
  rejectWrites=false;element('confirm-import').onclick();
  assert.equal(game.credits,550);assert.equal(game.empCooldown,20);
  assert.deepEqual(JSON.parse(storage.get(BACKUP_KEY)),before);
  element('restore-import-backup').onclick();element('confirm-import').onclick();
  assert.deepEqual(checkpoint(game),before);
  let resolveFile;
  element('import-file').files=[{size:1000,text:()=>new Promise(resolve=>{resolveFile=resolve;})}];
  const reading=element('import-file').onchange();ui.cancel();resolveFile(writeSaveFile(next));await reading;
  assert.equal(element('import-preview').hidden,true);assert.deepEqual(checkpoint(game),before);
});
