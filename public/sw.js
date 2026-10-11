/* Service worker mínimo: permite instalar o app e guarda só arquivos com hash (nunca dados). */
const CACHE = "zure-assets-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== self.location.origin || !url.pathname.startsWith("/assets/")) return;
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const salvo = await cache.match(e.request);
      if (salvo) return salvo;
      const resp = await fetch(e.request);
      if (resp.ok) cache.put(e.request, resp.clone());
      return resp;
    }),
  );
});
