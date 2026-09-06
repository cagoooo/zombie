// Shared gameplay bounds; foliage/rubble are decorative and traversable.
export const BOUNDS = { x: 21, z: 11.6 };
export const BLOCKERS = [
  { x: -5, z: -10, w: 3.1, d: 1.55 },
  { x: 15, z: -7, w: 3, d: 2 },
  { x: -18, z: 7, w: 1.65, d: 1.65 },
  { x: 18, z: 4, w: 1.7, d: 1.7 },
  { x: -17, z: 3, w: 0.5, d: 0.5 },
  { x: -18.2, z: 3.6, w: 0.5, d: 0.5 },
  { x: 10, z: 9, w: 0.5, d: 0.5 },
  { x: -17, z: -8, w: 1.1, d: 0.35 },
  { x: 1, z: 8, w: 0.35, d: 1.1 },
];
export function obstacles(towers = []) {
  return [...BLOCKERS, ...towers.map((t) => ({ x: t.x, z: t.z, w: 0.8, d: 0.8 }))];
}
export function canStand(x, z, towers = []) {
  const r = 0.38;
  return (
    Number.isFinite(x) &&
    Number.isFinite(z) &&
    Math.abs(x) <= BOUNDS.x - r &&
    Math.abs(z) <= BOUNDS.z - r &&
    !obstacles(towers).some((b) => Math.abs(x - b.x) < b.w + r && Math.abs(z - b.z) < b.d + r)
  );
}
export function rayStop(from, to, towers = []) {
  let stop = 1;
  for (const b of obstacles(towers)) {
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
