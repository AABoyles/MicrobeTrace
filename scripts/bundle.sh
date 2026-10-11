#!/bin/bash

# primaryscripts is where you put scripts that must be loaded immediately.
# It is unlikely that you should need to modify this, unless you're working on
# index.html, components/files.html, or scripts/index.js
primaryscripts=(
  "node_modules/bootstrap/dist/js/bootstrap.bundle.min.js"
  "node_modules/alertifyjs/build/alertify.min.js"
  "temp.golden-layout.js"
  "node_modules/tom-select/dist/js/tom-select.complete.min.js"
  "node_modules/fileto/fileto.js"
  "temp.screenfull.js"
  "node_modules/papaparse/papaparse.min.js"
  "node_modules/jszip/dist/jszip.min.js"
  "node_modules/xlsx/dist/xlsx.core.min.js"
  "node_modules/xss/dist/xss.min.js"
  "node_modules/tn93/dist/tn93.min.js"
  "node_modules/d3/dist/d3.min.js"
  "node_modules/tabulator-tables/dist/js/tabulator.min.js"
  "temp.devtools-detect.js"
  "node_modules/localforage/dist/localforage.min.js"
)

# secondaryscripts is where you put scripts that must be loaded before a
# specific view can be rendered. You should probably add your new script to this
# array.
secondaryscripts=(
  "node_modules/d3-symbol-extra/build/d3-symbol-extra.min.js"
  "node_modules/d3-polygon/dist/d3-polygon.min.js"
  "temp.plotly.js"
  "temp.tidytree.js"
  "node_modules/leaflet/dist/leaflet.js"
  "node_modules/leaflet.markercluster/dist/leaflet.markercluster.js"
  "node_modules/html5sortable/dist/html5sortable.min.js"
  "node_modules/alignment-viewer/dist/alignment-viewer.min.js"
  "node_modules/pdfmake/build/pdfmake.min.js"
  "node_modules/pdfmake/build/vfs_fonts.js"
)

# primarystyles is where you put stylesheets that must be loaded immediately to
# render the page properly. You probably shouldn't put your new stylesheet here.
primarystyles=(
  "node_modules/bootstrap/dist/css/bootstrap.min.css"
  "node_modules/golden-layout/dist/css/goldenlayout-base.css"
  "temp.goldenlayout-theme.css"
  "node_modules/alertifyjs/build/css/alertify.min.css"
  "node_modules/tabulator-tables/dist/css/tabulator.min.css"
  "node_modules/tabulator-tables/dist/css/tabulator_bootstrap5.min.css"
  "node_modules/open-iconic/font/css/open-iconic-bootstrap.min.css"
)

# secondarystyles is where you put stylesheets that must be loaded before a
# specific view (or views) are loaded. You should probably put your new
# stylesheet here.
secondarystyles=(
  "node_modules/tom-select/dist/css/tom-select.bootstrap5.min.css"
  "node_modules/leaflet/dist/leaflet.css"
  "node_modules/leaflet.markercluster/dist/MarkerCluster.css"
  "node_modules/leaflet.markercluster/dist/MarkerCluster.Default.css"
)

# golden-layout's theme refers to its icons by relative path; inline them
npx esbuild node_modules/golden-layout/dist/css/themes/goldenlayout-light-theme.css --bundle \
  --loader:.png=dataurl --log-level=warning --outfile=temp.goldenlayout-theme.css

echo 'Assembling Stylesheets...'

touch temp.primary.css
for i in ${primarystyles[@]}; do
  cat $i >> temp.primary.css
  printf "\n" >> temp.primary.css
done

touch temp.secondary.css
for i in ${secondarystyles[@]}; do
  cat $i >> temp.secondary.css
  printf "\n" >> temp.secondary.css
done

echo 'Minifying Stylesheets...'

npx postcss temp.primary.css > dist/bundle.primary.css
npx postcss temp.secondary.css > dist/bundle.secondary.css

echo 'Copying Unbundlable Dependencies...'

cp node_modules/bioseq/dist/bioseq.min.js vendor/
# cosmos.gl, with its many-body grid shifted every tick (see scripts/patch-cosmos.js)
node scripts/patch-cosmos.js temp.cosmos.mjs || exit 1
npx esbuild temp.cosmos.mjs --bundle --minify --format=iife --global-name=Cosmos \
  --target=es2020 --log-level=warning --outfile=vendor/cosmos.min.js
rm temp.cosmos.mjs
cp node_modules/patristic/dist/patristic.min.js vendor/
cp node_modules/tn93/dist/tn93.min.js vendor/
cp node_modules/papaparse/papaparse.min.js vendor/
cp -r node_modules/open-iconic/font/fonts/ .

echo 'Building Dependencies...'

# screenfull and devtools-detect are ES modules (a single `export default`), so they
# are wrapped to set the same globals their older versions did.
for module in screenfull devtools-detect; do
  name=$( [ $module = screenfull ] && echo screenfull || echo devtools )
  { echo "{"; sed "s/^export default $name;$/window.$name = $name;/" node_modules/$module/index.js; echo "}"; } > temp.$module.js
done

# TidyTree, with interrupted redraws no longer rejecting (see scripts/patch-tidytree.js)
node scripts/patch-tidytree.js temp.tidytree.js || exit 1

# Plotly with just the traces MicrobeTrace uses (see scripts/plotly-bundle.js).
# The stylesheet it imports is for map traces, which MicrobeTrace doesn't use.
npx esbuild scripts/plotly-bundle.js --bundle --minify --format=iife --global-name=Plotly \
  --target=es2019 --define:global=globalThis --loader:.css=empty --log-level=warning --outfile=temp.plotly.js

# golden-layout 2 ships only ES and CommonJS modules
npx esbuild node_modules/golden-layout/dist/esm/index.js --bundle --minify --format=iife --global-name=goldenLayout \
  --target=es2019 --log-level=warning --outfile=temp.golden-layout.js

echo 'Assembling Javascript Bundle...'

rm dist/bundle.primary.js && touch dist/bundle.primary.js
# A semicolon after each script, so one ending without its own can't run into
# the next (a script starting with "(" would call the previous one's last value)
for i in ${primaryscripts[@]}; do
  cat $i >> dist/bundle.primary.js
  printf "\n;\n" >> dist/bundle.primary.js
done

rm dist/bundle.secondary.js && touch dist/bundle.secondary.js
for i in ${secondaryscripts[@]}; do
  cat $i >> dist/bundle.secondary.js
  printf "\n;\n" >> dist/bundle.secondary.js
done

echo "Cleaning up..."

rm temp.*.css temp.*.js
