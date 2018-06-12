self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open('v1').then(function(cache) {
      return cache.addAll([
        'index.html',
        'stylesheets/main.css',
        'components/2d_network.html',
        'components/3d_network.html',
        'components/files.html',
        'components/flow_diagram.html',
        'components/geo_map.html',
        'components/heatmap.html',
        'components/help.html',
        'components/histogram.html',
        'components/phylogenetic_tree.html',
        'components/scatterplot.html',
        'components/sequences.html',
        'components/table.html',
        'components/timeline.html',
        'scripts/align-nbeam.js',
        'scripts/align-sw.js',
        'scripts/common.js',
        'scripts/compute-consensus.js',
        'scripts/compute-dm.js',
        'scripts/compute-links.js',
        'scripts/compute-mst.js',
        'scripts/polyfills.js',
        'vendor/3d-force-graph.min.js',
        'vendor/bootstrap-filestyle.min.js',
        'vendor/FileSaver.min.js',
        'vendor/neighbor-joining.js',
        'vendor/ntseq.js',
        'vendor/shpwrite.js',
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
        'node_modules/underscore/underscore-min.js',
        'node_modules/udc/udc.js',
        'node_modules/vue/dist/vue.min.js',
        'node_modules/jquery/dist/jquery.min.js',
        'node_modules/popper.js/dist/umd/popper.min.js',
        'node_modules/bootstrap/dist/js/bootstrap.min.js',
        'node_modules/golden-layout/dist/goldenlayout.min.js',
        'node_modules/papaparse/papaparse.min.js',
        'node_modules/xss/dist/xss.min.js',
        'node_modules/d3/dist/d3.min.js',
        'node_modules/plotly.js/dist/plotly.min.js',
        'node_modules/alertifyjs/build/alertify.min.js',
        'node_modules/html2canvas/dist/html2canvas.min.js',
        'node_modules/screenfull/dist/screenfull.js',
        'node_modules/clipboard/dist/clipboard.min.js',
        'node_modules/chosen-js/chosen.jquery.min.js',
        'node_modules/alignment-viewer/dist/alignment-viewer.min.js',
        'node_modules/d3-force-attract/dist/d3-force-attract.min.js',
        'node_modules/d3-symbol-extra/build/d3-symbol-extra.min.js',
        'node_modules/d3-force-3d/build/d3-force-3d.min.js',
        'node_modules/d3-sankey/build/d3-sankey.min.js',
        'node_modules/phylocanvas/dist/phylocanvas.min.js',
        'node_modules/msa/dist/msa.js',
        'node_modules/vis/dist/vis.min.js',
        'node_modules/moment/min/moment-with-locales.min.js',
        'node_modules/bootstrap/dist/css/bootstrap.min.css',
        'node_modules/golden-layout/src/css/goldenlayout-base.css',
        'node_modules/golden-layout/src/css/goldenlayout-light-theme.css',
        'node_modules/vis/dist/vis.min.css',
        'node_modules/chosen-js/chosen.css',
        'node_modules/alertifyjs/build/css/alertify.min.css',
        'node_modules/open-iconic/font/css/open-iconic-bootstrap.min.css',
        'node_modules/bootstrap/dist/css/bootstrap.min.css',
        'node_modules/alertifyjs/build/css/alertify.min.css',
        'node_modules/msa/css/msa.css',
        'data/cities.json',
        'data/counties.json',
        'data/countries.json',
        'data/labels.json',
        'data/states.json',
        'data/tracts.json',
        'data/zipcodes.json',
        'node_modules/chosen-js/chosen-sprite.png',
        'node_modules/open-iconic/font/fonts/open-iconic.woff',
        'node_modules/open-iconic/font/fonts/open-iconic.ttf',
        'node_modules/open-iconic/font/fonts/open-iconic.otf',
        'node_modules/papaparse/papaparse.min.js?papaworker'
      ]);
    })
  );
});

self.addEventListener('fetch', function(event) {
  event.respondWith(caches.match(event.request).then(function(response) {
    // caches.match() always resolves
    // but in case of success response will have value
    if(response !== undefined) return response;
    return fetch(event.request).then(function(response){
      // response may be used only once
      // we need to save clone to put one copy in cache
      // and serve second one
      let responseClone = response.clone();
      caches.open('v1').then(function (cache) {
        cache.put(event.request, responseClone);
      });
      return response;
    });
  }).catch(function(e){
    console.error(e);
  }));
});
