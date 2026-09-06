const BUILD = __SW_META__;
const PRECACHE = __SW_ASSETS__;
const BASE = new URL('./', self.location.href);
const PREFIX = 'deadzone:' + BASE.pathname + ':';
const CACHE = PREFIX + BUILD.id;
const HTML = CACHE + ':html';
self.addEventListener('install', (event) => {
  // Hashed application assets only. HTML is never installed into static cache.
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE.map((p) => new URL(p, BASE).href))),
  );
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Keep one previous asset generation for tabs still running the previous app.
      const keys = (await caches.keys()).filter((k) => k.startsWith(PREFIX));
      const oldAssets = keys.filter((k) => k !== CACHE && !k.endsWith(':html'));
      await Promise.all(
        keys
          .filter((k) => k !== CACHE && k !== HTML && k !== oldAssets.at(-1))
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
      for (const client of await self.clients.matchAll({ type: 'window' }))
        client.postMessage({ type: 'SW_ACTIVATED', build: BUILD });
    })(),
  );
});
self.addEventListener('message', (event) => {
  if (event.data?.type === 'GET_VERSION') event.ports[0]?.postMessage(BUILD);
  if (event.data?.type === 'SKIP_WAITING' && event.data.id === BUILD.id) self.skipWaiting();
});
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request, { cache: 'no-cache' });
    if (response.ok && response.type === 'basic') await cache.put(request, response.clone());
    return response;
  } catch {
    return (await cache.match(request)) || Response.error();
  }
}
self.addEventListener('fetch', (event) => {
  const request = event.request,
    url = new URL(request.url);
  if (
    request.method !== 'GET' ||
    url.origin !== BASE.origin ||
    !url.pathname.startsWith(BASE.pathname)
  )
    return;
  const relative = url.pathname.slice(BASE.pathname.length);
  if (relative === 'version.json' || relative === 'sw.js') {
    event.respondWith(fetch(request, { cache: 'no-store' }));
    return;
  }
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, HTML));
    return;
  }
  if (/^assets\/.*-[\w-]+\.(js|css)$/.test(relative)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        const hit = await cache.match(request);
        if (hit) return hit;
        for (const key of await caches.keys()) {
          if (key.startsWith(PREFIX) && !key.endsWith(':html')) {
            const previous = await (await caches.open(key)).match(request);
            if (previous) return previous;
          }
        }
        const response = await fetch(request);
        if (response.ok && response.type === 'basic') await cache.put(request, response.clone());
        return response;
      })(),
    );
  } else if (/^(models\/|icons\/)|\.(png|svg|ico|webmanifest)$/.test(relative)) {
    event.respondWith(networkFirst(request, CACHE));
  }
});
