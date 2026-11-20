# Third-party notices

MicrobeTrace redistributes the third-party code and fonts listed below in `dist/`, `vendor/`
and `fonts/`. This file gives each one's version, licence and upstream project. The project's own
licence (Apache-2.0) is in `LICENSE`, and `NOTICE` gives the project's copyright.

## How this was checked

- **Versions** come from `dist/versions.json` (written by `scripts/write-versions.js`) and from
  `package-lock.json`. The two agree for every top-level package below. The installed copies in
  `node_modules` (checked from the main checkout, which has `node_modules`) match the lockfile.
- **Licences** come from each package's `package.json` `license` field and its `LICENSE` file.
- **What goes into each bundle** comes from `scripts/bundle.sh`. For the two packages built by
  esbuild (`vendor/cosmos.min.js` and the Plotly part of `dist/bundle.secondary.js`), the packages
  actually included were read from an esbuild metafile, built with the same command. The
  `cosmos.min.js` output matches the committed file byte for byte, and a sample of the Plotly
  output appears verbatim in `dist/bundle.secondary.js`.
- **Upstream URLs** come from each package's `repository` or `homepage` field. Where the field
  is missing, the URL is marked.
- **Marks.** "Not verified" means the item could not be checked from the repository or
  `node_modules`.

Only the licence name is given here. The full licence texts are in the `LICENSE` file of each
package in `node_modules`, and the copyright lines are in the same files. They are not copied here.

## Top-level libraries

### `dist/` (JavaScript and CSS)

