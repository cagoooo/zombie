import { startUpdates } from './pwa.js';
import './style.css';
import './controls.css';
import './combat.css';
import './release.css';
import { Controls } from './controls.js';
import { Tutorial } from './tutorial.js';
import { checkpoint, restore, SAVE_KEY } from './save.js';
import { PATH, PADS } from './game.js';
import { GameAudio } from './audio.js';
import { Cosmetics } from './cosmetics.js';
import { Game, WEAPONS, TOWERS } from './game.js';
import { Battlefield } from './scene.js';
import { FixedStepper } from './timing.js';

const $ = (id) => document.getElementById(id),
  game = new Game();
let view;
try {
  view = new Battlefield($('game'));
} catch (error) {
  $('phase-label').textContent = '3D 畫面啟動失敗';
  $('dialog-title').textContent = '無法啟動 3D 戰場';
  $('dialog-body').textContent =
    '請使用支援 WebGL 2 的 Chrome 或 Edge，並開啟瀏覽器硬體加速後重新載入。';
  $('overlay').hidden = false;
  $('resume').textContent = '重新載入';
  $('resume').onclick = () => location.reload();
  throw error;
}
let selectedType = 'pulse',
  selectedTower = null,
  shooting = false,
  speed = 1,
  muted = true,
  toastTimer,
  hitTimer,
  dialogMode = 'pause',
  best = 0;
let buildMode = false,
  overview = false,
  mousePoint = null,
  resumeChecked = false,
  pendingSave = null,
  saveLast = '',
  saveError = false,
  saveClock = 0;
