// Xtra TV Pro — service worker
// Bump this on every deploy that changes cached files, so old caches get cleared.
const CACHE_VERSION = "xtvp-v3";

const PRECACHE_URLS = [
  "/",
  "/index.html",
  "/offline.html",
  "/css/app.css",
  "/js/app.js",
  "/svg/logo.svg",
  "/manifest.json",
  "/img/icons/icon-192.png",
  "/img/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only handle same-origin GET requests. Let everything else (Firestore,
  // fonts, streams, cross-origin API calls) go straight to the network.
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) {
    return;
  }

  // Never cache live stream playlists/segments.
  if (/\.(m3u8?|ts)(\?|$)/i.test(request.url)) {
    return;
  }

  // Navigations: network-first, so users always get the latest app shell
  // when online. Channel data is only ever fetched live from Firestore
  // (never cached), so if the network is down, serving the cached app
  // shell alone would just show an empty/broken screen. Show the
  // dedicated offline page instead for a clean, intentional message.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put("/index.html", copy));
          return response;
        })
        .catch(() => caches.match("/offline.html"))
    );
    return;
  }

  // Static assets: cache-first, falling back to network, then updating cache.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});
