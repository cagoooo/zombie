import { isNewer } from './version.js';
const APP = __BUILD_META__;
document.querySelector('#app-version').textContent = 'v' + APP.version;
document.querySelector('#copyright-year').textContent = new Date().getFullYear();
export function startUpdates(beforeReload) {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  const base = new URL(import.meta.env.BASE_URL, document.baseURI);
  let registration,
    announced = '',
    offered,
    applying = false,
    reloaded = false;
  const card = document.querySelector('#update-card'),
    status = document.querySelector('#update-message');
  const button = document.querySelector('#apply-update');
  function getVersion(worker) {
    if (!worker) return Promise.resolve(null);
    return new Promise((resolve) => {
      const channel = new MessageChannel();
      const finish = (data) => {
        clearTimeout(timer);
        channel.port1.close();
        resolve(data);
      };
      const timer = setTimeout(() => finish(null), 2000);
      channel.port1.onmessage = (e) => finish(e.data);
      try {
        worker.postMessage({ type: 'GET_VERSION' }, [channel.port2]);
      } catch {
        finish(null);
      }
    });
  }
  function reveal(build, text) {
    if (applying || announced === build.id) return;
    announced = build.id;
    offered = build;
    status.textContent =
      text || 'v' + build.version + '：' + (build.notes || '遊戲內容與穩定性更新。');
    card.hidden = false;
  }
  async function inspect() {
    const worker = registration?.waiting;
    if (!worker || !navigator.serviceWorker.controller || applying) return;
    const [next, active] = await Promise.all([getVersion(worker), getVersion(registration.active)]);
    if (worker !== registration.waiting || !next || isNewer(APP, next)) return;
    if (next.id !== APP.id && !isNewer(next, APP)) return;
    if (active && !isNewer(next, active)) return;
    reveal(next);
  }
  async function check() {
    if (!registration || document.hidden || !navigator.onLine || applying) return;
    try {
      const r = await fetch(new URL('version.json', base), { cache: 'no-store' });
      if (r.ok && isNewer(await r.json(), APP)) await registration.update();
    } catch {
      /* Offline: keep the playable version. */
    }
    await inspect();
  }
  function reloadOnce() {
    if (reloaded) return;
    reloaded = true;
    beforeReload();
    location.reload();
  }
  button.onclick = async () => {
    if (applying) return;
    const worker = registration?.waiting;
    const next = await getVersion(worker);
    const activeVersion = await getVersion(registration?.active);
    if (worker && next && !isNewer(APP, next) && isNewer(next, activeVersion || APP)) {
      applying = true;
      button.disabled = true;
      status.textContent = '正在載入最新版，請稍候…';
      worker.postMessage({ type: 'SKIP_WAITING', id: next.id });
      setTimeout(async () => {
        if (reloaded) return;
        const current = await getVersion(navigator.serviceWorker.controller);
        if (current?.id === next.id) reloadOnce();
        else {
          applying = false;
          button.disabled = false;
          status.textContent = '更新尚未接管，請稍後再試；目前戰局仍保留。';
        }
      }, 10000);
    } else {
      const active = await getVersion(navigator.serviceWorker.controller);
      if (isNewer(active, APP)) {
        applying = true;
        reloadOnce();
      } else {
        status.textContent = '新版仍在準備中，稍後會再檢查。';
        await check();
      }
    }
  };
  document.querySelector('#dismiss-update').onclick = () => {
    card.hidden = true;
  };
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (applying) reloadOnce();
  });
  navigator.serviceWorker.addEventListener('message', (e) => {
    if (e.data?.type !== 'SW_ACTIVATED' || !isNewer(e.data.build, APP)) return;
    if (applying) reloadOnce();
    else reveal(e.data.build, '另一個分頁已更新。重新整理即可使用最新版；你可以先完成這一波。');
  });
  navigator.serviceWorker
    .register(new URL('sw.js', base), { scope: base.href, updateViaCache: 'none' })
    .then((reg) => {
      registration = reg;
      const watch = (worker) =>
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'installed') inspect();
        });
      watch(reg.installing);
      reg.addEventListener('updatefound', () => watch(reg.installing));
      inspect();
      setInterval(check, 180000);
      setInterval(() => {
        if (!document.hidden) reg.update().catch(() => {});
      }, 60000);
      setTimeout(check, 5000);
      for (const name of ['focus', 'online', 'pageshow']) window.addEventListener(name, check);
      document.addEventListener('visibilitychange', check);
    })
    .catch(() => {
      /* Updates are optional; normal online play still works. */
    });
}