const tutorial = new Tutorial();
const input = new Controls({
  canAct: () => !game.paused && !buildMode && ['ready', 'wave'].includes(game.phase),
  shoot: (value) => {
    if (value && !shooting) {
      input.update(game, 0);
      game.fire(view.aim, true);
    }
    shooting = value;
  },
  aim: (point) => {
    view.aim = point;
    view.aimRing.position.set(point.x, 0.2, point.z);
    view.aimRing.visible = true;
  },
});
try {
  best = Number(localStorage.getItem('deadzone-best')) || 0;
} catch {}
$('best').textContent = best;
function toast(message) {
  $('toast').textContent = message;
  $('toast').classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').classList.remove('show'), 2700);
}
const musicLabels = {
  off: '音樂尚未開啟；開始第一波會播放，也可按下方按鈕開啟。',
  loading: 'BGM 載入中…', playing: '正在播放：Urgent · SRG774',
  paused: 'BGM 已暫停；返回戰場後繼續播放。', silent: 'BGM 音量為 0%。',
  blocked: '瀏覽器尚未允許播放，請按「重試 BGM」。',
  error: 'BGM 載入失敗，請確認網路後按「重試 BGM」。',
};
const sound = new GameAudio((state) => {
  $('music-status').textContent = musicLabels[state];
  $('retry-music').hidden = !['error', 'blocked'].includes(state);
  if (['error', 'blocked'].includes(state)) toast(musicLabels[state]);
});
let soundPreference = null, soundBusy = false;
try { soundPreference = JSON.parse(localStorage.getItem('deadzone-sound-enabled')); } catch {}
if (soundPreference === false) {
  musicLabels.off = '音樂與音效已靜音；可按下方按鈕開啟。';
  $('music-status').textContent = musicLabels.off;
}
function audio(type) {
  sound.play(type);
}
function changeWeapon(type) {
  game.switchWeapon(type);
  tutorial.mark('switch');
  view.setWeapon(type);
  document.querySelectorAll('[data-weapon]').forEach((b) => {
    const active = b.dataset.weapon === type;
    b.classList.toggle('selected', active);
    b.setAttribute('aria-pressed', active);
  });
  view.aimRing.material.color.setHex(WEAPONS[type].color);
  toast(`已切換：${WEAPONS[type].name}`);
}
function towerDetail() {
  const t = game.towers.find((t) => t.id === selectedTower);
  view.selectTower(t);
  if (!t) {
    $('tower-detail').innerHTML =
      '<div class="detail-label">戰術提示 <span>↗</span></div><p>彎道是最好的伏擊點。<br>搭配冰凍與電漿，延長火力覆蓋。</p>';
    return;
  }
  const def = TOWERS[t.type];
  $('tower-detail').innerHTML =
    `<div class="detail-label">${def.name} · Lv.${t.level}<span>↗</span></div><p>傷害 ${Math.round(def.damage * (1 + (t.level - 1) * 0.65))} · 射程 ${(def.range + (t.level - 1) * 1.2).toFixed(1)}<br>出售返還已投入能源的 70%</p><button id="upgrade" ${t.level >= 3 ? 'disabled' : ''}>${t.level >= 3 ? '已達最高等級' : `升級 ϟ ${game.upgradeCost(t)}`}</button><button id="sell">出售 ϟ ${Math.floor((t.spent * 70) / 100)}</button>`;
  $('upgrade').onclick = () => {
    if (game.upgrade(t.id)) {
      toast('防禦塔升級完成');
      towerDetail();
    } else toast('能源不足或目前無法升級');
  };
  $('sell').onclick = () => {
    if (game.sell(t.id)) {
      selectedTower = null;
      towerDetail();
      toast('防禦塔已回收');
    }
  };
}
function modal(mode) {
  shooting = false;
  input.clear();
  dialogMode = mode;
  game.paused = true;
  sound.setPaused(true);
  $('overlay').hidden = false;
  $('pause').textContent = '▶ 繼續';
  const content = {
    pause: ['SYSTEM / PAUSED', '戰場已暫停', '喘口氣，想好下一步再繼續。', '繼續防守 ↗'],
    help: [
      'FIELD MANUAL / 01',
      '指揮官，準備就緒。',
      '① WASD／方向鍵移動，Shift 奔跑；手機左搖桿移動。\n② 滑鼠瞄準並按住射擊；手機左搖桿移動及轉向，按住右下角朝前方射擊，放開停止。\n③ 1／2／3 或武器按鈕切槍。熱量滿需冷卻。\n④ B／建造：選塔型點「＋」；點既有塔升級／出售。\n⑤ C／全圖查看戰場；P／空白鍵暫停。\n人物不受傷，敵人只攻核心；貨櫃與塔等主要障礙會擋住玩家射擊。\n準備階段自動保存；戰鬥中重整回到最近部署。\n守住 10 波獲勝，第 5／10 波有巨型殭屍。',
      '了解，進入戰場 ↗',
    ],
    won: [
      'MISSION / COMPLETE',
      '最後的光，守住了。',
      `成功抵擋全部 10 波！\n擊退 ${game.kills} 隻殭屍 · 核心完整度 ${game.health}%`,
      '再戰一次 ↗',
    ],
    lost: [
      'SIGNAL / LOST',
      '防線失守。',
      `在第 ${game.wave} 波擊退了 ${game.kills} 隻殭屍。\n試試在彎道搭配冰凍稜鏡與電漿迫擊塔。`,
      '重新部署 ↗',
    ],
  }[mode];
  ['dialog-eyebrow', 'dialog-title', 'dialog-body', 'resume'].forEach(
    (id, i) => ($(id).textContent = content[i]),
  );
}
function resume() {
  if (!$('loading-panel').hidden || !$('checkpoint-panel').hidden) return;
  if (dialogMode === 'won' || dialogMode === 'lost') {
    view.reset();
    game.reset();
    speed = 1;
    $('speed').textContent = '1× 速度';
    setBuild(false);
    input.clear();
    selectedTower = null;
    changeWeapon('pulse');
    towerDetail();
  }
  game.paused = false;
  game.aimAssist = settings.aimAssist;
  sound.setPaused(false);
  $('overlay').hidden = true;
  $('pause').textContent = 'Ⅱ 暫停';
}
$('resume').onclick = resume;
$('help').onclick = () => {
  if (!$('loading-panel').hidden || !$('settings-overlay').hidden || !$('checkpoint-panel').hidden)
    return;
  if (!['won', 'lost'].includes(game.phase)) modal('help');
};
$('pause').onclick = () => {
  if (!$('settings-overlay').hidden || !$('loading-panel').hidden || !$('checkpoint-panel').hidden)
    return;
  if (['won', 'lost'].includes(game.phase)) return;
  game.paused ? resume() : modal('pause');
};
async function setSound(value) {
  if (soundBusy) return;
  soundBusy = true;
  muted = !(await sound.enable(value));
  soundPreference = !muted;
  try { localStorage.setItem('deadzone-sound-enabled', JSON.stringify(!muted)); } catch {}
  $('sound').setAttribute('aria-pressed', !muted);
  $('sound').textContent = muted ? '♫' : '♪';
  $('sound').title = $('sound').ariaLabel = muted ? '開啟音樂與音效' : '關閉音樂與音效';
  $('enable-music').textContent = muted ? '開啟音樂與音效' : '關閉音樂與音效';
  toast(muted ? '音樂與音效已關閉' : '音樂與音效已開啟');
  soundBusy = false;
}
$('sound').onclick = () => setSound(muted);
$('enable-music').onclick = () => setSound(muted);
$('retry-music').onclick = async () => {
  try { await sound.context?.resume(); }
  catch { sound.music.setState('blocked'); return; }
  // Settings pause the battle; retry queues a fresh attempt on return.
  sound.music.sync({ retry: true });
};
$('speed').onclick = () => {
  speed = speed === 1 ? 2 : 1;
  $('speed').textContent = `${speed}× 速度`;
};
document.querySelectorAll('[data-weapon]').forEach((b) => {
  b.setAttribute('aria-pressed', b.classList.contains('selected'));
  b.onclick = () => changeWeapon(b.dataset.weapon);
});
document.querySelectorAll('[data-tower]').forEach((b) => {
  b.setAttribute('aria-pressed', b.classList.contains('selected'));
  b.onclick = () => {
    selectedType = b.dataset.tower;
    setBuild(true);
    document.body.classList.remove('build-open');
    selectedTower = null;
    towerDetail();
    document.querySelectorAll('[data-tower]').forEach((c) => {
      c.classList.toggle('selected', c === b);
      c.setAttribute('aria-pressed', c === b);
    });
    toast(`已選擇${TOWERS[selectedType].name}，點擊「＋」部署`);
  };
});
$('next-wave').onclick = () => {
  persistReady();
  if (game.startWave()) {
    if (muted && soundPreference !== false) setSound(true);
    input.clear();
    setBuild(false);
    tutorial.mark('wave');
  }
};
const canvas = $('game');
const syncBrowserZoom = () => {
  const v=window.visualViewport, root=document.documentElement;
  root.classList.toggle('browser-zoomed', (v?.scale || 1) > 1.02);
  $('zoom-recovery').hidden = (v?.scale || 1) <= 1.02;
  root.style.setProperty('--visible-width', (v?.width || innerWidth)+'px');
  root.style.setProperty('--visible-left', (v?.offsetLeft || 0)+'px');
  root.style.setProperty('--visible-top', (v?.offsetTop || 0)+'px');
};
window.visualViewport?.addEventListener('resize', syncBrowserZoom);
window.visualViewport?.addEventListener('scroll', syncBrowserZoom);
syncBrowserZoom();
$('reset-viewport').onclick = () => {
  const meta=document.querySelector('meta[name="viewport"]'), original=meta.content;
  meta.content='width=device-width,initial-scale=1,minimum-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover';
  syncBrowserZoom();
};
// Older iOS Safari can ignore touch-action, so keep a small native gesture guard as well.
let lastTouchEnd = 0;
document.addEventListener('touchend', event => {
  const now = performance.now();
  const target = event.target instanceof Element ? event.target : null;
  if (now - lastTouchEnd < 320 && !target?.closest('button,a,input,select,textarea')) event.preventDefault();
  lastTouchEnd = now;
}, {passive:false});
document.addEventListener('touchmove', event => {
  if (event.touches.length > 1) event.preventDefault();
}, {passive:false});
for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
  document.addEventListener(type, event => event.preventDefault(), {passive:false});
}
canvas.addEventListener('pointermove', (e) => {
  if (e.pointerType === 'touch') return;
  input.touchMode = false;
  mousePoint = { x: e.clientX, y: e.clientY };
  view.pointerWorld(e.clientX, e.clientY);
});
canvas.addEventListener('pointerdown', (e) => {
  if (e.button !== 0 || game.paused) return;
  if (e.pointerType === 'touch' && !buildMode) return;
  if (e.pointerType !== 'touch') input.touchMode = false;
  const point = view.pointerWorld(e.clientX, e.clientY);
  if (!point) return;
  const pad = buildMode ? view.pickPad(e.clientX, e.clientY) : null;
  if (pad !== null) {
    document.body.classList.add('build-open');
    const existing = game.towers.find((t) => t.pad === pad);
    if (existing) {
      selectedTower = existing.id;
      towerDetail();
    } else if (game.build(pad, selectedType)) {
      selectedTower = game.towers.at(-1).id;
      towerDetail();
      toast(`${TOWERS[selectedType].name}部署完成`);
    } else toast('能源不足或角色太靠近基座，請移開後再部署');
    return;
  }
  if (buildMode) return;
  selectedTower = null;
  towerDetail();
  mousePoint = { x: e.clientX, y: e.clientY };
  shooting = true;
  canvas.setPointerCapture(e.pointerId);
  game.fire(point);
});
canvas.addEventListener('pointerup', () => (shooting = false));
canvas.addEventListener('pointercancel', () => (shooting = false));
canvas.addEventListener('lostpointercapture', () => (shooting = false));
canvas.addEventListener('pointerleave', () => {
  if (!shooting) view.aimRing.visible = false;
});
window.addEventListener('blur', () => {
  shooting = false;
  if (game.phase === 'wave' && !game.paused) modal('pause');
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && game.phase === 'wave' && !game.paused) modal('pause');
});
window.addEventListener('keydown', (e) => {
  if (!$('cosmetics-overlay').hidden) return;
  if (!$('settings-overlay').hidden) {
    if (e.code === 'Escape') {
      e.preventDefault();
      $('close-settings').click();
    }
    if (e.code === 'Tab') {
      const controls = [...$('settings-overlay').querySelectorAll('input, select, button, a[href]')]
        .filter((element) => !element.hidden);
      const next =
        (controls.indexOf(document.activeElement) + (e.shiftKey ? -1 : 1) + controls.length) %
        controls.length;
      e.preventDefault();
      controls[next].focus();
    }
    return;
  }
  if (
    e.repeat ||
    e.ctrlKey ||
    e.metaKey ||
    e.altKey ||
    /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)
  )
    return;
  if (e.code === 'KeyB' && !game.paused) {
    e.preventDefault();
    $('build-mode').click();
  }
  if (e.code === 'KeyC' && !game.paused) {
    e.preventDefault();
    $('overview').click();
  }
  if (['1', '2', '3'].includes(e.key)) changeWeapon(['pulse', 'plasma', 'cryo'][Number(e.key) - 1]);
  if (e.code === 'Space' || e.code === 'KeyP') {
    if (e.code === 'Space' && e.target.tagName === 'BUTTON') return;
    e.preventDefault();
    $('pause').click();
  }
  if (e.code === 'Escape' && !$('settings-overlay').hidden) {
    $('close-settings').click();
    return;
  }
  if (e.code === 'Escape' && game.paused && !['won', 'lost'].includes(game.phase)) resume();
});
function updateUI() {
  const status = { ready: '準備階段', wave: '敵軍來襲', won: '防守成功', lost: '核心失守' }[
    game.phase
  ];
  $('phase-label').textContent = buildMode ? '建造模式' : status;
  $('compact-hud').textContent = '◈ ' + game.health + '%  ϟ ' + game.credits;
  $('compact-heat').textContent = (game.overheated ? '冷卻 ' : '熱 ') + Math.round(game.heat) + '%';
  document.body.classList.toggle('core-danger', game.health < 30);
  drawMinimap();
  $('wave-label').textContent = String(Math.max(1, game.wave)).padStart(2, '0');
  $('health-value').innerHTML = `${game.health}<span>%</span>`;
  $('health-bar').style.width = `${game.health}%`;
  $('health-bar').style.background = game.health < 30 ? 'var(--danger)' : 'var(--brand)';
  $('core-state').textContent =
    game.health < 30 ? '核心受損嚴重，盡快阻止敵人！' : '能量核心穩定運作中';
  $('credits').textContent = game.credits;
  $('kills').textContent = String(game.kills).padStart(3, '0');
  $('enemies').textContent = game.enemies.filter((e) => e.hp > 0).length;
  $('remaining').textContent = game.spawnLeft;
  $('heat-label').textContent = `${Math.round(game.heat)}%`;
  $('heat-bar').style.width = `${game.heat}%`;
  $('heat-bar').style.background = game.overheated ? 'var(--danger)' : 'var(--brand)';
  $('heat-note').textContent = game.overheated
    ? '武器過熱 · 正在冷卻'
    : game.heat > 65
      ? '注意熱量 · 建議間歇射擊'
      : '能量充足 · 隨時開火';
  $('next-wave').parentElement.hidden = game.phase !== 'ready';
  $('next-wave').innerHTML =
    game.wave === 0 ? '開始第一波 <span>↗</span>' : `開始第 ${game.wave + 1} 波 <span>↗</span>`;
  $('wave-hint').textContent =
    game.wave === 0 ? '先部署防禦塔，再迎接第一波敵人' : '戰場暫時安全，部署或升級後繼續';
}
function handleEvents() {
  for (const event of game.events.splice(0)) {
    if (event.type === 'shot') {
      view.shot(event);
      if (!event.towerId) {
        audio(event.weapon);
        tutorial.mark('shoot');
        if (event.hit) {
          audio('hit');
          $('hit-confirm').textContent = '✛ 命中';
          $('hit-confirm').classList.add('active');
          clearTimeout(hitTimer);
          hitTimer = setTimeout(() => $('hit-confirm').classList.remove('active'), 180);
        }
      }
    }
    if (event.type === 'step') {
      audio('step');
      tutorial.mark('move');
    }
    if (event.type === 'build') tutorial.mark('build');
    if (event.type === 'clear') persistReady();
    if (['hit', 'kill'].includes(event.type)) view.react(event);
    if (['wave', 'kill', 'breach', 'build'].includes(event.type)) audio(event.type);
    if (event.type === 'breach') toast('核心遭到攻擊！立即攔截接近終點的敵人');
    if (event.type === 'wave')
      toast(`第 ${event.wave} 波來襲${event.wave % 5 === 0 ? ' · 偵測到巨型殭屍' : ''}`);
    if (event.type === 'clear') toast(`本波守住了！能源 +${event.bonus} · 核心修復 +5%`);
    if (event.type === 'overheat') toast('武器過熱！稍等冷卻後再射擊');
    if (event.type === 'end') {
      try {
        localStorage.removeItem(SAVE_KEY);
        saveLast = '';
      } catch {}
      modal(event.won ? 'won' : 'lost');
    }
    if (event.type === 'kill' && game.kills > best) {
      best = game.kills;
      $('best').textContent = best;
      try {
        localStorage.setItem('deadzone-best', String(best));
      } catch {}
    }
  }
}
let last = performance.now(),
  uiTime = 0;
