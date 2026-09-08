import {getMap} from './maps.js';
import * as THREE from 'three';
import { AssetLibrary } from './assets.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PATH, PADS, TOWERS, WEAPONS, BRANCHES, towerStats } from './game.js';

const palette = {
  ground: 0x3b4935,
  road: 0x616650,
  edge: 0x777e5d,
  metal: 0x404c42,
  dark: 0x232d29,
  lime: 0xd8f36a,
};
export class Battlefield {
  constructor(canvas,map=getMap()) {
    this.map=map;
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x26362e);
    this.scene.fog = new THREE.FogExp2(0x26362e, 0.011);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    this.camera = new THREE.OrthographicCamera(-25, 25, 18, -18, 0.1, 160);
    this.camera.position.set(24, 34, 37);
    this.camera.lookAt(0, 0, 0);
    this.scene.add(new THREE.HemisphereLight(0xdfefd4, 0x364333, 2.1));
    const sun = new THREE.DirectionalLight(0xffebc4, 3.1);
    this.sun = sun;
    this.overview = false;
    this.follow = new THREE.Vector3(4, 0, 9.5);
    this.quality = 'medium';
    this.effectLimit = 70;
    sun.position.set(-14, 28, -10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, {
      left: -32,
      right: 32,
      top: 25,
      bottom: -25,
      near: 1,
      far: 90,
    });
    sun.shadow.normalBias = 0.035;
    this.scene.add(sun);
    this.assets = new AssetLibrary();
    this.assetProps = new THREE.Group();
    this.scene.add(this.assetProps);
    this.models = {};
    this.enemyMeshes = new Map();
    this.towerMeshes = new Map();
    this.effects = [];
    this.effectPool = new Map();
    this.corpses = [];
    this.recoil = 0;
    this.reducedMotion = false;
    this.padMeshes = [];
    this.materials = new Map();
    this.geometries = new Map();
    this.raycaster = new THREE.Raycaster();
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.pointer = new THREE.Vector2();
    this.aim = { x: 0, z: 0 };
    this.ready = false;
    this.buildWorld();
    this.batchWorld();
    new ResizeObserver(() => this.resize()).observe(canvas.parentElement);
    this.resize();
  }
  mat(color, glow = false) {
    const key = `${color}/${glow}`;
    if (!this.materials.has(key))
      this.materials.set(
        key,
        new THREE.MeshStandardMaterial({
          color,
          roughness: 0.8,
          metalness: 0.12,
          emissive: glow ? color : 0,
          emissiveIntensity: glow ? 1.5 : 0,
        }),
      );
    return this.materials.get(key);
  }
  box(w, h, d, color, x = 0, y = 0, z = 0, parent = this.scene, glow = false) {
    const key = `b${w}/${h}/${d}`;
    if (!this.geometries.has(key)) this.geometries.set(key, new THREE.BoxGeometry(w, h, d));
    const m = new THREE.Mesh(this.geometries.get(key), this.mat(color, glow));
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  cylinder(r, h, color, x, y, z, parent = this.scene, r2 = r, sides = 8) {
    const key = `c${r}/${r2}/${h}/${sides}`;
    if (!this.geometries.has(key))
      this.geometries.set(key, new THREE.CylinderGeometry(r, r2, h, sides));
    const m = new THREE.Mesh(this.geometries.get(key), this.mat(color));
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  ring(radius, color, x, z, y = 0.1) {
    const geometry = new THREE.RingGeometry(radius - 0.035, radius, 64);
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, y, z);
    this.scene.add(mesh);
    return mesh;
  }
  buildWorld() {
    this.box(45, 1.6, 28, palette.dark, 0, -1, 0);
    this.box(44, 0.35, 27, this.map.newEnemies ? 0x344953 : palette.ground, 0, -0.1, 0);
    const grid = new THREE.GridHelper(44, 22, 0x718160, 0x607050);
    grid.material.transparent = true;
    grid.material.opacity = 0.13;
    grid.position.y = 0.085;
    grid.scale.z = 27 / 44;
    this.scene.add(grid);
    for (let i = 0; i < this.map.path.length - 1; i++) {
      const a = this.map.path[i],
        b = this.map.path[i + 1],
        dx = b[0] - a[0],
        dz = b[1] - a[1];
      const x = (a[0] + b[0]) / 2,
        z = (a[1] + b[1]) / 2;
      this.box(Math.abs(dx) + 2.8, 0.14, Math.abs(dz) + 2.8, palette.road, x, 0.05, z);
      for (let s = -1; s <= 1; s += 2) {
        if (dx) this.box(Math.abs(dx) + 2.7, 0.18, 0.12, palette.edge, x, 0.06, z + s * 1.4);
        else this.box(0.12, 0.18, Math.abs(dz) + 2.7, palette.edge, x + s * 1.4, 0.06, z);
      }
      const len = Math.hypot(dx, dz);
      for (let n = 1; n < len; n += 2.5)
        this.box(
          dx ? 0.65 : 0.1,
          0.025,
          dz ? 0.65 : 0.1,
          0x9a9e78,
          a[0] + (dx * n) / len,
          0.14,
          a[1] + (dz * n) / len,
        );
    }
    for (let i = 0; i < 8; i++) {
      const [x, z] = this.map.pads[i];
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      this.scene.add(g);
      this.cylinder(1.2, 0.22, 0x303d32, 0, 0.19, 0, g, 1.3);
      this.cylinder(1.03, 0.08, 0x637153, 0, 0.34, 0, g);
      const plus = new THREE.Group();
      this.box(0.85, 0.03, 0.14, palette.lime, 0, 0.41, 0, plus, true);
      this.box(0.14, 0.03, 0.85, palette.lime, 0, 0.41, 0, plus, true);
      g.add(plus);
      const ring = this.ring(1.4, palette.lime, x, z, 0.15);
      this.padMeshes.push({ group: g, plus, ring });
    }
    // Hand-built energy core, replaceable with any glTF base skin.
    this.core = new THREE.Group();
    this.core.position.set(this.map.core[0], 0, this.map.core[1]);
    this.scene.add(this.core);
    this.cylinder(2.5, 0.55, 0x283b34, 0, 0.3, 0, this.core, 2.8, 6);
    this.cylinder(1.8, 0.3, 0x7e8a66, 0, 0.7, 0, this.core, 2.1, 6);
    this.cylinder(1.1, 3.1, 0x233d35, 0, 2.2, 0, this.core, 1.25, 6);
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3;
      this.box(
        0.28,
        2.7,
        0.28,
        palette.lime,
        Math.sin(angle) * 1.02,
        2.3,
        Math.cos(angle) * 1.02,
        this.core,
        true,
      );
    }
    this.cylinder(1.55, 0.25, 0x899575, 0, 3.85, 0, this.core, 1.5, 6);
    this.cylinder(0.65, 0.3, palette.lime, 0, 4.05, 0, this.core, 0.8, 6);
    this.coreRing = this.ring(3.1, palette.lime, ...this.map.core);
    this.scene.add(new THREE.PointLight(0xd8f36a, 14, 10));
    const portal = new THREE.Group();
    portal.position.set(-20, 0, -5);
    this.scene.add(portal);
    for (const z of [-1.8, 1.8]) {
      this.box(0.9, 3, 0.8, 0x333b32, 0, 1.5, z, portal);
      this.box(0.12, 2.3, 0.86, 0xf47c52, 0.5, 1.5, z, portal, true);
    }
    this.box(0.85, 0.65, 4.1, 0x454d3f, 0, 3.1, 0, portal);
    // Deterministic rubble and foliage: keeps the route and build positions clear.
    let seed = 91;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let i = 0; i < 130; i++) {
      const x = random() * 42 - 21,
        z = random() * 25 - 12.5;
      const nearPath = this.map.path.slice(1).some((b, j) => {
        const a = this.map.path[j];
        return (
          x >= Math.min(a[0], b[0]) - 2.1 &&
          x <= Math.max(a[0], b[0]) + 2.1 &&
          z >= Math.min(a[1], b[1]) - 2.1 &&
          z <= Math.max(a[1], b[1]) + 2.1
        );
      });
      if (
        nearPath ||
        this.map.pads.some((p) => Math.hypot(p[0] - x, p[1] - z) < 2) ||
        Math.hypot(x - 18, z - 4) < 4
      )
        continue;
      const r = 0.15 + random() * 0.6;
      const rock = this.cylinder(
        r,
        0.25 + random() * 0.6,
        random() > 0.5 ? 0x637151 : 0x4a5c43,
        x,
        0.25,
        z,
        this.scene,
        r * 1.25,
        5,
      );
      rock.rotation.y = random() * 6;
    }
    for (const [x, z, h] of [
      [-19, 9, 4],
      [-10, -12, 3],
      [-2, -12, 5],
      [16, -10, 4],
      [20, 10, 3],
    ]) {
      this.cylinder(0.14, h, 0x39382b, x, h / 2, z);
      for (let j = 0; j < 3; j++)
        this.cylinder(0.06, 1.6, 0x43543b, x, h - j * 0.8, z, this.scene, 1.5 - j * 0.18, 5);
    }
    for (let i = 0; i < 9; i++) {
      this.box(2.4, 0.85, 0.6, 0x626c50, -19 + i * 4.7, 0.4, 12.4);
      this.box(2.4, 0.14, 0.63, 0xa6a573, -19 + i * 4.7, 0.84, 12.4);
    }
    for (const [x, z] of [
      [-17, -11],
      [9, 10],
      [18, -8],
    ]) {
      this.box(0.18, 4, 0.18, 0x4c5843, x, 2, z);
      this.box(1.5, 0.17, 0.18, 0x758363, x + 0.6, 4, z);
      this.box(0.55, 0.08, 0.35, 0xf5eb9c, x + 1.1, 3.88, z, this.scene, true);
    }
    this.player = new THREE.Group();
    this.player.position.set(4, 0, 11);
    this.scene.add(this.player);
    this.fallbackActor = new THREE.Group();
    this.player.add(this.fallbackActor);
    this.box(0.5, 0.8, 0.3, 0x6d8262, 0, 0.9, 0, this.fallbackActor);
    this.box(0.36, 0.36, 0.36, 0xd8f36a, 0, 1.5, 0, this.fallbackActor);
    for (const x of [-0.17, 0.17])
      this.box(0.18, 0.6, 0.2, 0x37483d, x, 0.3, 0, this.fallbackActor);
    this.playerGun = new THREE.Group();
    this.playerGun.position.y = 1.65;
    this.player.add(this.playerGun);
    this.box(0.65, 0.5, 1.7, 0x9bab86, 0, 0, 0.5, this.playerGun);
    this.box(0.22, 0.2, 1.2, palette.lime, 0, 0, 1.4, this.playerGun, true);
    this.aimRing = this.ring(0.7, palette.lime, 0, 0, 0.2);
    this.aimRing.visible = false;
    this.rangeRing = this.ring(8, palette.lime, 0, 0, 0.2);
    this.rangeRing.visible = false;
    // Static preview patrol is replaced as soon as the first wave starts.
    this.preview = new THREE.Group();
    this.scene.add(this.preview);
  }
  async loadAssets(onProgress, onlyId = null) {
    const result = await this.assets.load(onProgress, onlyId);
    if (!result) return this.assetErrors || [];
    this.models = result.models;
    this.assetErrors = result.failures.flatMap((f) => f.files);
    this.assetProps.clear();
    for (const [name, x, z, height, rotation] of this.map.props) {      const model = this.makeAsset(name, height);
      if (model) {
        model.root.position.set(x, 0, z);
        model.root.rotation.y = rotation;
        this.assetProps.add(model.root);
      }
    }
    for (const skin of Object.values(this.weaponSkins || {})) {
      this.playerGun.remove(skin);
      skin.traverse((m) => {
        if (m.isMesh) m.material.dispose();
      });
    }
    this.baseGunParts ??= [...this.playerGun.children];
    this.weaponSkins = {};
    this.appearanceIds = {};
    for (const [type, name] of [
      ['pulse', 'blaster-a'],
      ['plasma', 'blaster-j'],
      ['cryo', 'blaster-o'],
      ['arc', 'arc-rifle'],
      ['rail','rail-rifle'],
    ]) {
      const source = this.models[name];
      if (!source) continue;
      this.replaceWeaponAppearance(type, source);
      this.renderWeaponPreview(type, source.scene);
    }
    this.setWeapon(this.activeWeapon || 'pulse');
    this.ready = this.assetErrors.length === 0;
    this.createActor();
    return this.assetErrors;
  }
  createActor(source = this.models.Characters_Sam_SingleWeapon, replace = false) {
    if ((!replace && this.actor) || !source) return;
    if (this.actor) {
      this.actor.mixer.stopAllAction();
      this.actor.mixer.uncacheRoot(this.actor.object);
      this.actor.object.traverse(n => { if (n.isSkinnedMesh) n.skeleton.dispose(); });
      this.player.remove(this.actor.root);
    }
    this.actor = this.makeAsset('Characters_Sam_SingleWeapon', 1.9, source);
    this.actor.object.traverse((n) => {
      if (n.name === 'Pistol') n.visible = false;
    });
    this.actor.mixer = new THREE.AnimationMixer(this.actor.object);
    this.player.add(this.actor.root);
    this.fallbackActor.visible = false;
    this.actor.actions = {};
    for (const name of ['Idle_Gun', 'Walk_Gun', 'Run_Gun']) {
      const clip = THREE.AnimationClip.findByName(this.actor.animations, name);
      if (clip) this.actor.actions[name] = this.actor.mixer.clipAction(clip);
    }
    this.actor.mode = '';
    // GLTFLoader sanitizes dots in node names for animation property bindings.
    this.actor.grip = this.actor.object.getObjectByName('Middle1L') || this.actor.object.getObjectByName('Middle1.L');
    this.playerGun.scale.setScalar(0.65);
  }
  replaceWeaponAppearance(type, source) {
    const previous = this.weaponSkins?.[type];
    if (previous) {
      this.playerGun.remove(previous);
      previous.traverse(n => { if (n.isMesh) n.material.dispose(); });
    }
    const skin = clone(source.scene);
    const size = new THREE.Box3().setFromObject(skin).getSize(new THREE.Vector3());
    skin.scale.setScalar(2.3 / Math.max(size.x, size.y, size.z));
    skin.traverse(n => {
      if (n.isMesh) { n.castShadow = true; n.material = n.material.clone(); }
    });
    const pivot = new THREE.Group();
    pivot.add(skin);
    pivot.updateMatrixWorld(true);
    const grip = skin.getObjectByName('Grip');
    if (grip) skin.position.sub(grip.getWorldPosition(new THREE.Vector3()));
    if (!skin.getObjectByName('Muzzle')) {
      const bounds = new THREE.Box3().setFromObject(skin);
      const muzzle = new THREE.Object3D();
      muzzle.name = 'Muzzle';
      muzzle.position.set(0, (bounds.min.y + bounds.max.y) / 2, bounds.max.z);
      pivot.add(muzzle);
    }
    this.weaponSkins ||= {};
    this.weaponSkins[type] = pivot;
    this.playerGun.add(pivot);
    this.setWeapon(this.activeWeapon || 'pulse');
  }
  applyAppearance(target, source, id) {
    this.appearanceIds ||= {};
    if (this.appearanceIds[target] === id) return;
    if (!source) {
      if (target === 'guard' && this.actor) {
        this.actor.mixer.stopAllAction();this.actor.mixer.uncacheRoot(this.actor.object);
        this.actor.object.traverse(n=>{if(n.isSkinnedMesh)n.skeleton.dispose();});
        this.player.remove(this.actor.root);this.actor=null;this.fallbackActor.visible=true;
      } else if (target !== 'guard' && this.weaponSkins?.[target]) {
        const previous=this.weaponSkins[target];this.playerGun.remove(previous);
        previous.traverse(n=>{if(n.isMesh)n.material.dispose();});
        delete this.weaponSkins[target];this.setWeapon(this.activeWeapon || 'pulse');
      }
      this.appearanceIds[target] = id;
      return;
    }
    if (target === 'guard') this.createActor(source, true);
    else {
      this.replaceWeaponAppearance(target, source);
      const image = this.appearancePreview(source, false, .65);
      const preview = document.querySelector(`[data-weapon="${target}"] .weapon-preview`);
      if (preview) preview.src = image;
    }
    this.appearanceIds[target] = id;
  }
  appearancePreview(source, actor, angle = .4) {
    // Reuse the battlefield renderer; no extra WebGL context per dialog or skin.
    const scene = new THREE.Scene(), object = clone(source.scene);
    object.traverse(n => { if (n.name === 'Pistol') n.visible = false; });
    let mixer;
    if (actor) {
      mixer = new THREE.AnimationMixer(object);
      const clip = THREE.AnimationClip.findByName(source.animations, 'Idle_Gun');
      if (clip) { mixer.clipAction(clip).play(); mixer.update(.25); }
    }
    const bounds = new THREE.Box3().setFromObject(object), size = bounds.getSize(new THREE.Vector3());
    object.position.sub(bounds.getCenter(new THREE.Vector3()));
    scene.add(object, new THREE.HemisphereLight(0xe4f5ff, 0x394d47, 3));
    const light = new THREE.DirectionalLight(0xffffff, 3);
    light.position.set(-3,5,4); scene.add(light);
    const extent = Math.max(size.x, size.y, size.z) * .65;
    const camera = new THREE.OrthographicCamera(-extent*1.38,extent*1.38,extent,-extent,.01,100);
    camera.position.set(Math.sin(angle)*5,actor?1.2:2.5,Math.cos(angle)*5); camera.lookAt(0,0,0);
    const target = new THREE.WebGLRenderTarget(640,464);
    target.texture.colorSpace = THREE.SRGBColorSpace;
    const renderer = this.renderer, previous = renderer.getRenderTarget();
    const clear = renderer.getClearColor(new THREE.Color()), alpha = renderer.getClearAlpha();
    try {
      renderer.setRenderTarget(target); renderer.setClearColor(0x14242b,1); renderer.render(scene,camera);
      const pixels = new Uint8Array(640*464*4);
      renderer.readRenderTargetPixels(target,0,0,640,464,pixels);
      const canvas=document.createElement('canvas'); canvas.width=640;canvas.height=464;
      const context=canvas.getContext('2d'), data=context.createImageData(640,464);
      for(let row=0;row<464;row++) data.data.set(pixels.subarray((463-row)*2560,(464-row)*2560),row*2560);
      context.putImageData(data,0,0);
      return canvas.toDataURL('image/png');
    } finally {
      renderer.setRenderTarget(previous); renderer.setClearColor(clear,alpha); target.dispose();
      mixer?.stopAllAction(); mixer?.uncacheRoot(object);
      object.traverse(n=>{if(n.isSkinnedMesh)n.skeleton.dispose();});
    }
  }
  batchWorld() {
    this.scene.updateMatrixWorld(true);
    const groups = new Map();
    let before = 0,
      after = 0;
    for (const mesh of [...this.scene.children]) {
      if (!mesh.isMesh || !mesh.material.isMeshStandardMaterial) continue;
      const key = mesh.material.uuid + '/' + mesh.castShadow + '/' + mesh.receiveShadow;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(mesh);
      before++;
    }
    for (const meshes of groups.values()) {
      if (meshes.length < 2) {
        after += meshes.length;
        continue;
      }
      const parts = meshes.map((m) => m.geometry.clone().applyMatrix4(m.matrixWorld));
      const geometry = mergeGeometries(parts, false);
      parts.forEach((g) => g.dispose());
      if (!geometry) {
        after += meshes.length;
        continue;
      }
      const combined = new THREE.Mesh(geometry, meshes[0].material);
      combined.castShadow = meshes[0].castShadow;
      combined.receiveShadow = meshes[0].receiveShadow;
      this.scene.add(combined);
      meshes.forEach((m) => this.scene.remove(m));
      after++;
    }
    this.batching = { before, after };
  }
  setQuality(level) {
    const config = { low: [1, 0, 32], medium: [1.35, 1024, 70], high: [1.7, 2048, 120] }[level];
    if (!config) return;
    this.quality = level;
    this.effectLimit = config[2];
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, config[0]));
    this.renderer.shadowMap.enabled = !!config[1];
    if (config[1]) this.sun.shadow.mapSize.set(config[1], config[1]);
    this.sun.shadow.map?.dispose();
    this.sun.shadow.map = null;
    this.scene.traverse((m) => {
      if (m.material) m.material.needsUpdate = true;
    });
    this.resize();
  }
  project(x, z, y = 0) {
    const p = new THREE.Vector3(x, y, z).project(this.camera),
      r = this.canvas.getBoundingClientRect();
    return {
      x: r.left + ((p.x + 1) * r.width) / 2,
      y: r.top + ((1 - p.y) * r.height) / 2,
      visible: Math.abs(p.x) < 0.96 && Math.abs(p.y) < 0.96,
    };
  }
  setWeapon(type) {
    this.activeWeapon = type;
    this.aimShapes ||= {
 arc: new THREE.RingGeometry(0.72, 0.8, 8),
      pulse: this.aimRing.geometry,
      plasma: new THREE.RingGeometry(1.02, 1.1, 6),
      cryo: new THREE.RingGeometry(0.55, 0.62, 4),
      rail: new THREE.RingGeometry(0.35, 0.42, 16),
    };
    this.aimRing.geometry = this.aimShapes[type];
    if (!this.weaponSkins) return;
    for (const [key, skin] of Object.entries(this.weaponSkins)) skin.visible = key === type;
    this.baseGunParts.forEach((m) => (m.visible = !this.weaponSkins[type]));
  }
  renderWeaponPreview(type, source) {
    const previewScene = new THREE.Scene(),
      model = clone(source);
    previewScene.add(model);
    previewScene.add(new THREE.HemisphereLight(0xffffff, 0x586c43, 3));
    const light = new THREE.DirectionalLight(0xffffff, 4);
    light.position.set(-3, 5, 4);
    previewScene.add(light);
    const bounds = new THREE.Box3().setFromObject(model),
      center = bounds.getCenter(new THREE.Vector3()),
      size = bounds.getSize(new THREE.Vector3()),
      extent = Math.max(size.x, size.y, size.z);
    model.position.sub(center);
    const camera = new THREE.OrthographicCamera(
      -extent * 0.8,
      extent * 0.8,
      extent * 0.34,
      -extent * 0.34,
      0.01,
      100,
    );
    camera.position.set(extent * 2, extent * 1.1, extent * 2.5);
    camera.lookAt(0, 0, 0);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(440, 187);
    renderer.setPixelRatio(1);
    renderer.setClearColor(0, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.render(previewScene, camera);
    const img = document.createElement('img');
    img.src = renderer.domElement.toDataURL('image/png');
    img.alt = WEAPONS[type].name + ' 3D 模型';
    img.className = 'weapon-preview';
    document
      .querySelector(`[data-weapon="${type}"] svg, [data-weapon="${type}"] .weapon-preview`)
      ?.replaceWith(img);
    renderer.dispose();
    renderer.forceContextLoss();
  }
  makeAsset(name, height, source = this.models[name]) {
    if (!source) return null;
    const object = clone(source.scene);
    const bounds = new THREE.Box3().setFromObject(object),
      size = bounds.getSize(new THREE.Vector3());
    const scale = height / Math.max(size.y, 0.001);
    object.scale.setScalar(scale);
    object.position.y = -bounds.min.y * scale;
    const root = new THREE.Group();
    root.add(object);
    object.traverse((m) => {
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
    return { root, object, animations: source.animations };
  }
  makeZombie(type) {
    const model = this.makeAsset(
      type==='dasher' ? 'dash-infected' : type==='shielded' ? 'shield-infected' : type==='boss' && this.map.newEnemies ? 'rift-boss' : type === 'armored'
        ? 'armored-infected'
        : type === 'tank' || type === 'boss'
        ? 'Zombie_Chubby'
        : type === 'runner'
          ? 'Zombie_Ribcage'
          : 'Zombie_Basic',
      type === 'boss' ? 3.5 : type === 'tank' ? 2.1 : 1.6,
    );
    if (model) {
      model.mixer = new THREE.AnimationMixer(model.object);
      const clip =
        THREE.AnimationClip.findByName(model.animations, type === 'runner' ? 'Run' : 'Walk') ||
        model.animations[0];
      if (['armored','dasher','shielded'].includes(type)||(type==='boss'&&this.map.newEnemies)) model.animations.forEach(c => model.mixer.clipAction(c).play());
      else if (clip) model.mixer.clipAction(clip).play();
      return model;
    }
    const root = new THREE.Group();
    this.box(0.55, 0.75, 0.35, 0x7e9972, 0, 0.9, 0, root);
    this.box(0.4, 0.4, 0.4, 0xa2b886, 0, 1.5, 0, root);
    for (const x of [-0.18, 0.18]) this.box(0.19, 0.55, 0.2, 0x354a3b, x, 0.28, 0, root);
    return { root };
  }
  addTower(t) {
    const def = TOWERS[t.type],
      g = new THREE.Group();
    g.position.set(t.x, 0.4, t.z);
    this.scene.add(g);
    if (t.type === 'arc' || def.support) {
      const asset = this.makeAsset(def.support ? `${t.type}-station` : 'arc-tower', 2.2);
      if (asset) {
        g.add(asset.root);
        const head = new THREE.Group();
        head.position.y = 1.8;
        g.add(head);
        this.towerMeshes.set(t.id, { root: g, head });
        this.padMeshes[t.pad].plus.visible = false;
        return;
      }
    }
    if(def.support) {
      this.box(1.2,1.5,1.2,def.color,0,.75,0,g);
      this.towerMeshes.set(t.id,{root:g,head:new THREE.Group()});
      return;
    }
    this.cylinder(0.7, 0.35, 0x8a9875, 0, 0.2, 0, g);
    this.cylinder(0.42, 1.0, 0x35463b, 0, 0.8, 0, g);
    const head = new THREE.Group();
    head.position.y = 1.35;
    g.add(head);
    if (t.type === 'cryo') {
      const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.65), this.mat(def.color, true));
      crystal.position.y = 0.25;
      head.add(crystal);
      this.box(1.4, 0.15, 0.5, 0x748c7f, 0, -0.2, 0, head);
    } else {
      this.box(t.type === 'plasma' ? 1.2 : 0.9, 0.65, 1, 0x829073, 0, 0.1, 0, head);
      for (const x of t.type === 'pulse' ? [-0.24, 0.24] : [0]) {
        this.box(t.type === 'plasma' ? 0.48 : 0.17, 0.2, 1.4, 0x303a32, x, 0.15, 0.9, head);
        this.box(
          t.type === 'plasma' ? 0.37 : 0.11,
          0.14,
          0.3,
          def.color,
          x,
          0.15,
          1.65,
          head,
          true,
        );
      }
      this.box(0.7, 0.06, 0.55, def.color, 0, 0.46, 0, head, true);
    }
    this.towerMeshes.set(t.id, { root: g, head });
    this.padMeshes[t.pad].plus.visible = false;
  }
  selectTower(t) {
    if (!t) {
      this.rangeRing.visible = false;
      return;
    }
    this.rangeRing.visible = !TOWERS[t.type].support;
    this.rangeRing.position.set(t.x, 0.2, t.z);
    const range = towerStats(t).range;
    this.rangeRing.scale.setScalar(range / 8);
    this.rangeRing.material.color.setHex(TOWERS[t.type].color);
  }
  pointerWorld(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      (-(clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const point = new THREE.Vector3();
    if (this.raycaster.ray.intersectPlane(this.plane, point)) {
      this.aim = { x: point.x, z: point.z };
      this.aimRing.position.set(point.x, 0.2, point.z);
      this.aimRing.visible = true;
      return this.aim;
    }
    return null;
  }
  pickPad(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    let closest = null,
      best = Infinity;
    this.map.pads.forEach((p, i) => {
      const screen = new THREE.Vector3(p[0], 0.4, p[1]).project(this.camera);
      const distance = Math.hypot(
        ((screen.x + 1) / 2) * rect.width + rect.left - clientX,
        ((-screen.y + 1) / 2) * rect.height + rect.top - clientY,
      );
      if (distance < Math.max(15, rect.width / 50) && distance < best) {
        best = distance;
        closest = i;
      }
    });
    return closest;
  }
  effect(key, geometry, color, wireframe = false) {
    const list = this.effectPool.get(key) || [];
    const mesh =
      list.pop() ||
      new THREE.Mesh(
        geometry(),
        new THREE.MeshBasicMaterial({ color, transparent: true, wireframe }),
      );
    this.effectPool.set(key, list);
    mesh.userData.poolKey = key;
    mesh.scale.set(1, 1, 1);
    mesh.material.opacity = this.reducedMotion ? 0.35 : 0.8;
    mesh.quaternion.identity();
    return mesh;
  }
  shot(event) {
    const def = WEAPONS[event.weapon];
    const from = new THREE.Vector3(event.from.x, event.from.y, event.from.z),
      to = new THREE.Vector3(event.to.x, event.to.y, event.to.z);
    if (!event.towerId) {
      this.player.position.set(event.from.x, 0, event.from.z);
      this.playerGun.rotation.y = Math.atan2(to.x - from.x, to.z - from.z);
      this.playerGun.updateWorldMatrix(true, true);
      this.weaponSkins?.[event.weapon]?.getObjectByName('Muzzle')?.getWorldPosition(from);
      this.recoil = event.weapon === 'plasma' ? 0.22 : 0.09;
      if (!this.reducedMotion) {
        const flash = this.effect(
          'flash-' + event.weapon,
          () => new THREE.OctahedronGeometry(0.22),
          def.color,
        );
        flash.position.copy(from);
        this.scene.add(flash);
        this.effects.push({ mesh: flash, life: 0.065, total: 0.065 });
      }
    }
    const beam = this.effect(
      'beam-' + event.weapon,
      () =>
        new THREE.CylinderGeometry(
          event.weapon === 'plasma' ? 0.09 : 0.035,
          event.weapon === 'plasma' ? 0.09 : 0.035,
          1,
          6,
        ),
      def.color,
    );
    beam.scale.y = from.distanceTo(to);
    beam.position.copy(from).lerp(to, 0.5);
    beam.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      to.clone().sub(from).normalize(),
    );
    this.scene.add(beam);
    this.effects.push({ mesh: beam, life: 0.15, total: 0.15 });
    if (event.hit) {
      const blast = this.effect(
        'blast-' + event.weapon,
        () => new THREE.IcosahedronGeometry(event.weapon === 'plasma' ? 1.8 : 0.3, 1),
        def.color,
        event.weapon === 'plasma',
      );
      blast.position.copy(to);
      this.scene.add(blast);
      this.effects.push({ mesh: blast, life: 0.28, total: 0.28, expand: !this.reducedMotion });
    }
    const turret = event.towerId ? this.towerMeshes.get(event.towerId)?.head : this.playerGun;
    if (turret) turret.rotation.y = Math.atan2(to.x - from.x, to.z - from.z);
  }
  emp(event) {
    if (this.reducedMotion) return;
    const ring = this.effect('emp', () => new THREE.RingGeometry(event.radius - .15, event.radius, 48), 0xb66aff);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(event.x, .18, event.z);
    this.scene.add(ring);
    this.effects.push({ mesh: ring, life: .6, total: .6 });
  }
  removeEffect(effect) {
    this.scene.remove(effect.mesh);
    const key = effect.mesh.userData.poolKey,
      list = this.effectPool.get(key) || [];
    if (key && list.length < 12) {
      list.push(effect.mesh);
      this.effectPool.set(key, list);
    } else {
      effect.mesh.geometry.dispose();
      effect.mesh.material.dispose();
    }
  }
  react(event) {
    const model = this.enemyMeshes.get(event.enemy.id);
    if (!model) return;
    if (event.type === 'hit') {
      model.hitTime = 0.12;
      return;
    }
    if (event.type !== 'kill') return;
    this.enemyMeshes.delete(event.enemy.id);
    model.bar.visible = model.barBg.visible = false;
    if(model.shieldBar)model.shieldBar.visible=false;
    model.mixer?.stopAllAction();
    const clip = model.animations && THREE.AnimationClip.findByName(model.animations, 'Death');
    if (clip && model.mixer) {
      const action = model.mixer.clipAction(clip);
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
      action.reset().play();
    }
    model.life = clip ? Math.min(3, clip.duration + 0.3) : 0.25;
    this.corpses.push(model);
    if (this.corpses.length > 16) this.disposeEnemy(this.corpses.shift());
  }
  disposeEnemy(model) {
    this.scene.remove(model.root);
    model.mixer?.stopAllAction();
    model.mixer?.uncacheRoot(model.object);
    model.object?.traverse((n) => {
      if (n.isSkinnedMesh) n.skeleton.dispose();
    });
    for (const part of [model.bar, model.barBg,model.shieldBar].filter(Boolean)) {
      part.geometry.dispose();
      part.material.dispose();
    }
  }
  render(game, dt) {
    this.preview.visible = game.wave === 0;
    this.player.position.set(game.player.x, 0, game.player.z);
    game.player.angle = Math.atan2(this.aim.x - game.player.x, this.aim.z - game.player.z);
    this.playerGun.rotation.y = game.player.angle;
    this.playerGun.position.x = Math.cos(game.player.angle) * 0.23;
    this.playerGun.position.z = -Math.sin(game.player.angle) * 0.23;
    if (this.actor) {
      this.actor.root.rotation.y = game.player.angle;
      const mode = game.player.moving
        ? game.player.sprinting
          ? 'Run_Gun'
          : 'Walk_Gun'
        : 'Idle_Gun';
      if (mode !== this.actor.mode) {
        const next = this.actor.actions[mode],
          old = this.actor.actions[this.actor.mode];
        next?.reset().fadeIn(0.16).play();
        old?.fadeOut(0.16);
        this.actor.mode = mode;
      }
      this.actor.mixer.update(dt);
    } else this.fallbackActor.rotation.y = game.player.angle;
    const destination = this.overview
      ? new THREE.Vector3()
      : new THREE.Vector3(game.player.x * 0.7, 0, game.player.z * 0.55);
    this.follow.lerp(destination, this.reducedMotion ? 1 : 1 - Math.exp(-Math.max(dt, 0.016) * 7));
    this.camera.position.copy(this.follow).add(new THREE.Vector3(24, 34, 37));
    this.camera.lookAt(this.follow);
    this.camera.updateMatrixWorld();
    this.recoil = Math.max(0, this.recoil - dt * 1.8);
    this.playerGun.position.y = 1.3 + (this.reducedMotion ? 0 : this.recoil * 0.3);
    const hand = this.actor?.grip;
    if (hand) {
      this.player.updateWorldMatrix(true, true);
      const grip = this.player.worldToLocal(hand.getWorldPosition(new THREE.Vector3()));
      this.playerGun.position.copy(grip);
      this.playerGun.position.y += this.reducedMotion ? 0 : this.recoil * .12;
    }
    this.playerGun.rotation.x = this.reducedMotion ? 0 : -this.recoil;
    for (const model of this.corpses) {
      model.life -= dt;
      model.mixer?.update(dt);
      if (model.life <= 0) this.disposeEnemy(model);
    }
    this.corpses = this.corpses.filter((m) => m.life > 0);
    this.core.rotation.y = Math.sin(game.time * 0.6) * 0.035;
    this.coreRing.material.opacity = 0.4 + Math.sin(game.time * 2) * 0.15;
    for (const [id, m] of this.enemyMeshes) {
      if (!game.enemies.some((e) => e.id === id && e.hp > 0)) {
        this.disposeEnemy(m);
        this.enemyMeshes.delete(id);
      }
    }
    for (const e of game.enemies) {
      if (e.hp <= 0) continue;
      let mesh = this.enemyMeshes.get(e.id);
      if (!mesh) {
        mesh = this.makeZombie(e.type);
        const bar = new THREE.Mesh(
          new THREE.PlaneGeometry(1, 0.1),
          new THREE.MeshBasicMaterial({ color: 0xd8f36a, depthTest: false }),
        );
        const bg = new THREE.Mesh(
          new THREE.PlaneGeometry(1.1, 0.16),
          new THREE.MeshBasicMaterial({ color: 0x17221a, depthTest: false }),
        );
        bar.position.y = e.type === 'boss' ? 4 : 2.35;
        bg.position.y = bar.position.y;
        bar.renderOrder = 3;
        bg.renderOrder = 2;
        mesh.root.add(bg, bar);
        mesh.bar = bar;
        mesh.barBg = bg;
        if(e.maxShield>0){
          mesh.shieldBar=new THREE.Mesh(new THREE.PlaneGeometry(1,.09),new THREE.MeshBasicMaterial({color:0x69d9ff,depthTest:false}));
          mesh.shieldBar.position.y=bar.position.y+.18;mesh.shieldBar.renderOrder=3;mesh.root.add(mesh.shieldBar);
        }
        this.enemyMeshes.set(e.id, mesh);
        this.scene.add(mesh.root);
      }
      mesh.root.position.set(e.x, 0, e.z);
      mesh.root.rotation.y = e.angle;
      mesh.hitTime = Math.max(0, (mesh.hitTime || 0) - dt);
      mesh.root.rotation.z =
        !this.reducedMotion && mesh.hitTime > 0 ? Math.sin(mesh.hitTime * 60) * 0.055 : 0;
      mesh.mixer?.update(dt * (e.slow > 0 ? 0.4 : 1));
      mesh.bar.scale.x = Math.max(0.01, e.hp / e.maxHp);
      const q = this.camera.quaternion.clone().premultiply(mesh.root.quaternion.clone().invert());
      mesh.bar.quaternion.copy(q);
      mesh.barBg.quaternion.copy(q);
      if(mesh.shieldBar){mesh.shieldBar.visible=e.shield>0;mesh.shieldBar.scale.x=e.shield/e.maxShield;mesh.shieldBar.quaternion.copy(q);}
      mesh.bar.material.color.setHex(
        e.dashState===1||e.phaseTwo ? 0xff5b31 : e.slow > 0 ? 0x8fe6f3 : e.type === 'boss' ? 0xff9567 : 0xd8f36a,
      );
    }
    for (const t of game.towers) {
      if (!this.towerMeshes.has(t.id)) this.addTower(t);
      this.towerMeshes.get(t.id).root.scale.setScalar(1 + (t.level - 1) * 0.12);
      const mesh=this.towerMeshes.get(t.id);
      if(t.branch && !mesh.branchMarker) {
        mesh.branchMarker=this.box(.3,.3,.3,t.branch==='legacy'?0xffffff:Object.keys(BRANCHES[t.type]).indexOf(t.branch)===0?0x69e6ff:0xffdf67,0,2.5,0,mesh.root,true);
      }
    }
    for (const [id, m] of this.towerMeshes) {
      if (!game.towers.some((t) => t.id === id)) {
        this.scene.remove(m.root);
        this.towerMeshes.delete(id);
      }
    }
    this.padMeshes.forEach((p, i) => {
      p.plus.visible = !game.towers.some((t) => t.pad === i);
      p.ring.material.opacity = p.plus.visible ? 0.38 : 0.13;
    });
    for (const effect of this.effects) {
      effect.life -= dt;
      effect.mesh.material.opacity =
        Math.max(0, effect.life / effect.total) * (this.reducedMotion ? 0.35 : 0.8);
      if (effect.expand) effect.mesh.scale.multiplyScalar(1 + dt * 3);
      if (effect.life <= 0) this.removeEffect(effect);
    }
    this.effects = this.effects.filter((e) => e.life > 0);
    while (this.effects.length > this.effectLimit) this.removeEffect(this.effects.shift());
    this.renderer.render(this.scene, this.camera);
  }
  resize() {
    const w = this.canvas.clientWidth,
      h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    const aspect = w / h;
    const width = this.overview ? 56 : aspect < 1.1 ? 27 : 39;
    const height = width / aspect;
    this.camera.left = -width / 2;
    this.camera.right = width / 2;
    this.camera.top = height / 2;
    this.camera.bottom = -height / 2;
    this.camera.updateProjectionMatrix();
  }
  reset() {
    for (const corpse of this.corpses) this.disposeEnemy(corpse);
    this.corpses = [];
    this.recoil = 0;
    for (const m of this.enemyMeshes.values()) {
      this.disposeEnemy(m);
    }
    this.enemyMeshes.clear();
    for (const m of this.towerMeshes.values()) this.scene.remove(m.root);
    this.towerMeshes.clear();
    for (const e of this.effects) this.removeEffect(e);
    this.effects = [];
    this.rangeRing.visible = false;
  }
}
