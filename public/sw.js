/* Devan Family Meals — service worker.
 * Goal: the grocery list (and the rest of the app) stays readable in a store
 * with bad reception. Strategy:
 *  - API GETs   → network-first, fall back to last cached copy
 *  - static     → stale-while-revalidate
 *  - navigation → network-first, fall back to cached page shell
 * Mutations (POST/PATCH/DELETE) always require the network.
 */
const CACHE = "meals-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.startsWith("/api/auth")) return;

  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirst(req));
  } else if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/")
  ) {
    event.respondWith(staleWhileRevalidate(req));
  } else if (req.mode === "navigate") {
    event.respondWith(networkFirst(req));
  }
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    const fresh = await fetch(req);
    if (fresh.ok) cache.put(req, fresh.clone());
    return fresh;
  } catch {
    const cached = await cache.match(req);
    if (cached) return cached;
    throw new Error("offline and not cached");
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(req);
  const refresh = fetch(req)
    .then((fresh) => {
      if (fresh.ok) cache.put(req, fresh.clone());
      return fresh;
    })
    .catch(() => cached);
  return cached ?? refresh;
}
