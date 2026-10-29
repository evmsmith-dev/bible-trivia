const CACHE_NAME = "bible-trivia-cache-v1.9.108";

const ASSETS_TO_CACHE = [
  "./",
  "index.html",
  "manifest.json",
  "vendor/confetti.browser.min.js",
  "vendor/fonts/fredoka.css",
  "vendor/fonts/fredoka-latin-400-normal.woff2",
  "vendor/fonts/fredoka-latin-500-normal.woff2",
  "vendor/fonts/fredoka-latin-600-normal.woff2",
  "vendor/fonts/fredoka-latin-700-normal.woff2",
  "src/storage/keys.min.js",
  "src/storage/key-value-store.min.js",
  "src/storage/fallback-store.min.js",
  "src/storage/db-manager.min.js",
  "src/storage/profile-store.min.js",
  "src/core/runtime-constants.min.js",
  "src/core/runtime-engine.min.js",
  "src/core/runtime-utils.min.js",
  "src/data/questions-bank.min.js",
  "src/data/fallback-questions.min.js",
  "src/data/runtime-questions.min.js",
  "src/app-runtime.min.js",
  "src/main.min.js",
  "src/ui/styles.min.css",
  "src/ui/runtime-ui.min.js",
  "src/features/player/runtime-player.min.js",
  "src/features/daily/runtime-daily.min.js",
  "src/features/leaderboard/runtime-leaderboard.min.js",
  "icons/apple-touch-icon.png",
  "icons/bibletrivia_x192.png",
  "icons/bibletrivia_icon_x512.png",
  "icons/avatars/dove.svg",
  "icons/avatars/crown.svg",
  "icons/avatars/shield.svg",
  "icons/avatars/star.svg",
  "icons/avatars/olive-branch.svg",
  "icons/avatars/lamb.svg",
  "icons/avatars/fish.svg",
  "icons/avatars/scroll.svg",
  "icons/avatars/ark.svg",
  "icons/avatars/lyre.svg",
  "icons/avatars/lamp.svg",
  "icons/avatars/lion.svg",
  "icons/avatars/rainbow.svg",
  "icons/avatars/mountain.svg",
  "icons/avatars/anchor.svg",
  "icons/avatars/sunflower.svg"
];

// Install: cache core assets. `cache: "reload"` bypasses the HTTP cache so a new
// version never precaches stale copies. The new worker then waits until the page
// asks it to take over (see SKIP_WAITING below), so players are never switched mid-game.
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      cache.addAll(ASSETS_TO_CACHE.map(url => new Request(url, { cache: "reload" })))
    )
  );
});

self.addEventListener("message", event => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// Activate: clean old caches
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

// Fetch: cache first, then network. Only page navigations fall back to index.html.
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request, { ignoreSearch: event.request.mode === "navigate" }).then(cached => {
      if (cached) return cached;
      return fetch(event.request).catch(() => {
        if (event.request.mode === "navigate") return caches.match("index.html");
        return Response.error();
      });
    })
  );
});
