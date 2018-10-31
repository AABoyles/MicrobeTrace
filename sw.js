var CACHE = 'MicrobeTraceD2018-10-31';

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE).then(function(cache) {
      return cache.addAll([
        'components/2d_network.html',
        'components/3d_network.html',
        'components/auditor.html',
        'components/bubbles.html',
        'components/files.html',
        'components/flow_diagram.html',
        'components/gantt.html',
        'components/geo_map.html',
        'components/heatmap.html',
        'components/help.html',
        'components/histogram.html',
        'components/phylogenetic_tree.html',
        'components/scatterplot.html',
        'components/sequences.html',
        'components/table.html',
        'components/timeline.html',
        'components/waterfall.html',
        'scripts/align-nbeam.js',
        'scripts/align-sw.js',
        'scripts/common.js',
        'scripts/compute-consensus-distances.js',
        'scripts/compute-consensus.js',
        'scripts/compute-dm.js',
        'scripts/compute-links.js',
        'scripts/compute-nn.js',
        'scripts/compute-patristic-matrix.js',
        'scripts/compute-tree.js',
        'scripts/polyfills.js',
        'node_modules/underscore/underscore-min.js',
        'node_modules/tn93/dist/tn93.min.js',
        'node_modules/vue/dist/vue.min.js',
        'node_modules/jquery/dist/jquery.min.js',
        'node_modules/popper.js/dist/umd/popper.min.js',
        'node_modules/bootstrap/dist/js/bootstrap.min.js',
        'node_modules/golden-layout/dist/goldenlayout.min.js',
        'node_modules/papaparse/papaparse.min.js',
        'node_modules/xss/dist/xss.min.js',
        'node_modules/d3/dist/d3.min.js',
        'node_modules/d3-force-attract/dist/d3-force-attract.min.js',
        'node_modules/d3-symbol-extra/build/d3-symbol-extra.min.js',
        'node_modules/plotly.js/dist/plotly.min.js',
        'node_modules/alertifyjs/build/alertify.min.js',
        'node_modules/html2canvas/dist/html2canvas.min.js',
        'node_modules/screenfull/dist/screenfull.js',
        'node_modules/clipboard/dist/clipboard.min.js',
        'node_modules/3d-force-graph/dist/3d-force-graph.min.js',
        'node_modules/leaflet/dist/leaflet.js',
        'node_modules/chosen-js/chosen.jquery.min.js',
        'node_modules/xlsx/dist/xlsx.full.min.js',
        'node_modules/alignment-viewer/dist/alignment-viewer.min.js',
        'node_modules/moment/min/moment-with-locales.min.js',
        'node_modules/d3-sankey/build/d3-sankey.min.js',
        'node_modules/marked/marked.min.js',
        'node_modules/bioseq/dist/bioseq.min.js',
        'vendor/FileSaver.min.js',
        'vendor/bootstrap-filestyle.min.js',
        'vendor/d3.v3.min.js',
        'vendor/neighbor-joining.js',
        'vendor/ntseq.js',
        'vendor/phylotree.js',
        'vendor/shpwrite.js',
        'stylesheets/main.css',
        'node_modules/bootstrap/dist/css/bootstrap.min.css',
        'node_modules/golden-layout/src/css/goldenlayout-base.css',
        'node_modules/golden-layout/src/css/goldenlayout-light-theme.css',
        'node_modules/chosen-js/chosen.css',
        'node_modules/alertifyjs/build/css/alertify.min.css',
        'node_modules/open-iconic/font/css/open-iconic-bootstrap.min.css',
        'node_modules/leaflet/dist/leaflet.css',
        'img/1DNA.gif',
        'img/Back_Arrow.png',
        'img/icon.ico',
        'img/image128.ico',
        'img/image128.png',
        'img/image16.ico',
        'img/image16.png',
        'img/image200.ico',
        'img/image200.png',
        'img/image256.ico',
        'img/image256.png',
        'img/image32.ico',
        'img/image32.png',
        'img/image64.ico',
        'img/image64.png',
        'img/spinner.gif',
        'data/counties.json',
        'data/countries.json',
        'data/states.json',
        'data/tracts.json',
        'data/zipcodes.json',
        'help/3D-Network.md',
        'help/Acknowledgements.md',
        'help/Alignment.md',
        'help/Bubbles.md',
        'help/Contributing.md',
        'help/Distance-Matrices.md',
        'help/Distance-Metrics.md',
        'help/Edge-CSVs.md',
        'help/FASTA-Files.md',
        'help/Flow-Diagram.md',
        'help/Heatmap.md',
        'help/Histogram.md',
        'help/Home.md',
        'help/Inputs.md',
        'help/Installation.md',
        'help/Internet-Explorer.md',
        'help/Loading-Files.md',
        'help/Map.md',
        'help/MicrobeTrace-and-its-Alternatives.md',
        'help/Network-View.md',
        'help/Node-CSVs.md',
        'help/Offline-Usage.md',
        'help/References.md',
        'help/SNPs.md',
        'help/Security.md',
        'help/Sequences.md',
        'help/Suspicious-Network-Topologies.md',
        'help/System-Requirements.md',
        'help/Table.md',
        'help/Theory.md',
        'help/Tile-Maps.md',
        'help/Troubleshooting.md',
        'help/_Footer.md',
        'help/z-Create-a-New-View.md',
        'help/z-Deployment.md',
        'help/z-Development.md',
        'help/z-Nomenclature.md',
        'help/z-Unwritten-Documentation-Requirements.md',
        'package.json',
        'manifest.json',
        'node_modules/chosen-js/chosen-sprite.png',
        'node_modules/open-iconic/font/fonts/open-iconic.woff',
        'node_modules/open-iconic/font/fonts/open-iconic.ttf',
        'node_modules/open-iconic/font/fonts/open-iconic.otf',
        'node_modules/papaparse/papaparse.min.js?papaworker',
      ]);
    })
  );
});

self.addEventListener('fetch', function(event) {
  if (event.request.cache === 'only-if-cached' && event.request.mode !== 'same-origin') return;
  event.respondWith(fromCache(event.request));
  event.waitUntil(update(event.request));
});

// Open the cache where the assets were stored and search for the requested
// resource. Notice that in case of no matching, the promise still resolves
// but it does with  as value.
function fromCache(request){
  return caches.open(CACHE).then(function(cache){
    return cache.match(request).then(function(matching){
      return matching || Promise.reject('No match for ' + request.url);
    });
  });
}

// Update consists in opening the cache, performing a network request and
// storing the new response data.
function update(request){
  return caches.open(CACHE).then(function(cache){
    return fetch(request).then(function(response){
      return cache.put(request, response);
    }).catch(function(error){
      //console.error(error + ' ' + request.url);
    });
  });
}

