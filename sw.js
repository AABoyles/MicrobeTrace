// MicrobeTrace service worker (#194). Lets the app load offline and updates it
// without surprises: a new version is fetched in the background, waits until
// the user agrees (the page asks, then sends SKIP_WAITING), and only then
// replaces the old one. The block below is generated: `npm run cache`.

// BEGIN GENERATED (scripts/build-sw.js)
const CACHE = "microbetrace-6f0b50616621";
const PRECACHE = [
  "components/aggregation.html",
  "components/aggregation.js",
  "components/bubbles.html",
  "components/bubbles.js",
  "components/choropleth.html",
  "components/choropleth.js",
  "components/conflicts.html",
  "components/conflicts.js",
  "components/crosstab.html",
  "components/crosstab.js",
  "components/files.html",
  "components/files.js",
  "components/flow_diagram.html",
  "components/flow_diagram.js",
  "components/gantt.html",
  "components/gantt.js",
  "components/geo_map.html",
  "components/geo_map.js",
  "components/globe.html",
  "components/globe.js",
  "components/heatmap.html",
  "components/heatmap.js",
  "components/histogram.html",
  "components/histogram.js",
  "components/network.html",
  "components/network.js",
  "components/phylogenetic_tree.html",
  "components/phylogenetic_tree.js",
  "components/scatterplot.html",
  "components/scatterplot.js",
  "components/sequences.html",
  "components/sequences.js",
  "components/table.html",
  "components/table.js",
  "components/timeline.html",
  "components/timeline.js",
  "components/waterfall.html",
  "components/waterfall.js",
  "dist/bundle.pdf.js",
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
  "src/https.js",
  "src/index.js",
  "src/main.css",
  "src/nodes.js",
  "src/session-format.js",
  "src/settings.js",
  "src/theme.js",
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
  "workers/parse-links.js",
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
