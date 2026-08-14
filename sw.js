/* Japan 2026 — offline service worker.
   The itinerary has to work in Nyuto, on the Hakkoda road and on Miyakojima,
   where signal quietly dies. Everything is precached on first visit.

   Photographs: only the ones you see immediately - leg banners, the day-trip
   chooser thumbnails and the inline figures - are precached. Every other
   photograph is cached the first time it is actually viewed, by the
   cache-first branch below, so the install stays small and the site still
   ends up fully offline once you have browsed it.

   Strategy:
     - navigations / index.html : network-first, fall back to cache
       (so a redeploy lands next time you have signal, but no signal still works)
     - everything else          : cache-first, refreshed in the background
   Bump CACHE when you redeploy and want clients to drop the old copy.
*/
var CACHE = 'japan2026-v18';
var PRECACHE = [
  './',
  './index.html',
  './config.js',
  './sync.js',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
  './icons/apple-touch-icon.png',
  './photos/tokyo-skyline.jpg',
  './photos/fuji-kawaguchiko.jpg',
  './photos/kyoto-fushimi.jpg',
  './photos/miyako-irabu.jpg',
  './photos/kakunodate-autumn.jpg',
  './photos/hakkoda-odake.jpg',
  './photos/p-chureito.jpg',
  './photos/p-hirosaki.jpg',
  './photos/juniko-aoike.jpg',
  './photos/p-osorezan.jpg',
  './photos/miyako-higashihenna.jpg',
  './photos/tsurunoyu-autumn.jpg',
  './photos/oirase-stream.jpg',
  './photos/nebuta-float.jpg',
  './ui.js'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) { return c.addAll(PRECACHE); })
      .then(function () { return self.skipWaiting(); })
      .catch(function () { /* a missing optional file must not break install */ })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        return k === CACHE ? null : caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Never cache the checklist API. It is same-origin, so without this it would
  // fall into the cache-first branch below and every phone would show a frozen
  // copy of the ticks. It must be live or fail honestly.
  if (url.pathname.indexOf('/.netlify/') === 0) return;

  var isPage = req.mode === 'navigate' ||
               (req.headers.get('accept') || '').indexOf('text/html') !== -1;

  if (isPage) {
    e.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put('./index.html', copy); });
        return res;
      }).catch(function () {
        return caches.match('./index.html').then(function (hit) {
          return hit || caches.match('./');
        });
      })
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(function (hit) {
      if (hit) {
        // A cached photograph is final — the file behind a given name never
        // changes, so re-fetching it would burn roaming data for nothing.
        // Code and everything else does get refreshed quietly in the
        // background while the cached copy is served now.
        if (url.pathname.indexOf('/photos/') === -1) {
          fetch(req).then(function (res) {
            if (res && res.ok) caches.open(CACHE).then(function (c) { c.put(req, res); });
          }).catch(function () {});
        }
        return hit;
      }
      return fetch(req).then(function (res) {
        if (res && res.ok && res.type === 'basic') {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      });
    })
  );
});

// Lets the page trigger an immediate update after a redeploy.
self.addEventListener('message', function (e) {
  if (e.data === 'skip-waiting') self.skipWaiting();
});