| Library | Version | Licence | Upstream | Where it appears |
|---|---|---|---|---|
| Bootstrap | 5.3.8 | MIT | https://github.com/twbs/bootstrap | `bundle.primary.js` (JS, with Popper below), `bundle.primary.css` |
| Popper (`@popperjs/core`, inside Bootstrap's bundle) | 2.11.8 | MIT | https://github.com/popperjs/popper-core | `bundle.primary.js` (inside the Bootstrap bundle). The version is the installed `@popperjs/core`; the copy inside the bundle was not checked separately. |
| Bootstrap Icons (CSS) | 1.13.2 | MIT | https://github.com/twbs/icons | `bundle.primary.css` (its CSS, with font paths rewritten to `../fonts/`) |
| golden-layout | 2.6.0 | MIT | https://github.com/golden-layout/golden-layout | `bundle.primary.js`, `bundle.primary.css` (base and light theme CSS) |
| tom-select | 2.6.2 | Apache-2.0 | https://github.com/orchidjs/tom-select | `bundle.primary.js`, `bundle.secondary.css` |
| PapaParse | 5.7.0 | MIT | https://github.com/mholt/PapaParse | `bundle.primary.js`, `vendor/papaparse.min.js` |
| JSZip | 3.10.2 | MIT OR GPL-3.0-or-later (dual; upstream offers either, and MIT is the one named here) | https://github.com/Stuk/jszip | `bundle.primary.js` |
| SheetJS (`xlsx`, core build) | 0.20.3 | Apache-2.0 | https://git.sheetjs.com/SheetJS/sheetjs | `bundle.primary.js` |
| D3 | 7.9.0 | ISC | https://github.com/d3/d3 | `bundle.primary.js` |
| Tabulator (`tabulator-tables`) | 6.6.1 | MIT | https://github.com/tabulator-tables/tabulator | `bundle.primary.js`, `bundle.primary.css` |
| d3-symbol-extra | 0.1.0 | BSD-3-Clause | https://github.com/YellowTugboat/d3-symbol-extra | `bundle.secondary.js` |
| d3-polygon | 3.0.1 | ISC | https://github.com/d3/d3-polygon | `bundle.secondary.js` |
| Plotly.js (built from `scripts/plotly-bundle.js`, see below) | 4.1.2 | MIT | https://github.com/plotly/plotly.js | `bundle.secondary.js` |
| TidyTree (locally patched) | 0.7.0 (patched) | Apache-2.0 | https://github.com/cdcgov/TidyTree | `bundle.secondary.js`. Embeds Patristic 0.5.7 (below). |
| Leaflet | 1.9.4 | BSD-2-Clause | https://github.com/Leaflet/Leaflet | `bundle.secondary.js`, `bundle.secondary.css` |
| Leaflet.markercluster | 1.5.3 | MIT | https://github.com/Leaflet/Leaflet.markercluster | `bundle.secondary.js`, `bundle.secondary.css` |
| html5sortable | 0.14.0 | MIT | https://github.com/lukasoppermann/html5sortable | `bundle.secondary.js` |
| alignment-viewer | 0.3.4 | Apache-2.0 | https://github.com/CDCgov/AlignmentViewer | `bundle.secondary.js` |
| pdfmake | 0.3.11 | MIT | https://github.com/bpampuch/pdfmake | `bundle.secondary.js`. Embeds pdfkit, linebreak and xmldoc (below). |
| pdfmake virtual font files (`vfs_fonts.js`) | from pdfmake 0.3.11 | See "Fonts embedded in pdfmake" below | | `bundle.secondary.js` |

### `vendor/` (JavaScript and WebAssembly)

| File | Library | Version | Licence | Upstream |
|---|---|---|---|---|
| `vendor/bioseq.min.js` | bioseq | 0.1.5 | Apache-2.0 | https://github.com/CDCgov/bioseq-js |
| `vendor/cosmos.min.js` | @cosmos.gl/graph (built with esbuild; see the packages it includes below) | 3.6.0 | MIT | https://github.com/cosmosgl/graph |
| `vendor/papaparse.min.js` | PapaParse | 5.7.0 | MIT | https://github.com/mholt/PapaParse |
| `vendor/patristic.min.js` | Patristic | 0.6.0 | Apache-2.0 | https://github.com/CDCgov/patristic |
| `vendor/bx_distance_models.js`, `vendor/bx_distance_models_bg.wasm` | bx-distance-models (not on NPM; built from commit `970bba4`, per `vendor/README.md`) | Commit `970bba4` (0.2.0) | **Not verified.** No licence file is in this repository or the build inputs, and the upstream licence was not checked. | https://github.com/AABoyles/bx-distance-models |

### `fonts/`

| File | Font | Version | Licence | Upstream |
|---|---|---|---|---|
| `fonts/bootstrap-icons.woff`, `fonts/bootstrap-icons.woff2` | Bootstrap Icons | 1.13.2 | MIT | https://github.com/twbs/icons |

Both files are byte-for-byte copies of `node_modules/bootstrap-icons/font/fonts/`.

## Packages inside the bundles

Some bundled files contain code from packages that are not top-level dependencies here.

### Packages inside Plotly (`dist/bundle.secondary.js`)

Packages included by `scripts/plotly-bundle.js`, read from the esbuild metafile. Versions are the
ones esbuild resolved from `node_modules`. Where a version was nested under another package,
the nested copy is used.

| Package | Version | Licence | Upstream |
|---|---|---|---|
| plotly.js | 4.1.2 | MIT | https://github.com/plotly/plotly.js |
| maplibre-gl | 6.11.2 | BSD-3-Clause | https://github.com/maplibre/maplibre-gl-js |
| @plotly/d3 | 3.8.2 | BSD-3-Clause | https://github.com/plotly/d3 |
| @plotly/d3-sankey | 0.12.3 | BSD-3-Clause | https://github.com/plotly/d3-sankey |
| @plotly/d3-sankey-circular | 0.33.1 | MIT | https://github.com/plotly/d3-sankey-circular |
| culori | 4.0.2 | MIT | https://github.com/Evercoder/culori |
| base64-arraybuffer | 1.0.2 | MIT | https://github.com/niklasvh/base64-arraybuffer |
| d3-array (nested in @plotly/d3-sankey) | 2.12.1 | BSD-3-Clause | https://github.com/d3/d3-array |
| d3-collection | 1.0.7 | BSD-3-Clause | https://github.com/d3/d3-collection |
| d3-color | 3.1.0 | ISC | https://github.com/d3/d3-color |
| d3-dispatch (nested in plotly.js) | 1.0.6 | BSD-3-Clause | https://github.com/d3/d3-dispatch (nested copy's `repository` not checked) |
| d3-force (nested in plotly.js) | 1.2.1 | BSD-3-Clause | https://github.com/d3/d3-force (nested copy's `repository` not checked) |
| d3-format (nested in plotly.js) | 1.4.5 | BSD-3-Clause | https://github.com/d3/d3-format (nested copy's `repository` not checked) |
| d3-interpolate | 3.0.1 | ISC | https://github.com/d3/d3-interpolate |
| d3-path (nested in @plotly/d3-sankey) | 1.0.9 | BSD-3-Clause | https://github.com/d3/d3-path (nested copy's `repository` not checked) |
| d3-quadtree (nested in plotly.js) | 1.0.7 | BSD-3-Clause | https://github.com/d3/d3-quadtree (nested copy's `repository` not checked) |
| d3-shape (nested in @plotly/d3-sankey) | 1.3.7 | BSD-3-Clause | https://github.com/d3/d3-shape (nested copy's `repository` not checked) |
| d3-time (nested in plotly.js) | 1.1.0 | BSD-3-Clause | https://github.com/d3/d3-time (nested copy's `repository` not checked) |
| d3-time-format (nested in plotly.js) | 2.3.0 | BSD-3-Clause | https://github.com/d3/d3-time-format (nested copy's `repository` not checked) |
| d3-timer (nested in plotly.js) | 1.0.10 | BSD-3-Clause | https://github.com/d3/d3-timer (nested copy's `repository` not checked) |
| elementary-circuits-directed-graph | 1.3.1 | MIT | https://github.com/antoinerg/elementary-circuits-directed-graph |
| events | 3.3.0 | MIT | https://github.com/Gozala/events |
| fast-isnumeric | 1.1.4 | MIT | https://github.com/plotly/fast-isnumeric |
| gl-mat4 | 1.2.0 | Zlib | https://github.com/stackgl/gl-mat4 |
| has-hover | 1.0.1 | MIT | https://github.com/dfcreative/has-hover |
| has-passive-events | 1.0.0 | MIT | https://github.com/dfcreative/has-passive-events |
| is-browser | 2.1.0 | MIT | https://github.com/ForbesLindesay/is-browser |
| is-mobile | 5.0.0 | MIT | https://github.com/juliangruber/is-mobile |
| is-string-blank | 1.0.1 | MIT | https://github.com/plotly/is-string-blank |
| mouse-event-offset | 3.0.2 | MIT | https://github.com/mattdesl/mouse-event-offset |
| native-promise-only | 0.8.1 | MIT | https://github.com/getify/native-promise-only |
| parse-svg-path | 0.2.0 | MIT | https://github.com/jkroso/parse-svg-path |
| point-in-polygon | 1.1.0 | MIT | https://github.com/substack/point-in-polygon |
| polybooljs | 1.2.2 | MIT | https://github.com/velipso/polybooljs |
| strongly-connected-components | 1.0.1 | MIT | https://github.com/mikolalysenko/strongly-connected-components |

### Packages inside cosmos.gl (`vendor/cosmos.min.js`)

Read from the esbuild metafile. The `cosmos.min.js` output matches the committed file byte for byte.

| Package | Version | Licence | Upstream |
|---|---|---|---|
| @cosmos.gl/graph | 3.6.0 | MIT | https://github.com/cosmosgl/graph |
| @luma.gl/core, @luma.gl/engine, @luma.gl/shadertools, @luma.gl/webgl | 9.3.6 | MIT | https://github.com/visgl/luma.gl |
| @math.gl/core, @math.gl/types | 4.1.0 | MIT | https://github.com/visgl/math.gl |
| @probe.gl/env, @probe.gl/log, @probe.gl/stats | 4.1.2 | MIT | https://github.com/visgl/probe.gl |
| DOMPurify | 3.4.18 | MPL-2.0 OR Apache-2.0 (dual; the banner in the bundle says Apache 2.0 and MPL 2.0) | https://github.com/cure53/DOMPurify |
| gl-bench | 1.0.42 | MIT | https://github.com/munrocket/gl-bench |
| gl-matrix | 3.4.4 | MIT | https://github.com/toji/gl-matrix |
| random | 4.1.0 | MIT | https://github.com/transitive-bullshit/random |
| seedrandom | 3.0.5 | MIT | https://github.com/davidbau/seedrandom |
| internmap | 2.0.3 | ISC | https://github.com/mbostock/internmap |
| d3-array | 3.2.4 | ISC | https://github.com/d3/d3-array |
| d3-color | 3.1.0 | ISC | https://github.com/d3/d3-color |
| d3-dispatch | 3.0.1 | ISC | https://github.com/d3/d3-dispatch |
| d3-drag | 3.0.0 | ISC | https://github.com/d3/d3-drag |
| d3-ease | 3.0.1 | BSD-3-Clause | https://github.com/d3/d3-ease |
| d3-format | 3.1.2 | ISC | https://github.com/d3/d3-format |
| d3-interpolate | 3.0.1 | ISC | https://github.com/d3/d3-interpolate |
| d3-scale | 4.0.2 | ISC | https://github.com/d3/d3-scale |
| d3-selection | 3.0.0 | ISC | https://github.com/d3/d3-selection |
| d3-time | 3.1.0 | ISC | https://github.com/d3/d3-time |
| d3-time-format | 4.1.0 | ISC | https://github.com/d3/d3-time-format |
| d3-timer | 3.0.1 | ISC | https://github.com/d3/d3-timer |
| d3-transition | 3.0.1 | ISC | https://github.com/d3/d3-transition |
| d3-zoom | 3.0.0 | ISC | https://github.com/d3/d3-zoom |

Note: the licence banner of `d3-*` packages (ISC) is not kept in the minified file.

### Packages inside other bundled files

| Bundled in | Package | Version | Licence | Upstream |
|---|---|---|---|---|
| `dist/bundle.secondary.js` (TidyTree) | Patristic (nested under TidyTree) | 0.5.7 | Apache-2.0 | https://github.com/CDCgov/patristic |
| `dist/bundle.secondary.js` (pdfmake) | pdfkit | 0.19.1 | MIT | https://github.com/foliojs/pdfkit |
| `dist/bundle.secondary.js` (pdfmake) | linebreak | 1.1.0 | MIT | https://github.com/devongovett/linebreaker |
| `dist/bundle.secondary.js` (pdfmake) | xmldoc | 2.0.3 | MIT | https://github.com/nfarina/xmldoc |
| `dist/bundle.secondary.js` (pdfmake, `vfs_fonts.js`) | Roboto (Regular, Italic, Medium, Medium Italic) | Not verified (the font files were checked for their licence and copyright, not for a version number) | SIL Open Font License 1.1 (from the font files' own name table, not from a package) | https://github.com/googlefonts/roboto-classic (copyright line in the font files) |

The Patristic embedded in TidyTree is version 0.5.7, as TidyTree's own dependency declares. The
top-level `patristic` (0.6.0) is the one in `vendor/patristic.min.js`.

## Notes and open items

- The full text of each licence is in the package's `LICENSE` file in `node_modules`. Copies of
  those texts are not included in this repository (the MIT, BSD, ISC and Apache-2.0 notice
  conditions apply to redistribution). That has not been done here.
- Several minified files in `vendor/` (`bioseq.min.js`, `patristic.min.js`) and the Leaflet and Tabulator builds that are bundled (`leaflet.js`, `tabulator.min.js`) do not carry their own licence banner. This
  file is the notice for them.
- `dist/bundle.secondary.js` carries the banners esbuild and pdfmake keep (for example pdfmake's
  "@license MIT" and esbuild's bundled-licence comment for polybooljs).
