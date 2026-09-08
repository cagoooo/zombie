import {restoreWaveHistory} from './wave-report.js';
import {restoreReport} from './battle-report.js';
import { Game, TOWERS, PADS, WEAPONS, TARGET_STRATEGIES, BRANCHES } from './game.js';
import { canStand } from './world.js';
import {MAPS,getMap} from './maps.js';
export const SAVE_KEY = 'deadzone-checkpoint-v1';
export const saveKey = mapId => mapId==='outpost-1'?SAVE_KEY:`${SAVE_KEY}-${mapId}`;
export function checkpoint(game) {
  if (game.phase !== 'ready') return null;
  return {
    version: 1,
    map: game.mapId,
    wave: game.wave,
    health: game.health,
    shield: game.shield,
    credits: game.credits,
    kills: game.kills,
    weapon: game.weapon,
    empCooldown: game.empCooldown,
    report: structuredClone(game.report),
    waveHistory: structuredClone(game.waveHistory),
    player: { x: game.player.x, z: game.player.z, angle: game.player.angle },
    towers: game.towers.map((t) => ({ pad: t.pad, type: t.type, level: t.level, spent: t.spent, strategy: t.strategy ?? 'first', ...(t.level === 3 ? {branch:t.branch ?? 'legacy'} : {}) })),
  };
}
export function restore(raw) {
  const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
  const integer = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
  if (
    !data ||
    data.version !== 1 ||
    !Object.hasOwn(MAPS,data.map) ||
    !integer(data.wave, 0, 9) ||
    !integer(data.health, 1, 100) ||
    !integer(data.credits, 0, 100000) ||
    !integer(data.kills, 0, getMap(data.map).maxKills) ||
    !Object.hasOwn(WEAPONS, data.weapon) ||
    (data.empCooldown !== undefined && (!Number.isFinite(data.empCooldown) || data.empCooldown < 0 || data.empCooldown > 45)) ||
    !Array.isArray(data.towers) ||
    data.towers.length > 8
  )
    throw Error('存檔版本或內容不相容');
  const game = new Game(data.map),
    pads = new Set();
  game.report = restoreReport(data.report,data.kills,getMap(data.map).maxKills);
  game.wave = data.wave;
  game.waveHistory=restoreWaveHistory(data.waveHistory,data.wave,getMap(data.map).maxKills,game.report);
  game.health = data.health;
  game.credits = data.credits;
  game.kills = data.kills;
  game.weapon = data.weapon;
  game.empCooldown = data.empCooldown ?? 0;
  for (const t of data.towers) {
    if (
      !t ||
      !integer(t.pad, 0, 7) ||
      pads.has(t.pad) ||
      !Object.hasOwn(TOWERS, t.type) ||
      !integer(t.level, 1, 3) ||
      (t.strategy !== undefined && !Object.hasOwn(TARGET_STRATEGIES, t.strategy))
    )
      throw Error('防禦塔存檔損毀');
    if (TOWERS[t.type].support && t.level !== 1) throw Error('支援設施不可升級');
    if (t.branch !== undefined && (t.level !== 3 || (t.branch !== 'legacy' && !Object.hasOwn(BRANCHES[t.type] ?? {},t.branch)))) throw Error('升級分支不相容');
    const cost = TOWERS[t.type].cost,
      spent =
        cost +
        Array.from({ length: t.level - 1 }, (_, i) => Math.round(cost * 0.7 * (i + 1))).reduce(
          (a, b) => a + b,
          0,
        );
    if (t.spent !== spent) throw Error('防禦塔投入數值不符');
    pads.add(t.pad);
    game.towers.push({ ...t, ...(t.level === 3 ? {branch:t.branch ?? 'legacy'} : {}), strategy: t.strategy ?? 'first', id: ++game.id, cooldown: 0, x: game.map.pads[t.pad][0], z: game.map.pads[t.pad][1] });
  }
  if (data.shield !== undefined && !integer(data.shield,0,game.shieldMax)) throw Error('護盾數值不合法');
  game.shield = data.shield ?? game.shieldMax;
  if (
    !data.player ||
    !canStand(data.player.x, data.player.z, game.towers,game.map) ||
    !Number.isFinite(data.player.angle)
  )
    throw Error('角色位置不合法');
  Object.assign(game.player, { x: data.player.x, z: data.player.z, angle: data.player.angle });
  return game;
}
