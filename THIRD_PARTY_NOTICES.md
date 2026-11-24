# Third-party notices

MicrobeTrace redistributes the third-party code and fonts listed below in `dist/`, `vendor/`
and `fonts/`. This file gives each one's version, licence and upstream project. The project's own
licence (Apache-2.0) is in `LICENSE`, and `NOTICE` gives the project's copyright.

## How this was checked

- **Versions** come from each package's `package.json` in `node_modules`, which `npm ci` installs
  from `package-lock.json`. `dist/versions.json` (written by `scripts/bundle.js`) gives the same
  version for each package it lists.
- **Licences** come from each package's `license` field in its `package.json`, and from its
  licence file (`LICENSE`, `LICENSE.md` and similar) where it has one. Where a package has no
  licence file, the tables say so.
- **What goes into each bundle** comes from esbuild metafiles of the builds in `scripts/bundle.js`.
  Each of the bundles `primary`, `xlsx`, `table`, `plotly`, `map`, `tree`, `alignment` and `pdf` is
  built from an entry module in `scripts/entries/` (#342), and `vendor/cosmos.min.js` is built from
  `@cosmos.gl/graph`. Each build was run with the options in `scripts/bundle.js` and
  `write: false`, and every input under `node_modules/` was mapped to its package. A nested copy
  (one under another package's `node_modules`) is listed with its own version. `vendor/bioseq.min.js`,
  `vendor/patristic.min.js` and `vendor/papaparse.min.js` are copies of files, not builds, so the
  package is the one copied.
- **Prebuilt code.** A few inputs are prebuilt files, so esbuild sees each as a single file:
  `bootstrap.bundle.js` (which includes Popper), and pdfmake's `pdfmake.js` and `vfs_fonts.js`. For
  those, the packages inside were found from the file's module markers and names, and their
  versions are the installed ones, since the file does not state them.
- **Licence comments.** `scripts/bundle.js` builds `dist/` and the cosmos build with
  `legalComments: 'eof'`, so each bundle keeps its inputs' licence comments at the end of the file.
- **Upstream URLs** come from each package's `repository` or `homepage` field. Where the field
  is missing, the URL is marked.
- **Marks.** "Not verified" means the item could not be checked from the repository or
  `node_modules`.

Only the licence name is given here. The full licence texts are in the `LICENSE` file of each
package in `node_modules`, and the copyright lines are in the same files. They are not copied here.

## Top-level libraries

The `primary` bundle is loaded with the page. The other bundles are lazy: each is fetched the first
time a feature needs it. `xlsx` holds SheetJS and JSZip, `table` Tabulator, `plotly` Plotly.js,
`map` Leaflet and its marker clusters, `tree` TidyTree (with D3), `alignment` alignment-viewer,
and `pdf` pdfmake.

### `dist/` (JavaScript and CSS)

| Library | Version | Licence | Upstream | Where it appears |
|---|---|---|---|---|
| Bootstrap | 5.3.9 | MIT | https://github.com/twbs/bootstrap | `bundle.primary.js` (JS, with Popper below), `bundle.primary.css` |
| Popper (`@popperjs/core`, Bootstrap's peer dependency, inside `bundle.primary.js`) | 2.11.8 | MIT | https://github.com/popperjs/popper-core | `bundle.primary.js`. The version is the installed `@popperjs/core`; the copy inside the bundle has no version string, so it was not checked separately. |
| Bootstrap Icons (CSS) | 1.13.2 | MIT | https://github.com/twbs/icons | `bundle.primary.css` (its CSS, with font paths rewritten to `../fonts/`) |
| golden-layout | 2.6.0 | MIT | https://github.com/golden-layout/golden-layout | `bundle.primary.js`, `bundle.primary.css` (base and light theme CSS) |
| tom-select | 2.7.0 | Apache-2.0 | https://github.com/orchidjs/tom-select | `bundle.primary.js`, `bundle.primary.css`. Embeds the two `@orchidjs` packages below. |
| PapaParse | 5.7.1 | MIT | https://github.com/mholt/PapaParse | `bundle.primary.js`, `vendor/papaparse.min.js` |
| JSZip | 3.10.2 | MIT OR GPL-3.0-or-later (dual; upstream offers either, and MIT is the one named here) | https://github.com/Stuk/jszip | `bundle.xlsx.js` |
| SheetJS (`xlsx`, core build) | 0.20.3 | Apache-2.0 | https://git.sheetjs.com/SheetJS/sheetjs | `bundle.xlsx.js` |
| D3 | 7.9.2 | ISC | https://github.com/d3/d3 | `bundle.primary.js` and `bundle.tree.js`. Each embeds the `d3-*` modules listed below. |
| Tabulator (`tabulator-tables`) | 6.7.1 | MIT | https://github.com/tabulator-tables/tabulator | `bundle.table.js`, `bundle.table.css` |
| d3-symbol-extra | 0.1.0 | BSD-3-Clause | https://github.com/YellowTugboat/d3-symbol-extra | `bundle.primary.js` |
| Plotly.js (built from `scripts/plotly-bundle.js`, see below) | 4.3.0 | MIT | https://github.com/plotly/plotly.js | `bundle.plotly.js` |
| TidyTree | 0.8.1 | Apache-2.0 | https://github.com/cdcgov/TidyTree | `bundle.tree.js`, built from its TypeScript source (`tidytree/src/main.ts`). Embeds its own Patristic (below). |
| Leaflet | 1.9.4 | BSD-2-Clause | https://github.com/Leaflet/Leaflet | `bundle.map.js`, `bundle.map.css` |
| Leaflet.markercluster | 1.5.3 | MIT | https://github.com/Leaflet/Leaflet.markercluster | `bundle.map.js`, `bundle.map.css`. The package has no licence file; its `package.json` says MIT. |
| html5sortable | 0.14.0 | MIT | https://github.com/lukasoppermann/html5sortable | `bundle.primary.js` |
| alignment-viewer | 0.3.4 | Apache-2.0 | https://github.com/CDCgov/AlignmentViewer | `bundle.alignment.js` |
| pdfmake | 0.3.14 | MIT | https://github.com/bpampuch/pdfmake | `bundle.pdf.js`. Embeds the packages listed below. |
| pdfmake virtual font files (`vfs_fonts.js`) | from pdfmake 0.3.14 | See the Roboto row in "Packages inside other bundled files" below | | `bundle.pdf.js` |

### `vendor/` (JavaScript and WebAssembly)

| File | Library | Version | Licence | Upstream |
|---|---|---|---|---|
| `vendor/bioseq.min.js` | bioseq | 0.2.0 | Apache-2.0 | https://github.com/CDCgov/bioseq-js |
| `vendor/cosmos.min.js` | @cosmos.gl/graph (built with esbuild; see the packages it includes below) | 3.6.0 | MIT | https://github.com/cosmosgl/graph |
| `vendor/papaparse.min.js` | PapaParse | 5.7.1 | MIT | https://github.com/mholt/PapaParse |
| `vendor/patristic.min.js` | Patristic | 0.6.0 | Apache-2.0 | https://github.com/CDCgov/patristic |
| `vendor/bx_distance_models.js`, `vendor/bx_distance_models_bg.wasm` | bx-distance-models (not on NPM; built from commit `970bba4`, per `vendor/README.md`) | Commit `970bba4` (0.2.0) | **Not verified.** No licence file is in this repository or the build inputs, and the upstream licence was not checked. | https://github.com/AABoyles/bx-distance-models |

### `fonts/`

| File | Font | Version | Licence | Upstream |
|---|---|---|---|---|
| `fonts/bootstrap-icons.woff`, `fonts/bootstrap-icons.woff2` | Bootstrap Icons | 1.13.2 | MIT | https://github.com/twbs/icons |

Both files are byte-for-byte copies of `node_modules/bootstrap-icons/font/fonts/`.

## Packages inside the bundles

Some bundled files contain code from packages that are not top-level dependencies here. The
tables below are read from the esbuild metafiles, except where a section says otherwise.

### Packages inside D3 (`dist/bundle.primary.js` and `dist/bundle.tree.js`)

D3 is imported whole, so every module it depends on is in both bundles. `d3-polygon` is not listed
in `package.json`, but D3 depends on it, so it is still shipped.

| Package | Version | Licence | Upstream |
|---|---|---|---|
| d3-array | 3.2.5 | ISC | https://github.com/d3/d3-array |
| d3-axis | 3.0.1 | ISC | https://github.com/d3/d3-axis |
| d3-brush | 3.0.1 | ISC | https://github.com/d3/d3-brush |
| d3-chord | 3.0.2 | ISC | https://github.com/d3/d3-chord |
| d3-color | 3.1.1 | ISC | https://github.com/d3/d3-color |
| d3-contour | 4.0.3 | ISC | https://github.com/d3/d3-contour |
| d3-delaunay | 6.0.6 | ISC | https://github.com/d3/d3-delaunay |
| d3-dispatch | 3.0.2 | ISC | https://github.com/d3/d3-dispatch |
| d3-drag | 3.0.1 | ISC | https://github.com/d3/d3-drag |
| d3-dsv | 3.0.2 | ISC | https://github.com/d3/d3-dsv |
| d3-ease | 3.0.2 | BSD-3-Clause | https://github.com/d3/d3-ease |
| d3-fetch | 3.0.2 | ISC | https://github.com/d3/d3-fetch |
| d3-force | 3.0.1 | ISC | https://github.com/d3/d3-force |
| d3-format | 3.1.3 | ISC | https://github.com/d3/d3-format |
| d3-geo | 3.1.2 | ISC | https://github.com/d3/d3-geo |
| d3-hierarchy | 3.1.3 | ISC | https://github.com/d3/d3-hierarchy |
| d3-interpolate | 3.0.2 | ISC | https://github.com/d3/d3-interpolate |
| d3-path | 3.1.1 | ISC | https://github.com/d3/d3-path |
| d3-polygon | 3.0.2 | ISC | https://github.com/d3/d3-polygon |
| d3-quadtree | 3.0.2 | ISC | https://github.com/d3/d3-quadtree |
| d3-random | 3.0.2 | ISC | https://github.com/d3/d3-random |
| d3-scale | 4.0.3 | ISC | https://github.com/d3/d3-scale |
| d3-scale-chromatic | 3.1.1 | ISC | https://github.com/d3/d3-scale-chromatic |
| d3-selection | 3.0.1 | ISC | https://github.com/d3/d3-selection |
| d3-shape | 3.2.1 | ISC | https://github.com/d3/d3-shape |
| d3-time | 3.1.1 | ISC | https://github.com/d3/d3-time |
| d3-time-format | 4.1.1 | ISC | https://github.com/d3/d3-time-format |
| d3-timer | 3.0.2 | ISC | https://github.com/d3/d3-timer |
| d3-transition | 3.0.2 | ISC | https://github.com/d3/d3-transition |
| d3-zoom | 3.0.1 | ISC | https://github.com/d3/d3-zoom |

### Packages inside tom-select (`dist/bundle.primary.js`)

| Package | Version | Licence | Upstream |
|---|---|---|---|
| @orchidjs/sifter | 1.1.0 | Apache-2.0 (no licence file in package) | https://github.com/orchidjs/sifter.js |
| @orchidjs/unicode-variants | 1.2.2 | Apache-2.0 | https://github.com/orchidjs/unicode-variants |

### Packages inside TidyTree (`dist/bundle.tree.js`)

| Package | Version | Licence | Upstream |
|---|---|---|---|
| patristic (nested in tidytree) | 0.7.1 | Apache-2.0 | https://github.com/CDCgov/patristic |

TidyTree declares Patristic 0.7.1 as its own dependency. The top-level `patristic` (0.6.0) is the
one in `vendor/patristic.min.js`.

### Packages inside Plotly (`dist/bundle.plotly.js`)

Packages included by `scripts/plotly-bundle.js`. Versions are the ones esbuild resolved from
`node_modules`. Where a version was nested under another package, the nested copy is used and the
parent is named in brackets. `maplibre-gl` is not in the bundle: plotly.js imports its stylesheet,
which the build empties, and no JavaScript from it reaches the bundle.

| Package | Version | Licence | Upstream |
|---|---|---|---|
| @plotly/d3 | 3.8.2 | BSD-3-Clause | https://github.com/plotly/d3 |
| @plotly/d3-sankey | 0.12.3 | BSD-3-Clause | https://github.com/plotly/d3-sankey |
| @plotly/d3-sankey-circular | 0.33.1 | MIT | https://github.com/plotly/d3-sankey-circular |
| @plotly/point-cluster | 3.1.9 | MIT | https://github.com/plotly/point-cluster |
| @plotly/regl | 2.1.2 | MIT | https://github.com/plotly/regl |
| abs-svg-path | 0.1.1 | MIT (no licence file in package) | https://github.com/jkroso/abs-svg-path |
| array-bounds | 1.0.1 | MIT (no licence file in package) | https://github.com/dfcreative/array-bounds |
| array-find-index | 1.0.2 | MIT | https://github.com/sindresorhus/array-find-index |
| array-normalize | 1.1.4 | MIT (no licence file in package) | https://github.com/dfcreative/array-normalize |
| base64-arraybuffer | 1.0.2 | MIT | https://github.com/niklasvh/base64-arraybuffer |
| binary-search-bounds | 2.0.5 | MIT | https://github.com/mikolalysenko/binary-search-bounds |
| bit-twiddle | 1.0.2 | MIT | https://github.com/mikolalysenko/bit-twiddle |
| bitmap-sdf | 1.0.4 | MIT (no licence file in package) | https://github.com/dfcreative/bitmap-sdf |
| clamp | 1.0.1 | MIT | https://github.com/hughsk/clamp |
| color-id | 1.1.0 | MIT (no licence file in package) | https://github.com/colorjs/color-id |
| color-name | 1.1.4 | MIT | https://github.com/colorjs/color-name |
| color-normalize | 1.5.2 | MIT (no licence file in package) | https://github.com/colorjs/color-normalize |
| color-parse | 1.4.3 | MIT | https://github.com/colorjs/color-parse |
| color-rgba | 2.4.0 | MIT (no licence file in package) | https://github.com/colorjs/color-rgba |
| css-font | 1.2.0 | MIT | https://github.com/dy/css-font |
| css-font-size-keywords | 1.0.0 | MIT | https://github.com/jedmao/css-font-size-keywords |
| css-font-stretch-keywords | 1.0.1 | MIT | https://github.com/jedmao/css-font-stretch-keywords |
| css-font-style-keywords | 1.0.1 | MIT | https://github.com/jedmao/css-font-style-keywords |
| css-font-weight-keywords | 1.0.0 | MIT | https://github.com/jedmao/css-font-weight-keywords |
| css-global-keywords | 1.0.1 | MIT | https://github.com/jedmao/css-global-keywords |
| css-system-font-keywords | 1.0.0 | MIT | https://github.com/jedmao/css-system-font-keywords |
| culori | 4.0.2 | MIT | https://github.com/Evercoder/culori |
| d | 1.0.2 | ISC | https://github.com/medikoo/d |
| d3-array (nested in @plotly/d3-sankey-circular) | 1.2.4 | BSD-3-Clause | https://github.com/d3/d3-array |
| d3-array (nested in @plotly/d3-sankey) | 2.12.1 | BSD-3-Clause | https://github.com/d3/d3-array |
| d3-collection | 1.0.7 | BSD-3-Clause | https://github.com/d3/d3-collection |
| d3-color | 3.1.1 | ISC | https://github.com/d3/d3-color |
| d3-dispatch (nested in plotly.js) | 1.0.6 | BSD-3-Clause | https://github.com/d3/d3-dispatch |
| d3-force (nested in plotly.js) | 1.2.1 | BSD-3-Clause | https://github.com/d3/d3-force |
| d3-format (nested in plotly.js) | 1.4.5 | BSD-3-Clause | https://github.com/d3/d3-format |
| d3-interpolate | 3.0.2 | ISC | https://github.com/d3/d3-interpolate |
| d3-path (nested in @plotly/d3-sankey-circular) | 1.0.9 | BSD-3-Clause | https://github.com/d3/d3-path |
| d3-path (nested in @plotly/d3-sankey) | 1.0.9 | BSD-3-Clause | https://github.com/d3/d3-path |
| d3-quadtree (nested in plotly.js) | 1.0.7 | BSD-3-Clause | https://github.com/d3/d3-quadtree |
| d3-shape (nested in @plotly/d3-sankey-circular) | 1.3.7 | BSD-3-Clause | https://github.com/d3/d3-shape |
| d3-shape (nested in @plotly/d3-sankey) | 1.3.7 | BSD-3-Clause | https://github.com/d3/d3-shape |
| d3-time (nested in plotly.js) | 1.1.0 | BSD-3-Clause | https://github.com/d3/d3-time |
| d3-time-format (nested in plotly.js) | 2.3.0 | BSD-3-Clause | https://github.com/d3/d3-time-format |
| d3-timer (nested in plotly.js) | 1.0.10 | BSD-3-Clause | https://github.com/d3/d3-timer |
| defined | 1.0.1 | MIT | https://github.com/inspect-js/defined |
| detect-kerning | 2.1.2 | MIT (no licence file in package) | https://github.com/dy/detect-kerning |
| dtype | 2.0.0 | MIT | https://github.com/shama/dtype |
| dup | 1.0.0 | MIT | https://github.com/mikolalysenko/dup |
| earcut (nested in regl-line2d) | 2.2.4 | ISC | https://github.com/mapbox/earcut |
| elementary-circuits-directed-graph | 1.3.1 | MIT | https://github.com/antoinerg/elementary-circuits-directed-graph |
| es5-ext | 0.10.64 | ISC | https://github.com/medikoo/es5-ext |
| es6-iterator | 2.0.3 | MIT | https://github.com/medikoo/es6-iterator |
| es6-symbol | 3.1.4 | ISC | https://github.com/medikoo/es6-symbol |
| es6-weak-map | 2.0.3 | ISC | https://github.com/medikoo/es6-weak-map |
| events | 3.3.0 | MIT | https://github.com/Gozala/events |
| ext | 1.7.0 | ISC | https://github.com/medikoo/es5-ext |
| fast-isnumeric | 1.1.4 | MIT | https://github.com/plotly/fast-isnumeric |
| flatten-vertex-data | 1.0.2 | MIT | https://github.com/glo-js/flatten-vertex-data |
| font-atlas | 2.1.0 | MIT | https://github.com/hughsk/font-atlas |
| font-measure | 1.2.2 | MIT (no licence file in package) | https://github.com/dy/font-measure |
| gl-mat4 | 1.2.0 | Zlib | https://github.com/stackgl/gl-mat4 |
| gl-text | 1.4.0 | MIT | https://github.com/a-vis/gl-text |
| gl-util | 3.1.3 | MIT (no licence file in package) | https://github.com/dy/gl-util |
| glslify | 7.1.1 | MIT | https://github.com/stackgl/glslify |
| has-hover | 1.0.1 | MIT (no licence file in package) | https://github.com/dfcreative/has-hover |
| has-passive-events | 1.0.0 | MIT | https://github.com/dfcreative/has-passive-events |
| is-browser | 2.1.0 | MIT | https://github.com/ForbesLindesay/is-browser |
| is-mobile | 5.0.0 | MIT (no licence file in package) | https://github.com/juliangruber/is-mobile |
| is-obj | 1.0.1 | MIT | https://github.com/sindresorhus/is-obj |
| is-plain-obj | 1.1.0 | MIT | https://github.com/sindresorhus/is-plain-obj |
| is-string-blank | 1.0.1 | MIT | https://github.com/plotly/is-string-blank |
| is-svg-path | 1.0.2 | MIT (no licence file in package) | https://github.com/dfcreative/is-svg-path |
| math-log2 | 1.0.1 | MIT | https://github.com/sindresorhus/math-log2 |
| mouse-event-offset | 3.0.2 | MIT | https://github.com/mattdesl/mouse-event-offset |
| native-promise-only | 0.8.1 | MIT (no licence file in package) | https://github.com/getify/native-promise-only |
| normalize-svg-path | 1.1.0 | MIT | https://github.com/jkroso/normalize-svg-path |
| object-assign | 4.1.1 | MIT | https://github.com/sindresorhus/object-assign |
| parenthesis | 3.1.8 | MIT | https://github.com/dy/parenthesis |
| parse-rect | 1.2.0 | MIT | https://github.com/dfcreative/parse-rect |
| parse-svg-path | 0.2.0 | MIT | https://github.com/jkroso/parse-svg-path |
| parse-svg-path (nested in svg-path-bounds) | 0.1.2 | MIT | https://github.com/jkroso/parse-svg-path |
| parse-unit | 1.0.1 | MIT | https://github.com/mattdesl/parse-unit |
| pick-by-alias | 1.2.0 | MIT (no licence file in package) | https://github.com/dfcreative/pick-by-alias |
| point-in-polygon | 1.1.0 | MIT | https://github.com/substack/point-in-polygon |
| polybooljs | 1.2.2 | MIT | https://github.com/velipso/polybooljs |
| regl | 2.1.1 | MIT | https://github.com/regl-project/regl |
| regl-error2d | 2.0.12 | MIT | https://github.com/dy/regl-error2d |
| regl-line2d | 3.1.4 | MIT | https://github.com/dy/regl-line2d |
| regl-scatter2d | 3.4.0 | MIT | https://github.com/dy/regl-scatter2d |
| string-split-by | 1.0.0 | MIT (no licence file in package) | https://github.com/dy/string-split-by |
| strongly-connected-components | 1.0.1 | MIT | https://github.com/mikolalysenko/strongly-connected-components |
| svg-arc-to-cubic-bezier | 3.2.0 | ISC | https://github.com/colinmeinke/svg-arc-to-cubic-bezier |
| svg-path-bounds | 1.0.2 | MIT (no licence file in package) | https://github.com/dfcreative/svg-path-bounds |
| svg-path-sdf | 2.0.0 | MIT | https://github.com/dy/svg-path-sdf |
| to-float32 | 1.1.0 | MIT | https://github.com/dy/to-float32 |
| to-px | 1.1.0 | MIT | https://github.com/mikolalysenko/to-px |
| type | 2.7.3 | ISC | https://github.com/medikoo/type |
| typedarray-pool | 1.2.0 | MIT | https://github.com/mikolalysenko/typedarray-pool |
| unquote | 1.1.1 | MIT | https://github.com/lakenen/node-unquote |
| update-diff | 1.1.0 | MIT (no licence file in package) | https://github.com/dfcreative/update-diff |

### Packages inside cosmos.gl (`vendor/cosmos.min.js`)

Read from the esbuild metafile. The `cosmos.min.js` output is byte-for-byte the same as the file
committed before #325. The DOMPurify licence comment is kept at the end of the file, and it names
both Apache-2.0 and MPL-2.0. A comment for regenerator-runtime (MIT) sits in the same file, in
DOMPurify's source.

| Package | Version | Licence | Upstream |
|---|---|---|---|
| @luma.gl/core | 9.3.6 | MIT | https://github.com/visgl/luma.gl |
| @luma.gl/engine | 9.3.6 | MIT | https://github.com/visgl/luma.gl |
| @luma.gl/shadertools | 9.3.6 | MIT | https://github.com/visgl/luma.gl |
| @luma.gl/webgl | 9.3.6 | MIT | https://github.com/visgl/luma.gl |
| @math.gl/core | 4.1.1 | MIT (no licence file in package) | https://github.com/visgl/math.gl |
| @math.gl/types | 4.1.1 | MIT (no licence file in package) | https://github.com/visgl/math.gl |
| @probe.gl/env | 4.1.2 | MIT | https://github.com/visgl/probe.gl |
| @probe.gl/log | 4.1.2 | MIT | https://github.com/visgl/probe.gl |
| @probe.gl/stats | 4.1.2 | MIT | https://github.com/visgl/probe.gl |
| d3-array | 3.2.5 | ISC | https://github.com/d3/d3-array |
| d3-color | 3.1.1 | ISC | https://github.com/d3/d3-color |
| d3-dispatch | 3.0.2 | ISC | https://github.com/d3/d3-dispatch |
| d3-drag | 3.0.1 | ISC | https://github.com/d3/d3-drag |
| d3-ease | 3.0.2 | BSD-3-Clause | https://github.com/d3/d3-ease |
| d3-format | 3.1.3 | ISC | https://github.com/d3/d3-format |
| d3-interpolate | 3.0.2 | ISC | https://github.com/d3/d3-interpolate |
| d3-scale | 4.0.3 | ISC | https://github.com/d3/d3-scale |
| d3-selection | 3.0.1 | ISC | https://github.com/d3/d3-selection |
| d3-time | 3.1.1 | ISC | https://github.com/d3/d3-time |
| d3-time-format | 4.1.1 | ISC | https://github.com/d3/d3-time-format |
| d3-timer | 3.0.2 | ISC | https://github.com/d3/d3-timer |
| d3-transition | 3.0.2 | ISC | https://github.com/d3/d3-transition |
| d3-zoom | 3.0.1 | ISC | https://github.com/d3/d3-zoom |
| dompurify | 3.4.18 | (MPL-2.0 OR Apache-2.0) | https://github.com/cure53/DOMPurify |
| gl-bench | 1.0.42 | MIT | https://github.com/munrocket/gl-bench |
| gl-matrix | 3.4.4 | MIT | https://github.com/toji/gl-matrix |
| random | 4.1.0 | MIT | https://github.com/transitive-bullshit/random |
| seedrandom | 3.0.5 | MIT (no licence file in package) | https://github.com/davidbau/seedrandom |

### Packages inside pdfmake (`dist/bundle.pdf.js`)

`pdfmake.js` is a prebuilt webpack bundle, so esbuild sees one file. The packages below were read
from its `MODULE:` markers, from the names in the file, and from pdfkit's standalone build inside
it. Versions are the installed ones. The copies inside the file were not checked, and the rows say
so where the package is not in `package-lock.json`.

| Package | Version | Licence | Upstream | Note |
|---|---|---|---|---|
| pdfkit | 0.20.2 | MIT | https://github.com/foliojs/pdfkit | Its standalone build is inside `pdfmake.js`, with the packages below it uses. It carries a `Copyright (c) Microsoft Corporation` banner, from a package not identified here. |
| linebreak | 1.1.0 | MIT | https://github.com/devongovett/linebreaker | |
| xmldoc | 2.0.3 | MIT | https://github.com/nfarina/xmldoc | |
| sax (used by xmldoc) | 1.6.1 | BlueOak-1.0.0 | https://github.com/isaacs/sax-js | |
| fontkit (used by pdfkit) | 2.0.4 | MIT | https://github.com/foliojs/fontkit | |
| @noble/ciphers (used by pdfkit) | 1.3.0 | MIT | https://github.com/paulmillr/noble-ciphers | |
| @noble/hashes (used by pdfkit) | 1.8.0 | MIT | https://github.com/paulmillr/noble-hashes | |
| fflate (used by pdfkit) | 0.8.3 | MIT | https://github.com/101arrowz/fflate | |
| png-js (used by pdfkit) | 2.0.0 | MIT (from its `LICENSE` file; its `package.json` has no `license` field) | https://github.com/devongovett/png.js | |
| brotli | 1.3.3 | MIT | https://github.com/devongovett/brotli.js | Its decoder code carries a `Copyright 2013 Google Inc.` banner under the Apache License, Version 2.0. |
| base64-js | 1.5.1 | MIT | https://github.com/beatgammit/base64-js | The copy in `pdfmake.js` was not checked. |
| unicode-trie (used by linebreak) | 2.0.0 | MIT | https://github.com/devongovett/unicode-trie | |
| tiny-inflate | 1.0.3 | MIT | https://github.com/devongovett/tiny-inflate | |
| dfa | 1.2.0 | MIT | https://github.com/devongovett/dfa | |
| clone | 2.1.2 | MIT | https://github.com/pvorb/node-clone | |
| fast-deep-equal | 3.1.3 | MIT | https://github.com/epoberezkin/fast-deep-equal | |
| events | 3.3.0 | MIT | https://github.com/Gozala/events | |
| core-js | Not verified | Not verified | Not verified | Not in `package-lock.json`. Its module markers are in `pdfmake.js`. |
| file-saver | Not verified | Not verified | Not verified | Not in `package-lock.json`. Its module marker is in `pdfmake.js`. |

The Roboto fonts below are in `vfs_fonts.js`, which pdfmake's build includes.

| Bundled in | Package | Version | Licence | Upstream |
|---|---|---|---|---|
| `dist/bundle.pdf.js` (pdfmake, `vfs_fonts.js`) | Roboto (Regular, Italic, Medium, Medium Italic) | Not verified (the font files were checked for their licence and copyright, not for a version number) | SIL Open Font License 1.1 (from the font files' own name table, not from a package) | https://github.com/googlefonts/roboto-classic (copyright line in the font files) |

## Notes and open items

- The full text of each licence is in the package's `LICENSE` file in `node_modules`. Copies of
  those texts are not included in this repository (the MIT, BSD, ISC and Apache-2.0 notice
  conditions apply to redistribution). That has not been done here.
- Packages marked "no licence file in package" have no licence file in `node_modules`. For them,
  the `license` field in `package.json` is the only source checked here. There are 23 such
  packages: 18 in Plotly, 3 in cosmos.gl, `@orchidjs/sifter` and `leaflet.markercluster`.
- The bundles in `dist/` carry no licence comments (see "How this was checked"). Of the files in
  `vendor/`, `papaparse.min.js` keeps its own `@license` comment, and `bioseq.min.js` and
  `patristic.min.js` do not carry a licence banner. This file is the notice for those.
