import { LoadingManager } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export const ASSETS = [
  ['arc-rifle', '電弧抑制槍', 'glb', 'arc-pack/arc-rifle'],
  ['arc-tower', '電弧干擾塔', 'glb', 'arc-pack/arc-tower'],
  ['armored-infected', '裝甲感染者', 'glb', 'arc-pack/armored-infected'],
  ['Zombie_Basic', '普通殭屍', 'gltf'],
  ['Zombie_Chubby', '重型殭屍', 'gltf'],
  ['Zombie_Ribcage', '快速殭屍', 'gltf'],
  ['Characters_Sam_SingleWeapon', '守衛角色', 'gltf'],
  ['Container_Green', '貨櫃', 'gltf'],
  ['Barrel', '油桶', 'gltf'],
  ['WaterTower', '水塔', 'gltf'],
  ['TrafficBarrier_1', '路障', 'gltf'],
  ['blaster-a', '脈衝步槍 MK2', 'glb', 'pulse-mk2'],
  ['blaster-j', '電漿重砲', 'glb'],
  ['blaster-o', '冰霜射線', 'glb'],
];

export class AssetLibrary {
  constructor() {
    this.models = {};
    this.failures = new Map();
    this.loading = false;
    this.attempt = 0;
  }

  async load(onProgress = () => {}, onlyId = null) {
    if (this.loading) return null;
    this.loading = true;
    this.attempt++;
    const pending = ASSETS.filter(([id]) => (!onlyId || id === onlyId) && !this.models[id]);
    let finished = 0;
    onProgress({ finished, total: pending.length, failures: [...this.failures.values()] });
    try {
      await Promise.all(
        pending.map(async ([id, label, ext, file = id]) => {
          const errors = new Set();
          const manager = new LoadingManager();
          manager.onError = (url) => errors.add(url);
          const loader = new GLTFLoader(manager);
          const url = `${import.meta.env.BASE_URL}models/${file}.${ext}`;
          try {
            const model = await loader.loadAsync(
              url + (this.attempt > 1 ? `?retry=${this.attempt}` : ''),
            );
            if (errors.size) throw new Error('模型依賴的貼圖載入失敗');
            this.models[id] = model;
            this.failures.delete(id);
          } catch (error) {
            this.failures.set(id, {
              id,
              label,
              files: errors.size ? [...errors] : [url],
              message: String(error.message || error),
            });
          } finally {
            finished++;
            onProgress({ finished, total: pending.length, failures: [...this.failures.values()] });
          }
        }),
      );
    } finally {
      this.loading = false;
    }
    return { models: this.models, failures: [...this.failures.values()] };
  }
}
