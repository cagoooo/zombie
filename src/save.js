import { Game, TOWERS, PADS, WEAPONS, TARGET_STRATEGIES } from './game.js';
import { canStand } from './world.js';
export const SAVE_KEY = 'deadzone-checkpoint-v1';
export function checkpoint(game) {
  if (game.phase !== 'ready') return null;
  return {
    version: 1,
    map: 'outpost-1',
    wave: game.wave,
    health: game.health,
    credits: game.credits,
    kills: game.kills,
    weapon: game.weapon,
    empCooldown: game.empCooldown,
    player: { x: game.player.x, z: game.player.z, angle: game.player.angle },
    towers: game.towers.map((t) => ({ pad: t.pad, type: t.type, level: t.level, spent: t.spent, strategy: t.strategy ?? 'first' })),
  };
}
export function restore(raw) {
  const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
  const integer = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
  if (
    !data ||
    data.version !== 1 ||
    data.map !== 'outpost-1' ||
    !integer(data.wave, 0, 9) ||
    !integer(data.health, 1, 100) ||
    !integer(data.credits, 0, 100000) ||
    !integer(data.kills, 0, 245) ||
    !Object.hasOwn(WEAPONS, data.weapon) ||
    (data.empCooldown !== undefined && (!Number.isFinite(data.empCooldown) || data.empCooldown < 0 || data.empCooldown > 45)) ||
    !Array.isArray(data.towers) ||
    data.towers.length > 8
  )
    throw Error('存檔版本或內容不相容');
  const game = new Game(),
    pads = new Set();
  game.wave = data.wave;
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
    const cost = TOWERS[t.type].cost,
      spent =
        cost +
        Array.from({ length: t.level - 1 }, (_, i) => Math.round(cost * 0.7 * (i + 1))).reduce(
          (a, b) => a + b,
          0,
        );
    if (t.spent !== spent) throw Error('防禦塔投入數值不符');
    pads.add(t.pad);
    game.towers.push({ ...t, strategy: t.strategy ?? 'first', id: ++game.id, cooldown: 0, x: PADS[t.pad][0], z: PADS[t.pad][1] });
  }
  if (
    !data.player ||
    !canStand(data.player.x, data.player.z, game.towers) ||
    !Number.isFinite(data.player.angle)
  )
    throw Error('角色位置不合法');
  Object.assign(game.player, { x: data.player.x, z: data.player.z, angle: data.player.angle });
  return game;
}
