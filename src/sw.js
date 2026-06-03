// Service worker della Meteo-app (PWA).
// Strategia:
//  - app shell (file locali): cache-first, così l'app si apre anche offline;
//  - chiamate alle API Open-Meteo (origine diversa): solo rete (servono dati freschi).
// Per pubblicare nuove versioni dei file basta incrementare CACHE.

const CACHE = "meteo-app-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
  "./icons/favicon-32.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((chiavi) =>
        Promise.all(chiavi.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  // Le API meteo (altra origine) devono andare sempre in rete: niente cache.
  if (url.origin !== self.location.origin) return;

  // App shell: prima la cache, poi la rete come fallback.
  e.respondWith(
    caches.match(e.request).then((risp) => risp || fetch(e.request))
  );
});
