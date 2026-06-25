// 531+ service worker — minimal, safe, offline-first for the app shell.
// IMPORTANT: this intentionally does NOT try to be clever about caching
// the CDN scripts (React/ReactDOM/Chart.js). Those are network-first with
// a cache fallback, so a flaky gym wifi won't break the app, but we also
// never risk serving a broken/half-cached script that crashes the page.
//
// Paths below are RELATIVE on purpose — this app is often hosted under a
// GitHub Pages project subpath (e.g. /531Plus/), not the domain root.

var CACHE_NAME = "531plus-shell-v2";
var SHELL_FILES = [
  "./",
  "./index.html",
  "./manifest.json"
];

self.addEventListener("install", function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(SHELL_FILES);
    }).catch(function(){ /* never block install on a cache miss */ })
  );
  self.skipWaiting();
});

self.addEventListener("activate", function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k){ return k !== CACHE_NAME; })
            .map(function(k){ return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", function(event) {
  var req = event.request;

  // Only handle GET requests; let everything else (e.g. POST) pass through untouched.
  if (req.method !== "GET") return;

  var url = new URL(req.url);
  var isSameOrigin = url.origin === self.location.origin;

  if (isSameOrigin) {
    // App shell: cache-first, so the app still opens with no signal at all.
    event.respondWith(
      caches.match(req).then(function(cached) {
        if (cached) return cached;
        return fetch(req).then(function(res) {
          var resClone = res.clone();
          caches.open(CACHE_NAME).then(function(cache){ cache.put(req, resClone); });
          return res;
        }).catch(function() {
          // Last resort: if index.html itself was requested and nothing is cached,
          // there's nothing we can do offline on first-ever load.
          return caches.match("./index.html");
        });
      })
    );
  } else {
    // Third-party CDN scripts (React, Chart.js, etc): network-first.
    // Falls back to cache only if the network truly fails, so we always
    // prefer the freshest, correctly-ordered script load when online.
    event.respondWith(
      fetch(req).then(function(res) {
        var resClone = res.clone();
        caches.open(CACHE_NAME).then(function(cache){ cache.put(req, resClone); });
        return res;
      }).catch(function() {
        return caches.match(req);
      })
    );
  }
});

