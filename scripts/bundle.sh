#!/bin/sh

echo 'Assembling Stylesheets...'

touch temp.css
cat node_modules/bootstrap/dist/css/bootstrap.min.css >> temp.css && printf "\n" >> temp.css
cat node_modules/golden-layout/src/css/goldenlayout-base.css >> temp.css && printf "\n" >> temp.css
cat node_modules/golden-layout/src/css/goldenlayout-light-theme.css >> temp.css && printf "\n" >> temp.css
cat node_modules/chosen-js/chosen.css >> temp.css && printf "\n" >> temp.css
cat node_modules/alertifyjs/build/css/alertify.min.css >> temp.css && printf "\n" >> temp.css
cat node_modules/leaflet/dist/leaflet.css >> temp.css && printf "\n" >> temp.css
cat node_modules/leaflet.markercluster/dist/MarkerCluster.css >> temp.css && printf "\n" >> temp.css
cat node_modules/leaflet.markercluster/dist/MarkerCluster.Default.css >> temp.css && printf "\n" >> temp.css
cat node_modules/tabulator-tables/dist/css/tabulator.min.css >> temp.css && printf "\n" >> temp.css
cat node_modules/tabulator-tables/dist/css/bootstrap/tabulator_bootstrap4.min.css >> temp.css && printf "\n" >> temp.css
cat node_modules/open-iconic/font/css/open-iconic-bootstrap.min.css >> temp.css && printf "\n" >> temp.css

echo 'Copying Unbundlable Dependencies...'

cp node_modules/bioseq/dist/bioseq.min.js vendor/
cp node_modules/patristic/dist/patristic.min.js vendor/
cp node_modules/tn93/dist/tn93.min.js vendor/
cp -r node_modules/open-iconic/font/fonts/ .

echo 'Assembling Javascript Bundle...'

rm dist/bundle.js && touch dist/bundle.js
cat node_modules/fast-text-encoding/text.min.js >> dist/bundle.js && printf "\n" >> dist/bundle.js
cat node_modules/jquery/dist/jquery.min.js >> dist/bundle.js && printf "\n" >> dist/bundle.js
cat node_modules/popper.js/dist/umd/popper.min.js >> dist/bundle.js && printf "\n" >> dist/bundle.js
cat node_modules/bootstrap/dist/js/bootstrap.min.js >> dist/bundle.js && printf "\n" >> dist/bundle.js
cat node_modules/alertifyjs/build/alertify.min.js >> dist/bundle.js && printf "\n" >> dist/bundle.js
cat node_modules/golden-layout/dist/goldenlayout.min.js >> dist/bundle.js && printf "\n" >> dist/bundle.js
cat node_modules/chosen-js/chosen.jquery.min.js >> dist/bundle.js && printf "\n" >> dist/bundle.js
cat node_modules/fileto/fileto.js >> dist/bundle.js && printf "\n" >> dist/bundle.js
cat node_modules/screenfull/dist/screenfull.js >> dist/bundle.js && printf "\n" >> dist/bundle.js
cat node_modules/clipboard/dist/clipboard.min.js >> dist/bundle.js && printf "\n" >> dist/bundle.js
cat node_modules/moment/min/moment-with-locales.min.js >> dist/bundle.js && printf "\n" >> dist/bundle.js
cat node_modules/papaparse/papaparse.min.js >> dist/bundle.js && printf "\n" >> dist/bundle.js
cat node_modules/jszip/dist/jszip.min.js >> dist/bundle.js && printf "\n" >> dist/bundle.js
cat node_modules/xlsx/dist/xlsx.core.min.js >> dist/bundle.js && printf "\n" >> dist/bundle.js
cat node_modules/xss/dist/xss.min.js >> dist/bundle.js && printf "\n" >> dist/bundle.js
cat node_modules/tn93/dist/tn93.min.js >> dist/bundle.js && printf "\n" >> dist/bundle.js
cat node_modules/d3/dist/d3.min.js >> dist/bundle.js && printf "\n" >> dist/bundle.js
cat node_modules/d3-force-attract/dist/d3-force-attract.min.js >> dist/bundle.js && printf "\n" >> dist/bundle.js
cat node_modules/d3-symbol-extra/build/d3-symbol-extra.min.js >> dist/bundle.js && printf "\n" >> dist/bundle.js
cat node_modules/html5sortable/dist/html5sortable.min.js >> dist/bundle.js && printf "\n" >> dist/bundle.js
cat node_modules/plotly.js/dist/plotly.min.js >> dist/bundle.js && printf "\n" >> dist/bundle.js
cat node_modules/tabulator-tables/dist/js/tabulator.min.js >> dist/bundle.js && printf "\n" >> dist/bundle.js
cat node_modules/tidytree/dist/tidytree.min.js >> dist/bundle.js && printf "\n" >> dist/bundle.js
cat node_modules/3d-force-graph/dist/3d-force-graph.min.js >> dist/bundle.js && printf "\n" >> dist/bundle.js
cat node_modules/leaflet/dist/leaflet.js >> dist/bundle.js && printf "\n" >> dist/bundle.js
cat node_modules/leaflet.markercluster/dist/leaflet.markercluster.js >> dist/bundle.js && printf "\n" >> dist/bundle.js
cat node_modules/leaflet-image/leaflet-image.js >> dist/bundle.js && printf "\n" >> dist/bundle.js
cat node_modules/marked/marked.min.js >> dist/bundle.js && printf "\n" >> dist/bundle.js
cat node_modules/alignment-viewer/dist/alignment-viewer.min.js >> dist/bundle.js && printf "\n" >> dist/bundle.js
cat node_modules/file-saver/dist/FileSaver.min.js >> dist/bundle.js && printf "\n" >> dist/bundle.js
cat node_modules/save-svg-as-png/lib/saveSvgAsPng.js >> dist/bundle.js && printf "\n" >> dist/bundle.js
cat node_modules/pdfmake/build/pdfmake.min.js >> dist/bundle.js && printf "\n" >> dist/bundle.js
cat node_modules/pdfmake/build/vfs_fonts.js >> dist/bundle.js && printf "\n" >> dist/bundle.js

echo 'Minifying Stylesheets...'

npx postcss temp.css > dist/bundle.min.css

echo "Cleaning up..."

rm temp.css
