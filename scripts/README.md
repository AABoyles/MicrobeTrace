# Scripts

_A directory for shell scripts_

...Because I don't like writing Makefiles.

- [`bundle.sh`](https://github.com/aaboyles/MicrobeTrace/blob/master/scripts/bundle.sh) -
  Takes all the JS and CSS dependencies and packages them into bundle files (see
  the contents of
  [`dist/`](https://github.com/aaboyles/MicrobeTrace/tree/master/dist)).
  Packages that only ship ES or CommonJS modules (golden-layout 2,
  `@cosmos.gl/graph`) are bundled with esbuild into browser scripts that set
  their globals, and Plotly is built with esbuild from
  [`plotly-bundle.js`](https://github.com/aaboyles/MicrobeTrace/blob/master/scripts/plotly-bundle.js)
  so it carries exactly the traces MicrobeTrace draws (Plotly's prebuilt partial
  bundles leave out the sankey trace the flow diagram needs).

  It also applies the local patches (`patch-tn93.js`, `patch-tidytree.js`) and
  writes `dist/versions.json` (via `write-versions.js`), which records the
  version of every library in `dist/` and `vendor/`. Its output isn't
  committed (#325): `npm start` runs it when `dist/` is missing (through
  `ensure-built.js`), and CI, the Pages deploy and the Docker build run it each
  time. Run it with `npm run bundle` after changing a dependency, then `npm run
  cache`.

- `npm run build` runs `bundle`, `cache` and `compress` in that order.

- [`compress.sh`](https://github.com/aaboyles/MicrobeTrace/blob/master/scripts/compress.sh) -
  Generates compressed versions of the largest, most important files to
  MicrobeTrace. On systems that run
  [`server.js`](https://github.com/aaboyles/MicrobeTrace/blob/master/server.js), the
  compressed versions will get served, resulting in faster loadtimes.

- [`cleanup.sh`](https://github.com/aaboyles/MicrobeTrace/blob/master/scripts/cleanup.sh) -
  Removes all compressed files.

- [`build-sw.js`](https://github.com/aaboyles/MicrobeTrace/blob/master/scripts/build-sw.js) -
  (`npm run cache`) Writes the service worker, `sw.js`, from
  [`sw.template.js`](https://github.com/aaboyles/MicrobeTrace/blob/master/scripts/sw.template.js),
  filling in the precache list and a cache name built from the files that exist.
  `sw.js` isn't committed (#325); `npm start` writes it each time, after the
  bundles.

- [`ensure-built.js`](https://github.com/aaboyles/MicrobeTrace/blob/master/scripts/ensure-built.js) -
  Runs before `npm start`: builds `dist/`, `vendor/` and `fonts/` if they're
  missing, then writes `sw.js`. Building needs the dev dependencies, so after
  `npm ci --omit=dev` it stops and says so.

- To deploy only the files the app needs (for example, to a static host), run
  [`node scripts/build-site.js`](https://github.com/aaboyles/MicrobeTrace/blob/master/scripts/build-site.js).
  It copies exactly those files into `_site/` and leaves everything else in the repository behind.

- [`build-bx.sh`](https://github.com/aaboyles/MicrobeTrace/blob/master/scripts/build-bx.sh) -
  Rebuilds the [bx-distance-models](https://github.com/AABoyles/bx-distance-models)
  WebAssembly distance engine from a local checkout and copies it into
  [`vendor/`](https://github.com/aaboyles/MicrobeTrace/tree/master/vendor).
