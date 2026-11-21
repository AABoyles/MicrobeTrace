#!/usr/bin/env node
// Builds dist/ and vendor/ from node_modules (run `npm ci` first). The output is
// committed, and CI re-runs this and fails if it differs from what was committed
// (#200), so run it (npm run bundle) after changing a dependency or this file.
//
// Plain Node with no shelling out, so it builds the same on Windows (#328).

const fs = require('fs');
const os = require('os');
const path = require('path');
const esbuild = require('esbuild');
const minifyCss = require('./minify-css');
const writeVersions = require('./write-versions');

process.chdir(path.join(__dirname, '..'));

// Entries starting with "tmp:" are files built into the scratch directory
// (see build() below); the rest are paths under the repo.
//
// For scripts, primary is where you put scripts that must be loaded immediately.
// It is unlikely that you should need to modify this, unless you're working on
// index.html, components/files.html, or scripts/index.js
//
// secondary is where you put scripts that must be loaded before a specific view
// can be rendered. You should probably add your new script to this list.
//
// pdf is fetched the first time a PDF is made (MT.loadPDF in src/common.js)
//
// For styles, primary is where you put stylesheets that must be loaded
// immediately to render the page properly. You probably shouldn't put your new
// stylesheet there. secondary is where you put stylesheets that must be loaded
// before a specific view (or views) are loaded. You should probably put your new
// stylesheet there.
const bundles = [
  {
    name: 'primary',
    scripts: [
      'node_modules/bootstrap/dist/js/bootstrap.bundle.min.js',
      'tmp:golden-layout.js',
      'node_modules/tom-select/dist/js/tom-select.complete.min.js',
      'node_modules/papaparse/papaparse.min.js',
      'node_modules/jszip/dist/jszip.min.js',
      'node_modules/xlsx/dist/xlsx.core.min.js',
      'node_modules/d3/dist/d3.min.js',
      'node_modules/tabulator-tables/dist/js/tabulator.min.js'
    ],
    styles: [
      'node_modules/bootstrap/dist/css/bootstrap.min.css',
      'node_modules/golden-layout/dist/css/goldenlayout-base.css',
      'tmp:goldenlayout-theme.css',
      'node_modules/tabulator-tables/dist/css/tabulator.min.css',
      'node_modules/tabulator-tables/dist/css/tabulator_bootstrap5.min.css',
      'tmp:bootstrap-icons.css'
    ]
  },
  {
    name: 'secondary',
    scripts: [
      'node_modules/d3-symbol-extra/build/d3-symbol-extra.min.js',
      'node_modules/d3-polygon/dist/d3-polygon.min.js',
      'tmp:plotly.js',
      'node_modules/tidytree/dist/tidytree.min.js',
      'node_modules/leaflet/dist/leaflet.js',
      'node_modules/leaflet.markercluster/dist/leaflet.markercluster.js',
      'node_modules/html5sortable/dist/html5sortable.min.js',
      'node_modules/alignment-viewer/dist/alignment-viewer.min.js'
    ],
    styles: [
      'node_modules/tom-select/dist/css/tom-select.bootstrap5.min.css',
      'node_modules/leaflet/dist/leaflet.css',
      'node_modules/leaflet.markercluster/dist/MarkerCluster.css',
      'node_modules/leaflet.markercluster/dist/MarkerCluster.Default.css'
    ]
  },
  {
    name: 'pdf',
    scripts: [
      'node_modules/pdfmake/build/pdfmake.min.js',
      'node_modules/pdfmake/build/vfs_fonts.js'
    ],
    styles: []
  }
];

// Every package whose code ends up in dist/ or vendor/
const versionedPackages = [
  '@cosmos.gl/graph', 'alignment-viewer', 'bioseq', 'bootstrap', 'bootstrap-icons', 'd3', 'd3-polygon',
  'd3-symbol-extra', 'golden-layout', 'html5sortable', 'jszip', 'leaflet', 'leaflet.markercluster',
  'papaparse', 'patristic', 'pdfmake', 'plotly.js', 'tabulator-tables', 'tidytree', 'tom-select', 'xlsx'
];

// Joins files with a separator after each, like `cat` plus `printf`. Read as
// UTF-8 strings; the inputs are valid UTF-8, so this round-trips exactly.
function concat(files, tmp, separator) {
  return files.map(f => {
    const file = f.startsWith('tmp:') ? path.join(tmp, f.slice(4)) : f;
    return fs.readFileSync(file, 'utf8') + separator;
  }).join('');
}