const stepper = new FixedStepper();
function frame(now) {
  const dt = Math.max(0, (now - last) / 1000);
  last = now;
  const advanced = stepper.advance(dt, { speed, paused: game.paused }, (step) => {
    input.update(game, step);
    if (game.player.moving) tutorial.mark('move');
    if (mousePoint && !input.touchMode && !buildMode) view.pointerWorld(mousePoint.x, mousePoint.y);
    game.update(step);
    if (shooting) game.fire(view.aim, input.touchMode);
  });
  handleEvents();
  saveClock += dt;
  if (saveClock > 0.75) {
    persistReady();
    saveClock = 0;
  }
  view.render(game, game.paused ? 0 : advanced);
  uiTime += dt;
  if (uiTime > 0.08) {
    updateUI();
    uiTime = 0;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
updateUI();
const settings = {
  effects: 45,
  music: 35,
  ambient: 20,
  reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
  aimAssist: true,
  quality: matchMedia('(pointer: coarse)').matches ? 'low' : 'medium',
};
try {
  Object.assign(settings, JSON.parse(localStorage.getItem('deadzone-settings') || '{}'));
} catch {}
function applySettings() {
  settings.effects = Math.max(0, Math.min(100, Number(settings.effects) || 0));
  settings.music = Math.max(0, Math.min(100, Number(settings.music) || 0));
  settings.ambient = Math.max(0, Math.min(100, Number(settings.ambient) || 0));
  if (!['low', 'medium', 'high'].includes(settings.quality)) settings.quality = 'medium';
  if (view.quality !== settings.quality || !view.qualityApplied) {
    view.setQuality(settings.quality);
    view.qualityApplied = true;
  }
  sound.volume = settings.effects / 100;
  sound.music.volume = settings.music / 100;
  sound.ambience = settings.ambient / 100;
  sound.syncAmbient();
  view.reducedMotion = settings.reducedMotion;
  game.aimAssist = settings.aimAssist;
  document.body.classList.toggle('reduced-motion', !!settings.reducedMotion);
  try {
    localStorage.setItem('deadzone-settings', JSON.stringify(settings));
  } catch {}
}
for (const [id, key, output] of [
  ['effects-volume', 'effects', 'effects-value'],
  ['music-volume', 'music', 'music-value'],
  ['ambient-volume', 'ambient', 'ambient-value'],
]) {
  $(id).value = settings[key];
  $(output).value = settings[key] + '%';
  $(id).oninput = () => {
    settings[key] = Number($(id).value);
    $(output).value = settings[key] + '%';
    applySettings();
  };
}
for (const [id, key] of [
  ['reduce-motion', 'reducedMotion'],
  ['aim-assist', 'aimAssist'],
]) {
  $(id).checked = settings[key];
  $(id).onchange = () => {
    settings[key] = $(id).checked;
    applySettings();
  };
}
applySettings();
$('quality').value = settings.quality;
$('quality').onchange = () => {
  settings.quality = $('quality').value;
  applySettings();
};
$('replay-tutorial').onclick = () => {
  tutorial.restart();
  $('close-settings').click();
};
let settingsWasPaused = false,
  previousFocus = null;
$('settings').onclick = () => {
  if (!$('loading-panel').hidden || !$('checkpoint-panel').hidden) return;
  input.clear();
  settingsWasPaused = game.paused;
  previousFocus = document.activeElement;
  game.paused = true;
  shooting = false;
  sound.setPaused(true);
  $('settings-overlay').hidden = false;
  $('effects-volume').focus();
};
$('close-settings').onclick = () => {
  $('settings-overlay').hidden = true;
  game.paused = settingsWasPaused;
  sound.setPaused(game.paused);
  previousFocus?.focus();
};
const finishLoading = () => {
  $('loading-panel').hidden = true;
  document.body.dataset.ready = 'true';
  game.paused = false;
  sound.setPaused(false);
};
async function loadAssets(onlyId = null) {
  const wasPaused = game.paused;
  game.paused = true;
  shooting = false;
  sound.setPaused(true);
  $('loading-panel').hidden = false;
  $('retry-assets').hidden = $('continue-fallback').hidden = true;
  $('asset-failures').replaceChildren();
  const errors = await view.loadAssets(({ finished, total }) => {
    const value = total ? Math.round((finished / total) * 100) : 100;
    $('loading-label').textContent = '載入戰場素材 ' + finished + ' / ' + total;
    $('loading-percent').textContent = value + '%';
    $('loading-progress').value = value;
  }, onlyId);
  view.setWeapon(game.weapon);
  let completing = false;
  const complete = async () => {
    if (completing) return;
    completing = true;
    $('continue-fallback').disabled = true;
    await cosmetics.restore();
    finishLoading();
    game.paused = wasPaused;
    sound.setPaused(wasPaused);
    offerCheckpoint();
    $('continue-fallback').disabled = false;
  };
  $('continue-fallback').onclick = complete;
  if (errors.length) {
    $('loading-label').textContent = '部分素材未載入';
    for (const failure of view.assets.failures.values()) {
      const row = document.createElement('div');
      row.className = 'asset-failure';
      const label = document.createElement('span');
      label.textContent = failure.label;
      const retry = document.createElement('button');
      retry.textContent = '重試';
      retry.onclick = () => {
        game.paused = wasPaused;
        loadAssets(failure.id);
      };
      row.append(label, retry);
      $('asset-failures').append(row);
    }
    $('retry-assets').hidden = $('continue-fallback').hidden = false;
    $('retry-assets').onclick = () => {
      game.paused = wasPaused;
      loadAssets();
    };
  } else complete();
}
const cosmetics = new Cosmetics({view,game,sound,toast,clearInput:()=>{input.clear();shooting=false;}});
loadAssets();
// Read-only state snapshot for integration diagnostics; no gameplay mutation hooks.
window.deadzone = {
  project: (x, z, y = 0) => view.project(x, z, y),
  snapshot: () => ({
    player: { ...game.player },
    buildMode,
    overview: view.overview,
    quality: view.quality,
    batching: view.batching,
    memory: { ...view.renderer.info.memory },
    effectResources: {
      active: view.effects.length,
      limit: view.effectLimit,
      pooled: Object.fromEntries([...view.effectPool].map(([key, list]) => [key, list.length])),
    },
    phase: game.phase,
    paused: game.paused,
    wave: game.wave,
    health: game.health,
    credits: game.credits,
    kills: game.kills,
    weapon: game.weapon,
    heat: game.heat,
    aim: {...view.aim},
    touchMode: input.touchMode,
    shooting,
    towers: game.towers.map((t) => ({ ...t })),
    enemies: game.enemies.map((e) => ({ ...e })),
    assetsReady: view.ready,
    assetsLoaded: Object.keys(view.models),
    corpses: view.corpses.length,
    settings: { ...settings },
    audio: sound.music.snapshot(),
    cosmetics: cosmetics.snapshot(),
    grip: { bone: view.actor?.grip?.name || null, gunPosition: view.playerGun.position.toArray() },
    assetErrors: view.assetErrors || [],
    render: view.renderer.info.render,
  }),
};

function setBuild(value) {
  buildMode = value;
  input.clear();
  document.body.classList.toggle('build-open', value);
  $('build-mode').setAttribute('aria-pressed', value);
  $('build-mode').textContent = value ? '返回戰鬥 B' : '建造 B';
  view.overview = buildMode || overview;
  view.resize();
}
$('build-mode').onclick = () => {
  if (!game.paused) setBuild(!buildMode);
};
$('overview').onclick = () => {
  if (game.paused) return;
  overview = !overview;
  view.overview = overview || buildMode;
  view.resize();
  $('overview').setAttribute('aria-pressed', overview);
};
$('sprint').onclick = () => {
  input.sprint = !input.sprint;
  $('sprint').setAttribute('aria-pressed', input.sprint);
};
function persistReady() {
  if (!resumeChecked || !$('checkpoint-panel').hidden || game.phase !== 'ready') return;
  const data = JSON.stringify(checkpoint(game));
  if (data === saveLast) return;
  try {
    localStorage.setItem(SAVE_KEY, data);
    saveLast = data;
    $('save-status').textContent =
      '已保存第 ' + (game.wave + 1) + ' 波部署。戰鬥中重整會回到這個準備階段。';
  } catch {
    if (!saveError) {
      saveError = true;
      toast('瀏覽器無法保存戰局，關閉分頁可能失去進度');
    }
    $('save-status').textContent = '存檔不可用；請保留此分頁。';
  }
}
function offerCheckpoint() {
  if (resumeChecked) return;
  resumeChecked = true;
  let raw;
  try {
    raw = localStorage.getItem(SAVE_KEY);
  } catch {
    saveError = true;
    toast('瀏覽器未開放存檔，仍可正常遊玩');
    return;
  }
  if (!raw) return;
  try {
    pendingSave = restore(raw);
    $('checkpoint-summary').textContent =
      '第 ' +
      (pendingSave.wave + 1) +
      ' 波準備階段 · 核心 ' +
      pendingSave.health +
      '% · 能源 ' +
      pendingSave.credits +
      '。戰鬥中重整會回到最近部署。';
  } catch {
    pendingSave = null;
    $('checkpoint-summary').textContent =
      '存檔損毀或版本不相容。你可以開始新戰局，原存檔會在選擇後替換。';
    $('continue-game').hidden = true;
  }
  game.paused = true;
  input.clear();
  sound.setPaused(true);
  $('checkpoint-panel').hidden = false;
}
$('continue-game').onclick = () => {
  if (!pendingSave) return;
  view.reset();
  Object.assign(game, pendingSave);
  pendingSave = null;
  game.paused = false;
  game.aimAssist = settings.aimAssist;
  view.follow.set(game.player.x * 0.7, 0, game.player.z * 0.55);
  view.aim = {
    x: game.player.x + Math.sin(game.player.angle) * 8,
    z: game.player.z + Math.cos(game.player.angle) * 8,
  };
  changeWeapon(game.weapon);
  setBuild(false);
  towerDetail();
  $('checkpoint-panel').hidden = true;
  sound.setPaused(false);
  updateUI();
};
$('new-game').onclick = () => {
  pendingSave = null;
  view.reset();
  game.reset();
  game.aimAssist = settings.aimAssist;
  setBuild(false);
  changeWeapon('pulse');
  $('checkpoint-panel').hidden = true;
  sound.setPaused(false);
  saveLast = '';
  persistReady();
  updateUI();
};
window.addEventListener('pagehide', persistReady);
function drawMinimap() {
  const canvas = $('minimap'),
    ctx = canvas.getContext('2d'),
    w = canvas.width,
    h = canvas.height;
  const x = (v) => ((v + 23) / 46) * w,
    z = (v) => ((v + 14) / 28) * h;
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = '#7a8b67';
  ctx.lineWidth = 5;
  ctx.beginPath();
  PATH.forEach((p, i) => (i ? ctx.lineTo(x(p[0]), z(p[1])) : ctx.moveTo(x(p[0]), z(p[1]))));
  ctx.stroke();
  for (const t of game.towers) {
    ctx.fillStyle = '#d8f36a';
    ctx.fillRect(x(t.x) - 2, z(t.z) - 2, 4, 4);
  }
  for (const e of game.enemies) {
    ctx.fillStyle = '#ff9567';
    ctx.fillRect(x(e.x) - 1.5, z(e.z) - 1.5, 3, 3);
  }
  ctx.fillStyle = '#8be6ed';
  ctx.beginPath();
  ctx.arc(x(game.player.x), z(game.player.z), 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#d8f36a';
  ctx.fillRect(x(18) - 3, z(4) - 3, 6, 6);
}

startUpdates(persistReady);
