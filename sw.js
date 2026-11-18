// MicrobeTrace service worker (#194). Lets the app load offline and updates it
// without surprises: a new version is fetched in the background, waits until
// the user agrees (the page asks, then sends SKIP_WAITING), and only then
// replaces the old one. The block below is generated: `npm run cache`.

// BEGIN GENERATED (scripts/build-sw.js)
const CACHE = "microbetrace-37527a08e097";
const PRECACHE = [
  "components/aggregation.html",
  "components/bubbles.html",
  "components/choropleth.html",
  "components/conflicts.html",
  "components/crosstab.html",
  "components/files.html",
  "components/flow_diagram.html",
  "components/gantt.html",
  "components/geo_map.html",
  "components/globe.html",
  "components/heatmap.html",
  "components/histogram.html",
  "components/network.html",
  "components/phylogenetic_tree.html",
  "components/scatterplot.html",
  "components/sequences.html",
  "components/table.html",
  "components/timeline.html",
  "components/waterfall.html",
  "dist/bundle.primary.css",
  "dist/bundle.primary.js",
  "dist/bundle.secondary.css",
  "dist/bundle.secondary.js",
  "dist/versions.json",
  "favicon.ico",
  "fonts/bootstrap-icons.woff",
  "fonts/bootstrap-icons.woff2",
  "humans.txt",
  "img/Molecule.svg",
  "img/android-chrome-192x192.png",
  "img/android-chrome-512x512.png",
  "img/apple-touch-icon.png",
  "img/browserconfig.xml",
  "img/favicon-16x16.png",
  "img/favicon-32x32.png",
  "img/favicon-48x48.png",
  "img/humanstxt-isolated-blank.gif",
  "img/mstile-144x144.png",
  "img/mstile-150x150.png",
  "img/mstile-310x150.png",
  "img/mstile-310x310.png",
  "img/mstile-70x70.png",
  "img/safari-pinned-tab.svg",
  "index.html",
  "manifest.json",
  "src/aligner.js",
  "src/binder.js",
  "src/bootstrap-compat.js",
  "src/common.js",
  "src/d3-compat.js",
  "src/dates.js",
  "src/db.js",
  "src/events.js",
  "src/graph.js",
  "src/index.js",
  "src/main.css",
  "src/nodes.js",
  "src/settings.js",
  "src/webmcp.js",
  "src/webmcp/query.js",
  "src/webmcp/session.js",
  "src/webmcp/style.js",
  "src/webmcp/views.js",
  "vendor/bioseq.min.js",
  "vendor/bx_distance_models.js",
  "vendor/bx_distance_models_bg.wasm",
  "vendor/cosmos.min.js",
  "vendor/papaparse.min.js",
  "vendor/patristic.min.js",
  "vendor/tn93.min.js",
  "workers/align-sw.js",
  "workers/compute-ambiguity-counts.js",
  "workers/compute-consensus-distances.js",
  "workers/compute-consensus.js",
  "workers/compute-directionality.js",
  "workers/compute-links-legacy.js",
  "workers/compute-links.js",
  "workers/compute-mst.js",
  "workers/compute-nn.js",
  "workers/compute-patristic-matrix.js",
  "workers/compute-tree.js",
  "workers/compute-triangulation.js",
  "workers/parse-csv-matrix.js",
  "workers/parse-fasta.js",
  "workers/parse-mega.js",
];
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

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith(PREFIX) && k !== CACHE).map(k => caches.delete(k))))
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
// (e.g. data/) are fetched, then kept for next time.
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
