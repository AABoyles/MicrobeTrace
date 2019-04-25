#!/bin/sh

echo 'Assembling Stylesheets...'

rm stylesheets/bundle.css && touch stylesheets/bundle.css
cat node_modules/bootstrap/dist/css/bootstrap.min.css >> stylesheets/bundle.css && printf "\n" >> stylesheets/bundle.css
cat node_modules/bootstrap4-toggle/css/bootstrap4-toggle.css >> stylesheets/bundle.css && printf "\n" >> stylesheets/bundle.css
cat node_modules/golden-layout/src/css/goldenlayout-base.css >> stylesheets/bundle.css && printf "\n" >> stylesheets/bundle.css
cat node_modules/golden-layout/src/css/goldenlayout-light-theme.css >> stylesheets/bundle.css && printf "\n" >> stylesheets/bundle.css
cat node_modules/chosen-js/chosen.css >> stylesheets/bundle.css && printf "\n" >> stylesheets/bundle.css
cat node_modules/alertifyjs/build/css/alertify.min.css >> stylesheets/bundle.css && printf "\n" >> stylesheets/bundle.css
cat node_modules/leaflet/dist/leaflet.css >> stylesheets/bundle.css && printf "\n" >> stylesheets/bundle.css
cat node_modules/leaflet.markercluster/dist/MarkerCluster.css >> stylesheets/bundle.css && printf "\n" >> stylesheets/bundle.css
cat node_modules/leaflet.markercluster/dist/MarkerCluster.Default.css >> stylesheets/bundle.css && printf "\n" >> stylesheets/bundle.css
cat node_modules/tabulator-tables/dist/css/tabulator.min.css >> stylesheets/bundle.css && printf "\n" >> stylesheets/bundle.css
cat node_modules/tabulator-tables/dist/css/bootstrap/tabulator_bootstrap4.min.css >> stylesheets/bundle.css && printf "\n" >> stylesheets/bundle.css
cat stylesheets/main.css >> stylesheets/bundle.css && printf "\n" >> stylesheets/bundle.css

echo 'Copying Unbundlable Dependencies...'

cp node_modules/bioseq/dist/bioseq.min.js vendor/
cp node_modules/patristic/dist/patristic.min.js vendor/
cp node_modules/tn93/dist/tn93.min.js vendor/
cp -r node_modules/open-iconic/font/* vendor/open-iconic/font/

echo 'Assembling Javascript Bundle...'

rm scripts/bundle.js && touch scripts/bundle.js
cat node_modules/underscore/underscore-min.js >> scripts/bundle.js && printf "\n" >> scripts/bundle.js
cat node_modules/jquery/dist/jquery.min.js >> scripts/bundle.js && printf "\n" >> scripts/bundle.js
cat node_modules/popper.js/dist/umd/popper.min.js >> scripts/bundle.js && printf "\n" >> scripts/bundle.js
cat node_modules/bootstrap/dist/js/bootstrap.min.js >> scripts/bundle.js && printf "\n" >> scripts/bundle.js
cat node_modules/bootstrap4-toggle/js/bootstrap4-toggle.js >> scripts/bundle.js && printf "\n" >> scripts/bundle.js
cat node_modules/alertifyjs/build/alertify.min.js >> scripts/bundle.js && printf "\n" >> scripts/bundle.js
cat node_modules/golden-layout/dist/goldenlayout.min.js >> scripts/bundle.js && printf "\n" >> scripts/bundle.js
cat node_modules/chosen-js/chosen.jquery.min.js >> scripts/bundle.js && printf "\n" >> scripts/bundle.js
cat node_modules/fileto/index.js >> scripts/bundle.js && printf "\n" >> scripts/bundle.js
cat node_modules/screenfull/dist/screenfull.js >> scripts/bundle.js && printf "\n" >> scripts/bundle.js
cat node_modules/clipboard/dist/clipboard.min.js >> scripts/bundle.js && printf "\n" >> scripts/bundle.js
cat node_modules/moment/min/moment-with-locales.min.js >> scripts/bundle.js && printf "\n" >> scripts/bundle.js
cat node_modules/papaparse/papaparse.min.js >> scripts/bundle.js && printf "\n" >> scripts/bundle.js
cat node_modules/jszip/dist/jszip.min.js >> scripts/bundle.js && printf "\n" >> scripts/bundle.js
cat node_modules/xlsx/dist/xlsx.core.min.js >> scripts/bundle.js && printf "\n" >> scripts/bundle.js
cat node_modules/xss/dist/xss.min.js >> scripts/bundle.js && printf "\n" >> scripts/bundle.js
cat node_modules/tn93/dist/tn93.min.js >> scripts/bundle.js && printf "\n" >> scripts/bundle.js
cat node_modules/d3/dist/d3.min.js >> scripts/bundle.js && printf "\n" >> scripts/bundle.js
cat node_modules/d3-queue/build/d3-queue.min.js >> scripts/bundle.js && printf "\n" >> scripts/bundle.js
cat node_modules/d3-force-attract/dist/d3-force-attract.min.js >> scripts/bundle.js && printf "\n" >> scripts/bundle.js
cat node_modules/d3-symbol-extra/build/d3-symbol-extra.min.js >> scripts/bundle.js && printf "\n" >> scripts/bundle.js
cat node_modules/versor/build/versor.min.js >> scripts/bundle.js && printf "\n" >> scripts/bundle.js
cat node_modules/html5sortable/dist/html5sortable.min.js >> scripts/bundle.js && printf "\n" >> scripts/bundle.js
cat node_modules/plotly.js/dist/plotly.min.js >> scripts/bundle.js && printf "\n" >> scripts/bundle.js
cat node_modules/tabulator-tables/dist/js/tabulator.min.js >> scripts/bundle.js && printf "\n" >> scripts/bundle.js
cat node_modules/tidytree/dist/tidytree.min.js >> scripts/bundle.js && printf "\n" >> scripts/bundle.js
cat node_modules/3d-force-graph/dist/3d-force-graph.min.js >> scripts/bundle.js && printf "\n" >> scripts/bundle.js
cat node_modules/leaflet/dist/leaflet.js >> scripts/bundle.js && printf "\n" >> scripts/bundle.js
cat node_modules/leaflet.markercluster/dist/leaflet.markercluster.js >> scripts/bundle.js && printf "\n" >> scripts/bundle.js
cat node_modules/leaflet-image/leaflet-image.js >> scripts/bundle.js && printf "\n" >> scripts/bundle.js
cat node_modules/marked/marked.min.js >> scripts/bundle.js && printf "\n" >> scripts/bundle.js
cat node_modules/alignment-viewer/dist/alignment-viewer.min.js >> scripts/bundle.js && printf "\n" >> scripts/bundle.js
cat patches/FileSaver.min.js >> scripts/bundle.js && printf "\n" >> scripts/bundle.js
cat patches/saveSvgAsPng.js >> scripts/bundle.js && printf "\n" >> scripts/bundle.js
cat node_modules/pdfmake/build/pdfmake.min.js >> scripts/bundle.js && printf "\n" >> scripts/bundle.js
cat node_modules/pdfmake/build/vfs_fonts.js >> scripts/bundle.js && printf "\n" >> scripts/bundle.js

echo 'Minifying Stylesheets...'

npx postcss stylesheets/bundle.css > stylesheets/bundle.min.css
