import {getMap,pointOnMap} from './maps.js';
import { canStand, rayStop } from './world.js';
export const EMP = { radius: 8, damage: 45, slow: 2.5, cooldown: 45 };
export const TARGET_STRATEGIES = { first: '最前方', nearest: '最近', strongest: '最強' };
export const BRANCHES = {
  pulse: { rapid: { name:'高速', cooldown:.7, damage:.8 }, heavy: { name:'重擊', damage:1.5, cooldown:1.3 } },
  cryo: { lasting: { name:'長緩速', slow:3.5 }, wide: { name:'廣域', radius:2, damage:.8 } },
  plasma: { blast: { name:'大爆破', radius:4, cooldown:1.15 }, reach: { name:'遠射程', range:4 } },
  arc: { suppress: { name:'強抑制', slow:1.8, damage:.85 }, pierce: { name:'反裝甲', armored:1.8 } },
};
export function towerStats(t, level = t.level, branch = t.branch) {
  const def = TOWERS[t.type];
  if (def.support) return { damage:0,range:0,cooldown:0,rate:0,radius:0,slow:0,armored:1 };
  const b = level === 3 ? BRANCHES[t.type]?.[branch] ?? {} : {};
  const cooldown = def.cooldown / (1 + (level - 1) * 0.12) * (b.cooldown ?? 1);
  return { damage: def.damage * (1 + (level - 1) * 0.65) * (b.damage ?? 1),
    range: def.range + (level - 1) * 1.2 + (b.range ?? 0), cooldown, rate: 1 / cooldown,
    radius:b.radius ?? def.radius, slow:b.slow ?? def.slow, armored:b.armored ?? 1 };
}
export function towerTarget(t, enemies) {
  const range = towerStats(t).range;
  const distance = e => Math.hypot(e.x - t.x, e.z - t.z);
  return enemies.filter(e => e.hp > 0 && distance(e) < range).sort((a, b) => {
    const priority = t.strategy === 'nearest' ? distance(a) - distance(b)
      : t.strategy === 'strongest' ? b.hp - a.hp : 0;
    return priority || b.distance - a.distance || a.id - b.id;
  })[0];
}
export const PATH=getMap().path;
export const PADS=getMap().pads;
export const WEAPONS = {
 rail: { name:'磁軌狙擊槍',color:0x69d9ff,damage:95,cooldown:1.1,heat:32,radius:0,slow:0,range:30,pierce:true },
 arc: { name: '電弧抑制槍', color: 0xb66aff, damage: 32, cooldown: .45, heat: 18, radius: 1.8, slow: .8, range: 21, disrupt: true },
  pulse: {
    name: '脈衝步槍',
    color: 0xd8f36a,
    damage: 23,
    cooldown: 0.16,
    heat: 7,
    radius: 0,
    slow: 0,
    range: 26,
  },
  plasma: {
    name: '電漿重砲',
    color: 0xffa765,
    damage: 64,
    cooldown: 0.7,
    heat: 28,
    radius: 3.1,
    slow: 0,
    range: 23,
  },
  cryo: {
    name: '冰霜射線',
    color: 0x8fe6f3,
    damage: 10,
    cooldown: 0.12,
    heat: 5,
    radius: 0,
    slow: 2.3,
    range: 20,
  },
};
export const TOWERS = {
 shield: { name:'核心護盾站',cost:180,support:true,color:0x69bcff },
 repair: { name:'核心修復站',cost:200,support:true,color:0x73ed9b },
 arc: { name: '電弧干擾塔', cost: 150, damage: 18, cooldown: .85, range: 7.5, color: 0xb66aff, radius: 1.8, slow: .8, disrupt: true },
  pulse: {
    name: '脈衝哨塔',
    cost: 100,
    damage: 23,
    cooldown: 0.55,
    range: 8,
    color: 0xd8f36a,
    radius: 0,
    slow: 0,
  },
  cryo: {
    name: '冰凍稜鏡',
    cost: 125,
    damage: 9,
    cooldown: 0.45,
    range: 7,
    color: 0x8fe6f3,
    radius: 0,
    slow: 2,
  },
  plasma: {
    name: '電漿迫擊塔',
    cost: 175,
    damage: 52,
    cooldown: 1.6,
    range: 9,
    color: 0xffa765,
    radius: 2.8,
    slow: 0,
  },
};
export const PATH_LENGTH=getMap().length;
export function pathPoint(distance){return pointOnMap(distance);}
export class Game {
  constructor(mapId='outpost-1') {
    this.mapId=mapId; getMap(mapId);
    this.reset();
  }
  get map(){return getMap(this.mapId);}
  reset() {
    this.phase = 'ready';
    this.paused = false;
    this.wave = 0;
    this.health = 100;
    this.shield = 0;
    this.credits = 300;
    this.kills = 0;
    this.enemies = [];
    this.towers = [];
    this.events = [];
    this.weapon = 'pulse';
    this.heat = 0;
    this.overheated = false;
    this.cooldown = 0;
    this.empCooldown = 0;
    this.aimAssist = true;
    this.spawnLeft = 0;
    this.spawnTimer = 0;
    this.spawnIndex = 0;
    this.id = 0;
    this.time = 0;
    this.player = { ...this.map.spawn, angle: Math.PI, moving: false, sprinting: false };
    this.stepTime = 0;
  }
  move(x, z, dt, sprint = false) {
    this.player.moving = false;
    if (this.paused || ['won', 'lost'].includes(this.phase) || !Number.isFinite(x + z + dt)) return;
    const len = Math.hypot(x, z),
      speed = sprint ? 8 : 5.3;
    if (len < 0.05) return;
    const distance = Math.min(0.1, Math.max(0, dt)) * speed;
    const dx = (x / Math.max(1, len)) * distance,
      dz = (z / Math.max(1, len)) * distance;
    const oldX = this.player.x,
      oldZ = this.player.z;
    if (canStand(oldX + dx, oldZ, this.towers,this.map)) this.player.x += dx;
    if (canStand(this.player.x, oldZ + dz, this.towers,this.map)) this.player.z += dz;
    this.player.moving = Math.hypot(this.player.x - oldX, this.player.z - oldZ) > 0.001;
    this.player.sprinting = sprint;
    if (this.player.moving) {
      this.stepTime += dt;
      if (this.stepTime > (sprint ? 0.25 : 0.36)) {
        this.stepTime = 0;
        this.emit('step');
      }
    }
  }
  emit(type, data = {}) {
    this.events.push({ type, ...data });
  }
  startWave() {
    if (this.phase !== 'ready' || this.paused) return false;
    this.wave++;
    this.phase = 'wave';
    this.spawnLeft = this.map.waves[this.wave-1];
    this.spawnIndex = 0;
    this.spawnTimer = 0.3;
    this.emit('wave', { wave: this.wave });
    return true;
  }
  build(pad, type) {
    if (
      this.paused ||
      ['won', 'lost'].includes(this.phase) ||
      !TOWERS[type] ||
      !this.map.pads[pad] ||
      this.towers.some((t) => t.pad === pad)
    )
      return false;
    const def = TOWERS[type];
    if (Math.hypot(this.map.pads[pad][0] - this.player.x, this.map.pads[pad][1] - this.player.z) < 1.5) return false;
    if (this.credits < def.cost) return false;
    this.credits -= def.cost;
    const t = {
      id: ++this.id,
      pad,
      type,
      level: 1,
      strategy: 'first',
      spent: def.cost,
      cooldown: 0,
      x: this.map.pads[pad][0],
      z: this.map.pads[pad][1],
    };
    this.towers.push(t);
    this.recalculateShield(true);
    this.emit('build', { tower: t });
    return true;
  }
  upgradeCost(t) {
    return Math.round(TOWERS[t.type].cost * 0.7 * t.level);
  }
  get shieldMax() { return Math.min(40,this.towers.filter(t=>t.type==='shield').length*20); }
  get repairBonus() { return Math.min(8,this.towers.filter(t=>t.type==='repair').length*4); }
  recalculateShield(fill = false) {
    // Only deployment between waves charges newly built stations; combat rebuilding cannot refill.
    this.shield = fill && this.phase === 'ready' ? this.shieldMax : Math.min(this.shield,this.shieldMax);
  }
  setTowerStrategy(id, strategy) {
    const t = this.towers.find(t => t.id === id);
    if (!t || TOWERS[t.type].support || !Object.hasOwn(TARGET_STRATEGIES, strategy) || this.paused || ['won', 'lost'].includes(this.phase)) return false;
    t.strategy = strategy;
    return true;
  }
  upgrade(id, branch) {
    const t = this.towers.find((t) => t.id === id);
    if (!t || TOWERS[t.type].support || t.level >= 3 || this.paused || ['won', 'lost'].includes(this.phase)) return false;
    if (t.level === 2 && !Object.hasOwn(BRANCHES[t.type],branch)) return false;
    const cost = this.upgradeCost(t);
    if (this.credits < cost) return false;
    this.credits -= cost;
    t.spent += cost;
    t.level++;
    if (t.level === 3) t.branch = branch;
    this.emit('upgrade', { tower: t });
    return true;
  }
  sell(id) {
    const t = this.towers.find((t) => t.id === id);
    if (!t || this.paused || ['won', 'lost'].includes(this.phase)) return false;
    this.credits += Math.floor((t.spent * 70) / 100);
    this.towers = this.towers.filter((x) => x !== t);
    this.recalculateShield();
    this.emit('sell', { tower: t });
    return true;
  }
  switchWeapon(type) {
    if (!WEAPONS[type]) return false;
    this.weapon = type;
    return true;
  }
  spawn(override=null, distance=0, consume=true) {
    const i = this.spawnIndex++;
    const type = override ?? (
      this.wave % 5 === 0 && this.spawnLeft === 1
        ? 'boss'
        : this.map.newEnemies && this.wave >= 6 && i % 7 === 4 ? 'shielded'
        : this.map.newEnemies && this.wave >= 3 && i % 6 === 0 ? 'dasher'
        : this.wave >= 4 && i % 6 === 2 ? 'armored' : this.wave >= 3 && i % 5 === 3
          ? 'tank'
          : this.wave >= 2 && i % 3 === 1
            ? 'runner'
            : 'basic');
    const factor = 1 + (this.wave - 1) * 0.19;
    const hp = { dasher:70, shielded:90, armored: 110, basic: 64, runner: 44, tank: 190, boss: 1000 }[type] * factor;
    const enemy = {
      id: ++this.id,
      type,
      hp,
      maxHp: hp,
      speed: { dasher:1.8, shielded:1.25, armored: 1.2, basic: 1.55, runner: 2.65, tank: 1.1, boss: 0.9 }[type] * (1 + this.wave * 0.025),
      distance,
      shield:type==='shielded'?60*factor:0, maxShield:type==='shielded'?60*factor:0,
      dashState:0,dashTimer:0,phaseTwo:false,summonTimer:0,summoned:false,
      slow: 0,
      reward: { dasher:16, shielded:22, armored: 20, basic: 12, runner: 13, tank: 25, boss: 130 }[type],
      ...pointOnMap(distance,this.map),
    };
    this.enemies.push(enemy);
    if(consume)this.spawnLeft--;
    this.emit('spawn', { enemy });
  }
  damage(enemy, amount, slow = 0, disrupt = false) {
    if (enemy.hp <= 0) return;
    if(enemy.shield>0){
      const shieldDamage=amount*(disrupt?2:1),absorbed=Math.min(enemy.shield,shieldDamage);
      enemy.shield-=absorbed;amount=Math.max(0,amount-absorbed/(disrupt?2:1));
    }
    amount *= enemy.type === 'armored' && !disrupt ? .6 : 1;
    enemy.hp -= amount;
    enemy.slow = Math.max(enemy.slow, slow);
    this.emit('hit', { enemy, amount });
    if (enemy.hp <= 0) {
      this.kills++;
      this.credits += enemy.reward;
      this.emit('kill', { enemy });
    }
  }
  hit(target, def, multiplier = 1) {
    for (const e of this.enemies) {
      if (
        e.hp > 0 &&
        (e === target ||
          (def.radius > 0 && Math.hypot(e.x - target.x, e.z - target.z) <= def.radius && rayStop(target,e,this.towers,this.map)>=.999))
      )
        this.damage(e, def.damage * multiplier * (e.type === 'armored' ? def.armored ?? 1 : 1), def.slow, def.disrupt);
    }
  }
  fire(point, directional = false) {
    if (!point || !Number.isFinite(point.x + point.z)) return false;
    if (this.phase !== 'wave' || this.paused || this.cooldown > 0 || this.overheated) return false;
    const def = WEAPONS[this.weapon];
    directional = directional || !!def.pierce;
    const from = { x: this.player.x, z: this.player.z, y: 1.4 };
    const length = Math.hypot(point.x - from.x, point.z - from.z);
    const reach = Math.min(1, def.range / Math.max(length, 0.001));
    point = { x: from.x + (point.x - from.x) * reach, z: from.z + (point.z - from.z) * reach };
    this.player.angle = Math.atan2(point.x - from.x, point.z - from.z);
    const stop = rayStop(from, point, this.towers,this.map);
    const dx = Math.sin(this.player.angle), dz = Math.cos(this.player.angle);
    const forward = e => (e.x-from.x)*dx+(e.z-from.z)*dz;
    const aimDistance = e => directional ? Math.abs((e.x-from.x)*dz-(e.z-from.z)*dx) : Math.hypot(e.x-point.x,e.z-point.z);
    this.cooldown = def.cooldown;
    this.heat = Math.min(100, this.heat + def.heat);
    if (this.heat >= 100) {
      this.overheated = true;
      this.emit('overheat');
    }
    const target = this.enemies
      .filter(
        (e) =>
          e.hp > 0 &&
          Math.hypot(e.x - from.x, e.z - from.z) <= def.range &&
          rayStop(from, e, this.towers,this.map) >= 0.999 &&
          (!directional || forward(e) > 0) &&
          aimDistance(e) <
            (def.pierce ? .9 : this.aimAssist ? 2.2 : e.type === 'boss' ? 1.4 : 0.7),
      )
      .sort(
        (a, b) =>
          directional ? forward(a)-forward(b) : Math.hypot(a.x - point.x, a.z - point.z) - Math.hypot(b.x - point.x, b.z - point.z),
      )[0];
    let beamTarget = target;
    if (target && def.pierce) {
      const victims=this.enemies.filter(e=>e.hp>0 && forward(e)>0 && forward(e)<=def.range && Math.abs((e.x-from.x)*dz-(e.z-from.z)*dx)<.9 && rayStop(from,e,this.towers,this.map)>=.999).sort((a,b)=>forward(a)-forward(b)).slice(0,2);
      beamTarget = victims.at(-1) || target;
      victims.forEach((e,i)=>this.damage(e,def.damage*(i===0?1:.65)));
    } else if (target) this.hit(target, def);
    this.emit('shot', {
      from,
      to: beamTarget
        ? { x: beamTarget.x, z: beamTarget.z, y: 1.1 }
        : { x: from.x + (point.x - from.x) * stop, z: from.z + (point.z - from.z) * stop, y: 1.1 },
      weapon: this.weapon,
      hit: !!target,
    });
    return true;
  }
  useEMP() {
    if (this.phase !== 'wave' || this.paused || this.empCooldown > 0) return false;
    const targets = this.enemies.filter(e => e.hp > 0 && Math.hypot(e.x - this.player.x, e.z - this.player.z) <= EMP.radius);
    if (!targets.length) return false;
    this.empCooldown = EMP.cooldown;
    for (const e of targets) this.damage(e, EMP.damage * (e.type === 'boss' ? .5 : 1), e.type === 'boss' ? .8 : EMP.slow, true);
    this.emit('emp', { x: this.player.x, z: this.player.z, radius: EMP.radius, count: targets.length });
    return true;
  }
  update(dt) {
    if (this.paused || ['won', 'lost'].includes(this.phase)) return;
    dt = Math.max(0, Math.min(dt, 0.1));
    this.time += dt;
    this.heat = Math.max(0, this.heat - dt * 23);
    if (this.overheated && this.heat <= 22) this.overheated = false;
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.empCooldown = Math.max(0, this.empCooldown - dt);
    if (this.phase !== 'wave') return;
    this.spawnTimer -= dt;
    if (this.spawnLeft > 0 && this.spawnTimer <= 0) {
      this.spawn();
      this.spawnTimer = Math.max(0.4, 1.05 - this.wave * 0.045);
    }
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      e.slow = Math.max(0, e.slow - dt);
      if(e.type==='dasher'){
        if(e.dashState===0 && Math.hypot(e.x-this.player.x,e.z-this.player.z)<12){e.dashState=1;e.dashTimer=.8;this.emit('dash-warning');}
        if(e.dashState===1||e.dashState===2){
          if(e.slow>0){e.dashState=3;e.dashTimer=0;}
          else {e.dashTimer-=dt;if(e.dashTimer<=0){e.dashState++;e.dashTimer=1.2;}}
        }
      }
      if(this.map.newEnemies && this.wave===10 && e.type==='boss'){
        if(!e.phaseTwo && e.hp<=e.maxHp*.5){e.phaseTwo=true;e.summonTimer=1.2;this.emit('boss-phase');}
        if(e.phaseTwo&&!e.summoned){e.summonTimer-=dt;if(e.summonTimer<=0){e.summoned=true;for(let i=0;i<4;i++)this.spawn('dasher',Math.max(0,e.distance-3-i),false);}}
      }
      e.distance += e.speed * dt * (e.slow > 0 ? 0.42 : 1) * (e.dashState===2?2.5:1) * (e.phaseTwo?1.2:1);
      Object.assign(e, pointOnMap(e.distance,this.map));
      if (e.distance >= this.map.length) {
        e.hp = 0;
        const damage = { dasher:9,shielded:10,armored: 12, boss: 35, tank: 14, runner: 7, basic: 8 }[e.type];
        const absorbed = Math.min(this.shield,damage);
        this.shield -= absorbed;
        this.health = Math.max(0,this.health-damage+absorbed);
        this.emit('breach', { enemy: e });
      }
    }
    if (this.health <= 0) {
      this.phase = 'lost';
      this.emit('end', { won: false });
      return;
    }
    for (const t of this.towers) {
      if (TOWERS[t.type].support) continue;
      t.cooldown -= dt;
      if (t.cooldown > 0) continue;
      const def = TOWERS[t.type];
      const stats = towerStats(t);
      const target = towerTarget(t, this.enemies);
      if (target) {
        this.hit(target, { ...def, ...stats });
        t.cooldown = stats.cooldown;
        this.emit('shot', {
          from: { x: t.x, z: t.z, y: 2.2 },
          to: { x: target.x, z: target.z, y: 1 },
          weapon: t.type,
          hit: true,
          towerId: t.id,
        });
      }
    }
    this.enemies = this.enemies.filter((e) => e.hp > 0);
    if (this.spawnLeft === 0 && this.enemies.length === 0) {
      this.shield = this.shieldMax;
      this.health = Math.min(100,this.health + this.repairBonus);
      if (this.wave === 10) {
        this.phase = 'won';
        this.emit('end', { won: true });
      } else {
        this.phase = 'ready';
        const bonus = 65 + this.wave * 10;
        this.credits += bonus;
        this.health = Math.min(100, this.health + 5);
        this.emit('clear', { bonus });
      }
    }
  }
}
