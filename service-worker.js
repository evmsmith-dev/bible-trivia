const CACHE_NAME = "bible-trivia-cache-v1.9.105";

const ASSETS_TO_CACHE = [
  "index.html",
  "manifest.json",
  "service-worker.js",
  "src/storage/keys.js",
  "src/storage/key-value-store.js",
  "src/storage/fallback-store.js",
  "src/storage/db-manager.js",
  "src/storage/profile-store.js",
  "src/core/runtime-constants.js",
  "src/core/runtime-state.js",
  "src/core/runtime-engine.js",
  "src/core/runtime-utils.js",
  "src/data/questions-bank-generated.js",
  "src/data/questions-bank.js",
  "src/data/fallback-questions.js",
  "src/data/runtime-questions.js",
  "src/app-runtime.js",
  "src/main.js",
  "src/ui/styles.css",
  "src/ui/runtime-ui.js",
  "src/features/player/runtime-player.js",
  "src/features/daily/runtime-daily.js",
  "src/features/leaderboard/runtime-leaderboard.js",
  "icons/bibletrivia_x192.png",
  "icons/bibletrivia_icon.png",
  "icons/bibletrivia_icon_x96.png",
  "icons/bibletrivia_icon_x128.png",
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
  "icons/avatars/sunflower.svg",
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