# Scripts

_A directory for shell scripts_

...Because I don't like writing Makefiles.

- [`bundle.sh`](https://github.com/aaboyles/MicrobeTrace/blob/dev/scripts/bundle.sh) -
  Takes all the JS and CSS dependencies and packages them into bundle files (see
  the contents of
  [`dist/`](https://github.com/aaboyles/MicrobeTrace/tree/dev/dist)).
  Packages that only ship ES or CommonJS modules (golden-layout 2,
  `@cosmos.gl/graph`) are bundled with esbuild into browser scripts that set
  their globals, and Plotly is built with esbuild from
  [`plotly-bundle.js`](https://github.com/aaboyles/MicrobeTrace/blob/dev/scripts/plotly-bundle.js)
  so it carries exactly the traces MicrobeTrace draws (Plotly's prebuilt partial
  bundles leave out the sankey trace the flow diagram needs).

  It also applies the local patches (`patch-tn93.js`, `patch-tidytree.js`) and
  writes `dist/versions.json` (via `write-versions.js`), which records the
  version of every library in `dist/` and `vendor/`. Run it with `npm run
  bundle` after `npm ci`, then `npm run cache`, and commit the result: CI
  rebuilds both and fails if they differ from what was committed.

- `npm run build` runs `bundle`, `cache` and `compress` in that order.

- [`compress.sh`](https://github.com/aaboyles/MicrobeTrace/blob/dev/scripts/compress.sh) -
  Generates compressed versions of the largest, most important files to
  MicrobeTrace. On systems that run
  [`server.js`](https://github.com/aaboyles/MicrobeTrace/blob/dev/server.js), the
  compressed versions will get served, resulting in faster loadtimes.

- [`cleanup.sh`](https://github.com/aaboyles/MicrobeTrace/blob/dev/scripts/cleanup.sh) -
  Removes all compressed files.

- [`build-sw.js`](https://github.com/aaboyles/MicrobeTrace/blob/dev/scripts/build-sw.js) -
  (`npm run cache`) Regenerates the precache list and cache name in
  [`sw.js`](https://github.com/aaboyles/MicrobeTrace/blob/dev/sw.js) from the
  files that exist. Run it after changing any file the app loads; `npm test`
  fails if `sw.js` is out of date.

- To deploy only the files the app needs (for example, to a static host), run
  [`node scripts/build-site.js`](https://github.com/aaboyles/MicrobeTrace/blob/dev/scripts/build-site.js).
  It copies exactly those files into `_site/` and leaves everything else in the repository behind.

- [`build-bx.sh`](https://github.com/aaboyles/MicrobeTrace/blob/dev/scripts/build-bx.sh) -
  Rebuilds the [bx-distance-models](https://github.com/AABoyles/bx-distance-models)
  WebAssembly distance engine from a local checkout and copies it into
  [`vendor/`](https://github.com/aaboyles/MicrobeTrace/tree/dev/vendor).
