import {getMap} from './maps.js';
export const BOUNDS=getMap().bounds;
export const BLOCKERS=getMap().blockers;
export function obstacles(towers = [], map=getMap()) {
  return [...map.blockers, ...towers.map((t) => ({ x: t.x, z: t.z, w: 0.8, d: 0.8 }))];
}
export function canStand(x, z, towers = [], map=getMap()) {
  const r = 0.38;
  return (
    Number.isFinite(x) &&
    Number.isFinite(z) &&
    Math.abs(x) <= map.bounds.x - r &&
    Math.abs(z) <= map.bounds.z - r &&
    !obstacles(towers,map).some((b) => Math.abs(x - b.x) < b.w + r && Math.abs(z - b.z) < b.d + r)
  );
}
export function rayStop(from, to, towers = [], map=getMap()) {
  let stop = 1;
  for (const b of obstacles(towers,map)) {
    let enter = 0,
      leave = 1;
    for (const [axis, r] of [
      ['x', b.w],
      ['z', b.d],
    ]) {
      const delta = to[axis] - from[axis],
        low = b[axis] - r,
        high = b[axis] + r;
      if (Math.abs(delta) < 1e-8) {
        if (from[axis] < low || from[axis] > high) {
          enter = 2;
          break;
        }
      } else {
        const t1 = (low - from[axis]) / delta,
          t2 = (high - from[axis]) / delta;
        enter = Math.max(enter, Math.min(t1, t2));
        leave = Math.min(leave, Math.max(t1, t2));
      }
    }
    if (enter <= leave && enter >= 0 && enter < stop) stop = enter;
  }
  return stop;
}
