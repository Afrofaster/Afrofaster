/* LÍA service worker — offline shell, recent pages, static assets.
 * API responses are never cached. Private page cache is wiped on logout. */
const VERSION = "lia-v1";
const STATIC = `${VERSION}-static`;
const PAGES = `${VERSION}-pages`;
const PRECACHE = ["/offline", "/icon.svg", "/icons/icon-192.png", "/icons/icon-512.png", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "CLEAR_PRIVATE") event.waitUntil(caches.delete(PAGES));
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || url.pathname === "/icon.svg") {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) caches.open(STATIC).then((c) => c.put(req, res.clone()));
            return res;
          }),
      ),
    );
    return;
  }

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const cacheable = res.ok && !res.redirected && !url.pathname.startsWith("/login") && !url.pathname.startsWith("/signup");
          if (cacheable) caches.open(PAGES).then((c) => c.put(url.pathname, res.clone()));
          return res;
        })
        .catch(() => caches.match(url.pathname, { cacheName: PAGES }).then((hit) => hit || caches.match("/offline"))),
    );
  }
});
