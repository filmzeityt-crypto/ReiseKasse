// Reisekasse — minimal offline cache. Bump CACHE_NAME whenever these files
// change so returning visitors pick up the update instead of a stale copy.
var CACHE_NAME = "tripcash-cache-v25";
var CORE_ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./ui.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(CORE_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE_NAME; }).map(function (k) { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", function (event) {
  var url = event.request.url;

  // Live-Daten nie cachen: Wechselkurs-API und Firebase-Sync müssen immer
  // frisch übers Netz gehen.
  if (url.indexOf("frankfurter.app") !== -1) return;
  if (url.indexOf("firebasedatabase.app") !== -1 || url.indexOf("firebaseio.com") !== -1) return;

  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then(function (cached) {
      var networkFetch = fetch(event.request)
        .then(function (response) {
          if (response && response.ok && event.request.method === "GET") {
            var copy = response.clone();
            caches.open(CACHE_NAME).then(function (cache) { cache.put(event.request, copy); });
          }
          return response;
        })
        .catch(function () { return cached; });
      return cached || networkFetch;
    })
  );
});
