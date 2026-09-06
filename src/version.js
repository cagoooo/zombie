export function isNewer(candidate, current) {
  if (!candidate?.id || !candidate?.version || candidate.id === current?.id) return false;
  if (!current?.version) return true;
  const a = candidate.version.split('.').map(Number),
    b = current.version.split('.').map(Number);
  if (a.length !== 3 || a.some((n) => !Number.isInteger(n))) return false;
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return Number(candidate.sequence) > Number(current.sequence);
}
