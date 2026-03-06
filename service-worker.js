const CACHE_NAME = "bible-trivia-cache-v1";

const ASSETS_TO_CACHE = [
  "index.html",
  "manifest.json",
  "service-worker.js",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&display=swap",
  "https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.3/dist/confetti.browser.min.js"
];

// Install: cache core assets
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS_TO_CACHE))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch: serve from cache, fallback to network
self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(cached => {
      return (
        cached ||
        fetch(event.request).catch(() =>
          caches.match("index.html")
        )
      );
    })
  );
});