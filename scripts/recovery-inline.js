(() => {
  const base = new URL('./', location.href),
    flag = 'deadzone:chunk-recovery:' + base.pathname;
  let working = false;
  function notice(message) {
    let box = document.getElementById('chunk-recovery');
    if (!box) {
      box = document.createElement('section');
      box.id = 'chunk-recovery';
      box.setAttribute('role', 'alert');
      box.style.cssText =
        'position:fixed;inset:auto 12px 20px;z-index:99999;margin:auto;max-width:420px;padding:20px;background:#172118;color:#eff2e5;border:1px solid #d8f36a;font:15px/1.6 system-ui';
      document.body.appendChild(box);
    }
    box.textContent = message;
    return box;
  }
  async function recover() {
    if (working || !navigator.onLine) return;
    working = true;
    let attempted = true;
    try {
      attempted = sessionStorage.getItem(flag) === '1';
      sessionStorage.setItem(flag, '1');
    } catch {}
    if (attempted) {
      const box = notice('遊戲程式暫時無法載入。請檢查網路，稍後再試。');
      const button = document.createElement('button');
      button.textContent = '重新載入';
      button.onclick = () => location.reload();
      box.appendChild(button);
      return;
    }
    notice('網站版本已變更，正在同步遊戲程式…');
    try {
      if ('serviceWorker' in navigator)
        for (const reg of await navigator.serviceWorker.getRegistrations())
          if (reg.scope === base.href) await reg.unregister();
      if ('caches' in window)
        for (const key of await caches.keys())
          if (key.startsWith('deadzone:' + base.pathname + ':')) await caches.delete(key);
    } catch {}
    setTimeout(() => location.reload(), 1200);
  }
  function handle(event) {
    const message = event.reason?.message || event.message || event.payload?.message || '';
    if (
      /Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed|ChunkLoadError/i.test(
        message,
      )
    ) {
      event.preventDefault();
      recover();
    } else if (event.target?.tagName === 'SCRIPT' && event.target.type === 'module') {
      const url = new URL(event.target.src, base);
      if (url.origin === base.origin && url.pathname.startsWith(base.pathname + 'assets/'))
        fetch(url, { cache: 'no-store' })
          .then((r) => {
            if (r.status === 404) recover();
          })
          .catch(() => {});
    }
  }
  window.addEventListener('error', handle, true);
  window.addEventListener('unhandledrejection', handle);
  window.addEventListener('vite:preloadError', handle);
})();
