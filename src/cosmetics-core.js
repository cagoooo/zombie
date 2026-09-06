import catalog from './skin-catalog.json' with { type: 'json' };
export const SKINS = catalog;
export const TARGETS = ['guard', 'pulse', 'plasma', 'cryo'];
export const COSMETICS_KEY = 'deadzone-cosmetics-v1';
export const defaults = () => Object.fromEntries(TARGETS.map(target => [target, target+'-original']));
export function normalizeCosmetics(value) {
  const result = defaults();
  if (!value || value.version !== 1 || !value.selected || typeof value.selected !== 'object') return result;
  for (const target of TARGETS) {
    if (SKINS.some(skin => skin.target === target && skin.id === value.selected[target])) result[target] = value.selected[target];
  }
  return result;
}
export function skinFor(target, id) {
  return SKINS.find(skin => skin.target === target && skin.id === id) || SKINS.find(skin => skin.id === target+'-original');
}
export function validateCatalog(entries) {
  const ids=new Set();
  for (const entry of entries) {
    if (!entry.id || ids.has(entry.id) || !TARGETS.includes(entry.target) || !entry.file?.startsWith('models/') || entry.file.includes('..') || !entry.author || !entry.license || !entry.source || !entry.bytes || !entry.grip || entry.up !== '+Y') throw Error('外觀素材規格不完整：'+entry.id);
    ids.add(entry.id);
  }
  for (const target of TARGETS) if (!ids.has(target+'-original')) throw Error('缺少預設外觀：'+target);
  return true;
}
