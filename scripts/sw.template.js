// MicrobeTrace service worker (#194). Lets the app load offline and updates it
// without surprises: a new version is fetched in the background, waits until
// the user agrees (the page asks, then sends SKIP_WAITING), and only then
// replaces the old one. This file is the template: `npm run cache` (scripts/build-sw.js)
// fills in the block below and writes the result to sw.js, which is not committed (#325).

/* global self, caches, CACHE, PRECACHE -- the last two are filled in by build-sw.js */

// BEGIN GENERATED (scripts/build-sw.js)
// (replaced by `npm run cache`: the cache name and the list of files to precache)
// END GENERATED

const PREFIX = "microbetrace-";
const scope = self.registration.scope;
const INDEX = new URL("index.html", scope).href;

self.addEventListener("install", event => {
  // Bypass the HTTP cache so a stale copy can't be frozen into the new version.
  // No skipWaiting() here: the page offers the reload instead. (With no older
  // worker there is nothing to wait for, so the first install activates at once.)
  event.waitUntil(caches.open(CACHE).then(cache =>
    cache.addAll(PRECACHE.map(url => new Request(new URL(url, scope).href, { cache: "reload" })))));
});

self.addEventListener("message", event => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

// Files cached on first use rather than precached (the map boundaries in data/
// and the demo session in demo/) are carried into the new version's cache
// before the old one goes, so offline use keeps them across updates (#296).
// They are data, not code, so an older copy can't mix versions of the app.
const CARRIED = /\/(data|demo)\//;

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => keys.filter(k => k.startsWith(PREFIX) && k !== CACHE))
      .then(old => caches.open(CACHE).then(cache =>
        Promise.all(old.map(name => caches.open(name).then(previous => previous.keys().then(requests =>
          Promise.all(requests.filter(r => CARRIED.test(new URL(r.url).pathname)).map(r =>
            cache.match(r).then(hit => hit || previous.match(r).then(response => response && cache.put(r, response)))))))))
        .then(() => Promise.all(old.map(k => caches.delete(k))))))
      .then(() => self.clients.claim())
  );
});

// Navigations: app shell. The page comes from the current cache version, like
// every asset it loads, so a reload never mixes a new index.html with old
// scripts (#211). The root URL means index.html; the network is only asked for
// pages that aren't cached. The browser re-fetches sw.js on navigation, which is
// how a new version is found; it then waits for the user (see src/index.js).
// Everything else from this origin: cache first, since the cache holds one
// consistent version (replaced as a whole on update); files not precached
// (data/, demo/) are fetched, then kept for next time and across updates.
self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET" || !request.url.startsWith(self.location.origin)) return;
  if (request.headers.has("range")) return;

  if (request.mode === "navigate") {
    const path = new URL(request.url).pathname;
    const isRoot = path.endsWith("/") || path.endsWith("/index.html");
    event.respondWith(
      caches.open(CACHE).then(cache => cache.match(isRoot ? INDEX : request, { ignoreSearch: true }))
        .then(hit => hit || fetch(request))
    );
    return;
  }

  event.respondWith(
    caches.open(CACHE).then(cache =>
      cache.match(request).then(hit => hit || fetch(request).then(response => {
        if (response.ok && response.type === "basic") cache.put(request, response.clone());
        return response;
      })))
  );
});
