/* Japan 2026 — offline service worker.
   The itinerary has to work in Nyuto, on the Hakkoda road and on Miyakojima,
   where signal quietly dies. Everything is precached on first visit.

   Strategy:
     - navigations / index.html : network-first, fall back to cache
       (so a redeploy lands next time you have signal, but no signal still works)
     - everything else          : cache-first, refreshed in the background
   Bump CACHE when you redeploy and want clients to drop the old copy.
*/
var CACHE = 'japan2026-v17';
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
  './photos/miyako-irabu.jpg',
  './photos/miyako-higashihenna.jpg',
  './photos/kakunodate-autumn.jpg',
  './photos/tsurunoyu-autumn.jpg',
  './photos/komagatake-summit.jpg',
  './photos/oirase-stream.jpg',
  './photos/hakkoda-odake.jpg',
  './photos/towada-lake.jpg',
  './photos/juniko-aoike.jpg',
  './photos/nebuta-float.jpg',
  './photos/fuji-kawaguchiko.jpg',
  './photos/kyoto-fushimi.jpg',
  './photos/nyuto-onsen.jpg',
  './photos/p-yabiji.jpg',
  './photos/p-sunayama.jpg',
  './photos/p-yoshino.jpg',
  './photos/p-kurima.jpg',
  './photos/p-ikema.jpg',
  './photos/p-maehama.jpg',
  './photos/p-dakigaeri.jpg',
  './photos/p-tazawako.jpg',
  './photos/p-aspite.jpg',
  './photos/p-oyasukyo.jpg',
  './photos/p-bukeyashiki.jpg',
  './photos/p-kabazaiku.jpg',
  './photos/p-aoyagi.jpg',
  './photos/p-iwaki.jpg',
  './photos/p-anmon.jpg',
  './photos/p-sukayu.jpg',
  './photos/p-aoni.jpg',
  './photos/p-hirosaki.jpg',
  './photos/p-chureito.jpg',
  './photos/p-kiyomizu.jpg',
  './photos/p-kiritanpo.jpg',
  './photos/p-inaniwa.jpg',
  './photos/p-nokkedon.jpg',
  './photos/p-omatuna.jpg',
  './photos/p-awamori.jpg',
  './photos/p-apple.jpg',
  './photos/p-shamisen.jpg',
  './photos/p-teamlab.jpg',
  './photos/p-shibuyasky.jpg',
  './photos/p-kabukiza.jpg',
  './photos/p-osorezan.jpg',
  './photos/p-sannai.jpg',
  './photos/p-toriike.jpg',
  './photos/p-afactory.jpg',
  './photos/p-senbeijiru.jpg',
  './photos/p-hinai.jpg',
  './photos/p-miyakosoba.jpg',
  './photos/p-shibuyacross.jpg',
  './photos/p-tsukiji.jpg',
  './photos/p-omoide.jpg',
  './photos/p-sumo.jpg',
  './photos/u-hakka-pass.jpg',
  './photos/u-hotate-kaiyaki-miso.jpg',
  './photos/u-jogakura-ohashi.jpg',
  './photos/u-tsuta-numa.jpg',
  './photos/u-fujizakura-beer.jpg',
  './photos/u-lake-tazawa-loop.jpg',
  './photos/u-route-341-akita.jpg',
  './photos/u-sake-akita.jpg',
  './photos/u-yamai-ryori.jpg',
  './photos/u-clear-sup.jpg',
  './photos/u-sea-turtle-snorkel.jpg',
  './photos/u-yukishio-salt-museum.jpg',
  './photos/u-17-end-beach.jpg',
  './photos/u-painagama-beach.jpg',
  './photos/u-pumpkin-rock.jpg',
  './photos/u-stargazing-miyako.jpg',
  './photos/u-toguchi-no-hama.jpg',
  './photos/u-nakanoshima-channel.jpg',
  './photos/u-wonderful-cave.jpg',
  './photos/u-umibudo.jpg',
  './photos/u-akasaka-backstreets.jpg',
  './photos/u-baseball-japan-series.jpg',
  './photos/u-depachika-ekiben.jpg',
  './photos/u-street-go-karting.jpg',
  './ui.js',
  './photos/nebuta-float.jpg'
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
        // refresh quietly for next time, but serve the cached copy now
        fetch(req).then(function (res) {
          if (res && res.ok) caches.open(CACHE).then(function (c) { c.put(req, res); });
        }).catch(function () {});
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
