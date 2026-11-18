#!/bin/bash
# Builds dist/ and vendor/ from node_modules (run `npm ci` first). The output is
# committed, and CI re-runs this and fails if it differs from what was committed
# (#200), so run it (npm run bundle) after changing a dependency or this file.

set -euo pipefail
cd "$(dirname "$0")/.."

# Intermediate files go in a scratch directory, removed however the script exits
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

# primaryscripts is where you put scripts that must be loaded immediately.
# It is unlikely that you should need to modify this, unless you're working on
# index.html, components/files.html, or scripts/index.js
primaryscripts=(
  "node_modules/bootstrap/dist/js/bootstrap.bundle.min.js"
  "$tmp/golden-layout.js"
  "node_modules/tom-select/dist/js/tom-select.complete.min.js"
  "node_modules/papaparse/papaparse.min.js"
  "node_modules/jszip/dist/jszip.min.js"
  "node_modules/xlsx/dist/xlsx.core.min.js"
  "vendor/tn93.min.js"
  "node_modules/d3/dist/d3.min.js"
  "node_modules/tabulator-tables/dist/js/tabulator.min.js"
)

# secondaryscripts is where you put scripts that must be loaded before a
# specific view can be rendered. You should probably add your new script to this
# array.
secondaryscripts=(
  "node_modules/d3-symbol-extra/build/d3-symbol-extra.min.js"
  "node_modules/d3-polygon/dist/d3-polygon.min.js"
  "$tmp/plotly.js"
  "$tmp/tidytree.js"
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
  "$tmp/goldenlayout-theme.css"
  "node_modules/tabulator-tables/dist/css/tabulator.min.css"
  "node_modules/tabulator-tables/dist/css/tabulator_bootstrap5.min.css"
  "$tmp/bootstrap-icons.css"
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
  --loader:.png=dataurl --log-level=warning --outfile="$tmp/goldenlayout-theme.css"

# Bootstrap Icons' stylesheet finds its fonts beside it; the bundle's are in fonts/
sed 's#url("fonts/#url("../fonts/#g' node_modules/bootstrap-icons/font/bootstrap-icons.min.css > "$tmp/bootstrap-icons.css"

echo 'Assembling Stylesheets...'

: > "$tmp/primary.css"
for i in "${primarystyles[@]}"; do
  cat "$i" >> "$tmp/primary.css"
  printf "\n" >> "$tmp/primary.css"
done

: > "$tmp/secondary.css"
for i in "${secondarystyles[@]}"; do
  cat "$i" >> "$tmp/secondary.css"
  printf "\n" >> "$tmp/secondary.css"
done

echo 'Minifying Stylesheets...'

node scripts/minify-css.js "$tmp/primary.css" dist/bundle.primary.css
node scripts/minify-css.js "$tmp/secondary.css" dist/bundle.secondary.css

echo 'Copying Unbundlable Dependencies...'

cp node_modules/bioseq/dist/bioseq.min.js vendor/
# cosmos.gl (3.6 shifts its many-body grid every tick itself, so it needs no patch)
npx esbuild node_modules/@cosmos.gl/graph/dist/index.js --bundle --minify --format=iife --global-name=Cosmos \
  --target=es2020 --log-level=warning --outfile=vendor/cosmos.min.js
cp node_modules/patristic/dist/patristic.min.js vendor/
cp node_modules/papaparse/papaparse.min.js vendor/
mkdir -p fonts && cp node_modules/bootstrap-icons/font/fonts/bootstrap-icons.woff* fonts/

echo 'Building Dependencies...'

# tn93, with GapMM's resolution weights fixed (see scripts/patch-tn93.js). The
# primary bundle includes this copy too, so it must be built first.
node scripts/patch-tn93.js vendor/tn93.min.js

# TidyTree, with interrupted redraws no longer rejecting (see scripts/patch-tidytree.js)
node scripts/patch-tidytree.js "$tmp/tidytree.js"

# Plotly with just the traces MicrobeTrace uses (see scripts/plotly-bundle.js).
# The stylesheet it imports is for map traces, which MicrobeTrace doesn't use.
npx esbuild scripts/plotly-bundle.js --bundle --minify --format=iife --global-name=Plotly \
  --target=es2019 --define:global=globalThis --loader:.css=empty --log-level=warning --outfile="$tmp/plotly.js"

# golden-layout 2 ships only ES and CommonJS modules
npx esbuild node_modules/golden-layout/dist/esm/index.js --bundle --minify --format=iife --global-name=goldenLayout \
  --target=es2019 --log-level=warning --outfile="$tmp/golden-layout.js"

echo 'Assembling Javascript Bundle...'

: > dist/bundle.primary.js
# A semicolon after each script, so one ending without its own can't run into
# the next (a script starting with "(" would call the previous one's last value)
for i in "${primaryscripts[@]}"; do
  cat "$i" >> dist/bundle.primary.js
  printf "\n;\n" >> dist/bundle.primary.js
done

: > dist/bundle.secondary.js
for i in "${secondaryscripts[@]}"; do
  cat "$i" >> dist/bundle.secondary.js
  printf "\n;\n" >> dist/bundle.secondary.js
done

echo 'Recording Versions...'

# Every package whose code ends up in dist/ or vendor/
node scripts/write-versions.js dist/versions.json \
  @cosmos.gl/graph alignment-viewer bioseq bootstrap bootstrap-icons d3 d3-polygon d3-symbol-extra \
  golden-layout html5sortable jszip leaflet leaflet.markercluster papaparse patristic pdfmake \
  plotly.js tabulator-tables tidytree tom-select tn93 xlsx

echo 'Done.'
