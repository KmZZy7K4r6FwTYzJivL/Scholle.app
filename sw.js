const CACHE_NAME = 'schorle-teller-v12';
const ASSETS = [
  './',
  './index.html',
  './stats.html',
  './css/style.css',
  './js/app.js',
  './js/group.js',
  './js/i18n.js',
  './js/stats.js',
  './js/charts.js',
  './js/supabase-config.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      // 'reload' omzeilt de HTTP-cache van de browser, anders kan een nieuwe
      // versie alsnog met oude bestanden gevuld worden.
      cache.addAll(ASSETS.map(url => new Request(url, { cache: 'reload' })))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Alleen onze eigen app-bestanden cachen voor offline gebruik. Alles van
  // buiten dit origin (o.a. de Supabase-API, lettertypen, browser-extensies)
  // gaat altijd rechtstreeks naar het netwerk — anders zou groepsdata
  // (tellingen, tussenstand) vast blijven zitten op een verouderd antwoord.
  if (url.origin !== self.location.origin || event.request.method !== 'GET') {
    event.respondWith(fetch(event.request));
    return;
  }

  // Network-first: online altijd de nieuwste versie (zodat nieuwe en oude
  // bestanden nooit door elkaar lopen), offline terugvallen op de cache.
  event.respondWith(
    fetch(event.request, { cache: 'no-cache' })
      .then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request, { ignoreSearch: true }))
  );
});
