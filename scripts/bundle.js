#!/usr/bin/env node
// Builds dist/, fonts/ and the generated files in vendor/ from node_modules (run
// `npm ci` first). The output is not committed (#325): CI, the Docker build and
// the Pages deploy run this, and `npm start` runs it when dist/ is missing or its
// recorded inputsHash is out of date (scripts/ensure-built.js, #345). Run it (npm run bundle)
// after changing a dependency or this file. Bundles are reproducible (#200).
//
// Plain Node with no shelling out, so it builds the same on Windows (#328).

const fs = require('fs');
const os = require('os');
const path = require('path');
const esbuild = require('esbuild');
const minifyCss = require('./minify-css');
const writeVersions = require('./write-versions');
const { inputsHash } = require('./inputs-hash');

process.chdir(path.join(__dirname, '..'));

// Each bundle is built from an entry module in scripts/entries/ (#342), which
// imports the libraries and assigns the globals the app uses. esbuild bundles and
// minifies it, so code the app never reaches is dropped.
//
// primary holds what must be loaded immediately: change it with index.html,
// components/files.html or src/index.js. secondary holds what a view needs before
// it can be rendered, and is where a new library usually goes. pdf is fetched the
// first time a PDF is made (MT.loadPDF in src/export.js).
//
// Stylesheets are joined and minified separately. Entries starting with 'tmp:' are
// files built into the scratch directory (see build() below); the rest are paths
// under the repo.
const bundles = [
  {
    name: 'primary',
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
    styles: [
      'node_modules/tom-select/dist/css/tom-select.bootstrap5.min.css',
      'node_modules/leaflet/dist/leaflet.css',
      'node_modules/leaflet.markercluster/dist/MarkerCluster.css',
      'node_modules/leaflet.markercluster/dist/MarkerCluster.Default.css'
    ]
  },
  { name: 'pdf', styles: [] }
];

// Every package whose code ends up in dist/ or vendor/
const versionedPackages = [
  '@cosmos.gl/graph', 'alignment-viewer', 'bioseq', 'bootstrap', 'bootstrap-icons', 'd3',
  'd3-symbol-extra', 'golden-layout', 'html5sortable', 'jszip', 'leaflet', 'leaflet.markercluster',
  'papaparse', 'patristic', 'pdfmake', 'plotly.js', 'tabulator-tables', 'tidytree', 'tom-select', 'xlsx'
];

// Joins stylesheets with a newline after each, like `cat` plus `printf`. Joined as
// bytes, as cat did, so an input that isn't valid UTF-8 is copied unchanged.
function concat(files, tmp, separator) {
  return Buffer.concat(files.flatMap(f => {
    const file = f.startsWith('tmp:') ? path.join(tmp, f.slice(4)) : f;
    return [fs.readFileSync(file), Buffer.from(separator)];
  }));
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

  console.log('Building Javascript Bundles...');

  // Plotly is built with just the traces MicrobeTrace uses (scripts/plotly-bundle.js,
  // which secondary.js imports). The stylesheet it imports is for map traces, which
  // MicrobeTrace doesn't use. scattergl needs a stand-in for Node's buffer module
  // (scripts/buffer-shim.js), and a few packages look for Node's `global`.
  // golden-layout 2 and tidytree ship only ES modules or TypeScript, which is why
  // the libraries are bundled from their modules and not from prebuilt files (#342).
  for (const b of bundles) {
    await esbuild.build({
      entryPoints: [`scripts/entries/${b.name}.js`],
      bundle: true, minify: true, format: 'iife', target: 'es2020', legalComments: 'none',
      define: { global: 'globalThis' }, loader: { '.css': 'empty' },
      alias: { buffer: './scripts/buffer-shim.js' }, logLevel: 'warning',
      outfile: path.join('dist', `bundle.${b.name}.js`)
    });
  }

  console.log('Recording Versions...');
  writeVersions(path.join('dist', 'versions.json'), versionedPackages, inputsHash());
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
