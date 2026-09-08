const props=[['Container_Green',-5,-10,2.6,.15],['Container_Green',15,-7,2.4,-.4],['WaterTower',-18,7,5.5,0],['Barrel',-17,3,1.3,0],['Barrel',-18.2,3.6,1.3,0],['Barrel',10,9,1.3,0],['TrafficBarrier_1',-17,-8,1,0],['TrafficBarrier_1',1,8,1,1.57]];
const blockers=[{x:-5,z:-10,w:3.1,d:1.55},{x:15,z:-7,w:3,d:2},{x:-18,z:7,w:1.65,d:1.65},{x:18,z:4,w:1.7,d:1.7},{x:-17,z:3,w:.5,d:.5},{x:-18.2,z:3.6,w:.5,d:.5},{x:10,z:9,w:.5,d:.5},{x:-17,z:-8,w:1.1,d:.35},{x:1,z:8,w:.35,d:1.1}];
export const MAPS={
 'outpost-1':{id:'outpost-1',name:'能源前哨',path:[[-20,-5],[-11,-5],[-11,4],[-2,4],[-2,-5],[8,-5],[8,4],[18,4]],pads:[[-15,0],[-7,0],[-6,8],[2,0],[4,-9],[12,-1],[13,8],[-15,-9]],spawn:{x:4,z:9.5},core:[18,4],bounds:{x:21,z:11.6},blockers,props,newEnemies:false},
 'factory-2':{id:'factory-2',name:'冷卻工廠',path:[[-20,-5],[-11,-5],[-11,6],[8,6],[8,-5],[18,-5],[18,4]],pads:[[-15,0],[-7,0],[-6,10],[3,2],[4,-9],[12,-1],[13,8],[-15,-9]],spawn:{x:4,z:9.5},core:[18,4],bounds:{x:21,z:11.6},blockers:blockers.filter(b=>!(b.x===1&&b.z===8)),props:props.filter(p=>!(p[1]===1&&p[2]===8)),newEnemies:true},
};
for(const map of Object.values(MAPS)){
 map.waves=Array.from({length:10},(_,i)=>8+(i+1)*3);
 map.segments=map.path.slice(1).map((p,i)=>Math.hypot(p[0]-map.path[i][0],p[1]-map.path[i][1]));
 map.length=map.segments.reduce((a,b)=>a+b,0);
 map.maxKills=map.waves.reduce((a,b)=>a+b,0)+(map.newEnemies?4:0);
}
export function getMap(id='outpost-1'){if(!Object.hasOwn(MAPS,id))throw Error('未知地圖');return MAPS[id];}
export function pointOnMap(distance,map=getMap()){
 for(let i=0;i<map.segments.length;i++){
  if(distance<=map.segments[i]){const a=map.path[i],b=map.path[i+1],t=Math.max(0,distance/map.segments[i]);return{x:a[0]+(b[0]-a[0])*t,z:a[1]+(b[1]-a[1])*t,angle:Math.atan2(b[0]-a[0],b[1]-a[1])};}
  distance-=map.segments[i];
 }
 return {x:map.core[0],z:map.core[1],angle:0};
}
