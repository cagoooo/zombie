import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { SKINS, validateCatalog } from './cosmetics-core.js';

export class CosmeticAssets {
  constructor(view) {
    validateCatalog(SKINS);
    this.view = view;
    this.cache = new Map();
    this.pending = new Map();
    this.attempts = new Map();
  }
  async load(skin) {
    if (skin.asset) {
      const source = this.view.models[skin.asset];
      if (!source) throw Error('原始模型尚未載入，請先回戰場重試素材。');
      return source;
    }
    if (this.cache.has(skin.id)) return this.cache.get(skin.id);
    if (this.pending.has(skin.id)) return this.pending.get(skin.id);
    const attempt = (this.attempts.get(skin.id) || 0) + 1;
    this.attempts.set(skin.id, attempt);
    const url = new URL(skin.file, document.baseURI);
    if (attempt > 1) url.searchParams.set('retry', attempt);
    const promise = new GLTFLoader().loadAsync(url.href).then(source => {
      for (const name of skin.animations) {
        if (!source.animations.some(clip => clip.name === name)) throw Error('外觀缺少必要動畫：'+name);
      }
      if (skin.target !== 'guard' && (!source.scene.getObjectByName('Muzzle') || !source.scene.getObjectByName('Grip'))) throw Error('外觀缺少持握／槍口定位');
      this.cache.set(skin.id, source);
      return source;
    }).finally(() => this.pending.delete(skin.id));
    this.pending.set(skin.id, promise);
    return promise;
  }
}
