# Scripts

_A directory for build scripts_

...Because I don't like writing Makefiles.

- [`bundle.js`](https://github.com/aaboyles/MicrobeTrace/blob/master/scripts/bundle.js) -
  Takes all the JS and CSS dependencies and packages them into bundle files (see
  the contents of
  [`dist/`](https://github.com/aaboyles/MicrobeTrace/tree/master/dist)).
  Packages that only ship ES or CommonJS modules (golden-layout 2,
  `@cosmos.gl/graph`) are bundled with esbuild into browser scripts that set
  their globals, and Plotly is built with esbuild from
  [`plotly-bundle.js`](https://github.com/aaboyles/MicrobeTrace/blob/master/scripts/plotly-bundle.js)
  so it carries exactly the traces MicrobeTrace draws (Plotly's prebuilt partial
  bundles leave out the sankey trace the flow diagram needs).

  It also writes `dist/versions.json` (via `write-versions.js`), which records the
  version of every library in `dist/` and `vendor/`. Run it with `npm run
  bundle` after `npm ci`, then `npm run cache`. The output (`dist/`, `fonts/` and the
  generated files in `vendor/`) is not committed: CI, the Docker build and the Pages
  deploy build it. It is plain Node, so it runs on Windows as well as Linux and macOS (#328).

- [`ensure-built.js`](https://github.com/aaboyles/MicrobeTrace/blob/master/scripts/ensure-built.js) -
  Run by `npm start`, `npm test`, `npm run coverage` and the Playwright web server: runs `bundle.js`
  if `dist/` is missing or older than `package-lock.json` or `bundle.js`, or if `fonts/` or
  `vendor/cosmos.min.js` is missing, then `build-sw.js`.

- `npm run build` runs `bundle`, `cache` and `compress` in that order.

- [`compress.sh`](https://github.com/aaboyles/MicrobeTrace/blob/master/scripts/compress.sh) -
  Generates compressed versions of the largest, most important files to
  MicrobeTrace. On systems that run
  [`server.js`](https://github.com/aaboyles/MicrobeTrace/blob/master/server.js), the
  compressed versions will get served, resulting in faster loadtimes.

- [`cleanup.sh`](https://github.com/aaboyles/MicrobeTrace/blob/master/scripts/cleanup.sh) -
  Removes all compressed files.

- [`build-sw.js`](https://github.com/aaboyles/MicrobeTrace/blob/master/scripts/build-sw.js) -
  (`npm run cache`) Writes `sw.js` (not committed) from
  [`sw.template.js`](https://github.com/aaboyles/MicrobeTrace/blob/master/scripts/sw.template.js),
  filling in the precache list and cache name from the files that exist, so run it after
  `bundle`. The service worker's own code lives in the template.

- To deploy only the files the app needs (for example, to a static host), run
  [`node scripts/build-site.js`](https://github.com/aaboyles/MicrobeTrace/blob/master/scripts/build-site.js).
  It copies exactly those files into `_site/` and leaves everything else in the repository behind.

- [`build-bx.sh`](https://github.com/aaboyles/MicrobeTrace/blob/master/scripts/build-bx.sh) -
  Rebuilds the [bx-distance-models](https://github.com/AABoyles/bx-distance-models)
  WebAssembly distance engine from a local checkout and copies it into
  [`vendor/`](https://github.com/aaboyles/MicrobeTrace/tree/master/vendor).