async function build(tmp) {
  // golden-layout's theme refers to its icons by relative path; inline them
  await esbuild.build({
    entryPoints: ['node_modules/golden-layout/dist/css/themes/goldenlayout-light-theme.css'],
    bundle: true, loader: { '.png': 'dataurl' }, logLevel: 'warning',
    outfile: path.join(tmp, 'goldenlayout-theme.css')
  });

  // Bootstrap Icons' stylesheet finds its fonts beside it; the bundle's are in fonts/
  fs.writeFileSync(path.join(tmp, 'bootstrap-icons.css'),
    fs.readFileSync('node_modules/bootstrap-icons/font/bootstrap-icons.min.css', 'utf8')
      .replace(/url\("fonts\//g, 'url("../fonts/'));

  console.log('Assembling Stylesheets...');
  for (const b of bundles) {
    if (b.styles.length) fs.writeFileSync(path.join(tmp, b.name + '.css'), concat(b.styles, tmp, '\n'));
  }

  console.log('Minifying Stylesheets...');
  for (const b of bundles) {
    if (b.styles.length) await minifyCss(path.join(tmp, b.name + '.css'), path.join('dist', `bundle.${b.name}.css`));
  }

  console.log('Copying Unbundlable Dependencies...');
  fs.mkdirSync('vendor', { recursive: true });
  fs.mkdirSync('fonts', { recursive: true });
  fs.copyFileSync('node_modules/bioseq/dist/bioseq.min.js', 'vendor/bioseq.min.js');
  // cosmos.gl (3.6 shifts its many-body grid every tick itself, so it needs no patch)
  await esbuild.build({
    entryPoints: ['node_modules/@cosmos.gl/graph/dist/index.js'],
    bundle: true, minify: true, format: 'iife', globalName: 'Cosmos', target: 'es2020',
    logLevel: 'warning', outfile: 'vendor/cosmos.min.js'
  });
  fs.copyFileSync('node_modules/patristic/dist/patristic.min.js', 'vendor/patristic.min.js');
  fs.copyFileSync('node_modules/papaparse/papaparse.min.js', 'vendor/papaparse.min.js');
  const iconFonts = 'node_modules/bootstrap-icons/font/fonts';
  for (const f of fs.readdirSync(iconFonts)) {
    if (/^bootstrap-icons\.woff/.test(f)) fs.copyFileSync(path.join(iconFonts, f), path.join('fonts', f));
  }

  console.log('Building Dependencies...');

  // Plotly with just the traces MicrobeTrace uses (see scripts/plotly-bundle.js).
  // The stylesheet it imports is for map traces, which MicrobeTrace doesn't use.
  // scattergl needs a stand-in for Node's buffer module (scripts/buffer-shim.js).
  await esbuild.build({
    entryPoints: ['scripts/plotly-bundle.js'],
    bundle: true, minify: true, format: 'iife', globalName: 'Plotly', target: 'es2019',
    define: { global: 'globalThis' }, loader: { '.css': 'empty' },
    alias: { buffer: './scripts/buffer-shim.js' }, logLevel: 'warning',
    outfile: path.join(tmp, 'plotly.js')
  });

  // golden-layout 2 ships only ES and CommonJS modules
  await esbuild.build({
    entryPoints: ['node_modules/golden-layout/dist/esm/index.js'],
    bundle: true, minify: true, format: 'iife', globalName: 'goldenLayout', target: 'es2019',
    logLevel: 'warning', outfile: path.join(tmp, 'golden-layout.js')
  });

  console.log('Assembling Javascript Bundle...');
  // A semicolon after each script, so one ending without its own can't run into
  // the next (a script starting with "(" would call the previous one's last value)
  for (const b of bundles) {
    fs.writeFileSync(path.join('dist', `bundle.${b.name}.js`), concat(b.scripts, tmp, '\n;\n'));
  }

  console.log('Recording Versions...');
  writeVersions(path.join('dist', 'versions.json'), versionedPackages);
}

async function main() {
  fs.mkdirSync('dist', { recursive: true });
  // Intermediate files go in a scratch directory, removed however the script exits
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-bundle-'));
  try {
    await build(tmp);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  console.log('Done.');
}

main().catch(error => { console.error(error); process.exit(1); });
