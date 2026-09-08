export const ENEMY_INFO = {
 basic: ['普通感染者','優先守住彎道'], runner:['疾行感染者','移速快，搭配減速塔'],
 tank:['重型感染者','生命高，集中火力'], armored:['裝甲感染者','一般減傷 40%，電弧可穿甲'],
 dasher:['衝刺感染者','橘色預警後衝刺，冰凍／EMP 可中止'], shielded:['護盾感染者','電弧／EMP 加倍剝盾'], boss:['巨型感染者','高生命，保留主動技能'],
};
export function enemyTypeFor(map,wave,index,remaining=map.waves[wave-1]-index) {
 return wave%5===0 && remaining===1 ? 'boss'
 : map.newEnemies && wave>=6 && index%7===4 ? 'shielded'
 : map.newEnemies && wave>=3 && index%6===0 ? 'dasher'
 : wave>=4 && index%6===2 ? 'armored'
 : wave>=3 && index%5===3 ? 'tank'
 : wave>=2 && index%3===1 ? 'runner' : 'basic';
}
export function wavePreview(map,wave) {
 if(!Number.isInteger(wave)||wave<1||wave>map.waves.length)return null;
 const counts={};for(let i=0;i<map.waves[wave-1];i++){const type=enemyTypeFor(map,wave,i);counts[type]=(counts[type]||0)+1;}
 return {wave,total:map.waves[wave-1],counts,reinforcements:map.newEnemies&&wave===10?4:0};
}
