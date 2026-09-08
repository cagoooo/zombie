export function newReport(complete=true) {
 return {complete,sources:{},breaches:0,coreDamage:0,shieldAbsorbed:0,baseRepair:0,supportRepair:0};
}
export function recordDamage(report,source,hp,shield,kill) {
 if(!hp&&!shield&&!kill)return;
 const row=report.sources[source]??={hp:0,shield:0,kills:0};
 row.hp+=hp;row.shield+=shield;row.kills+=kill?1:0;
}
export function restoreReport(raw,kills,maxKills) {
 if(raw===undefined)return newReport(false);
 if(!raw||typeof raw.complete!=='boolean'||!raw.sources||typeof raw.sources!=='object'||Array.isArray(raw.sources))throw Error('戰況統計格式不合法');
 const result=newReport(raw.complete);
 for(const key of ['breaches','coreDamage','shieldAbsorbed','baseRepair','supportRepair']){
  const n=raw[key];if(!Number.isFinite(n)||n<0||n>1000000||(key==='breaches'&&(!Number.isInteger(n)||n>maxKills)))throw Error('戰況統計數值不合法');result[key]=n;
 }
 let totalKills=0;
 for(const [key,row]of Object.entries(raw.sources)){
  if(!/^(other|skill:emp|weapon:(pulse|plasma|cryo|arc|rail)|tower:[0-7]:(pulse|plasma|cryo|arc))$/.test(key)||!row)throw Error('戰況統計來源不合法');
  for(const k of ['hp','shield','kills'])if(!Number.isFinite(row[k])||row[k]<0||row[k]>10000000)throw Error('戰況統計數值不合法');
  if(!Number.isInteger(row.kills))throw Error('擊退統計不合法');
  totalKills+=row.kills;result.sources[key]={hp:row.hp,shield:row.shield,kills:row.kills};
 }
 if(totalKills>kills)throw Error('擊退統計超過戰局紀錄');
 return result;
}
