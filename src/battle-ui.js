import {ENEMY_INFO,wavePreview} from './waves.js';
import {TOWERS,WEAPONS} from './game.js';
const $=id=>document.getElementById(id);
let previewKey='';
export function updateBattleInfo(game) {
 const boss=game.enemies.find(e=>e.type==='boss'&&e.hp>0);
 $('boss-hud').hidden=!boss||game.phase!=='wave';
 if(boss){
  const name=game.map.newEnemies&&game.wave===10?'裂核者':'巨型感染者';
  $('boss-name').textContent=name;
  $('boss-health').max=boss.maxHp;$('boss-health').value=Math.max(0,boss.hp);
  $('boss-health').setAttribute('aria-label',name+'生命');
  $('boss-hp').textContent=`${Math.ceil(Math.max(0,boss.hp))} / ${Math.ceil(boss.maxHp)}`;
  const stage=boss.phaseTwo?'第二階段':'第一階段';
  if($('boss-stage').textContent!==stage)$('boss-stage').textContent=stage;
  $('boss-countdown').textContent=boss.phaseTwo?(boss.summoned?'援軍已召喚，清除所有敵人才能獲勝':`援軍召喚倒數 ${Math.max(0,boss.summonTimer).toFixed(1)} 秒`):game.map.newEnemies&&game.wave===10?'半血後加速，並召喚四名援軍':'高生命目標，集中火力';
 }
 const key=game.mapId+'/'+game.wave;
 if(key!==previewKey){
  previewKey=key;const preview=wavePreview(game.map,game.wave+1);
  if(preview){
   $('intel-title').textContent=`第 ${preview.wave} 波情報 · ${preview.total} 名敵人${preview.counts.boss?' · Boss':''}`;
   $('intel-counts').textContent=Object.entries(preview.counts).map(([type,count])=>`${type==='boss'&&preview.reinforcements?'裂核者':ENEMY_INFO[type][0]} ×${count}`).join('、');
   $('intel-tips').textContent=Object.keys(preview.counts).filter(k=>k!=='basic').map(k=>ENEMY_INFO[k][1]).join('；')||ENEMY_INFO.basic[1];
   if(preview.reinforcements)$('intel-tips').textContent+='；半血後最多追加四名援軍（不含在上方數量）';
  }
 }
}
export function renderBattleReport(game,visible) {
 const root=$('battle-report');root.hidden=!visible;if(!visible)return;
 const r=game.report,fmt=n=>n.toLocaleString('zh-TW',{maximumFractionDigits:1});
 $('report-scope').textContent=r.complete?'本局累計；扣血與破盾分開計算，不含過量傷害。':'此存檔沒有完整歷史，以下僅統計載入後的戰鬥。';
 $('report-summary').textContent=`漏怪 ${r.breaches} · 核心實際損失 ${fmt(r.coreDamage)} · 護盾吸收 ${fmt(r.shieldAbsorbed)} · 基礎修復 ${fmt(r.baseRepair)} · 設施修復 ${fmt(r.supportRepair)}`;
 const body=$('report-rows');body.replaceChildren();
 const entries=Object.entries(r.sources).sort((a,b)=>(b[1].hp+b[1].shield)-(a[1].hp+a[1].shield));
 for(const [key,row]of entries){
  const [kind,id,type]=key.split(':');
  const label=kind==='tower'?`基座 ${Number(id)+1} ${TOWERS[type].name}`:kind==='weapon'?WEAPONS[id].name:kind==='skill'?'EMP':'其他';
  const tr=document.createElement('tr');
  for(const value of [label,fmt(row.hp),fmt(row.shield),String(row.kills)]){const td=document.createElement('td');td.textContent=value;tr.append(td);}body.append(tr);
 }
 $('report-empty').hidden=entries.length>0;
}
