# Scripts

_A directory for shell scripts_

...Because I don't like writing Makefiles.

- [`bundle.sh`](https://github.com/aaboyles/MicrobeTrace/blob/dev/scripts/bundle.sh) -
  Takes all the JS and CSS dependencies and packages them into bundle files (see
  the contents of
  [`dist/`](https://github.com/aaboyles/MicrobeTrace/tree/dev/dist)).
  Packages that only ship ES modules (screenfull, devtools-detect) are wrapped to
  set their usual globals, and Plotly is built with esbuild from
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

- [`cleanup.sh`](https://github.com/aaboyles/MicrobeTrace/blob/dev/scripts/compress.sh) -
  Removes all compressed files.

- [`build-sw.js`](https://github.com/aaboyles/MicrobeTrace/blob/dev/scripts/build-sw.js) -
  (`npm run cache`) Regenerates the precache list and cache name in
  [`sw.js`](https://github.com/aaboyles/MicrobeTrace/blob/dev/sw.js) from the
  files that exist. Run it after changing any file the app loads; `npm test`
  fails if `sw.js` is out of date.

- [`excise.sh`](https://github.com/aaboyles/MicrobeTrace/blob/dev/scripts/excise.sh) -
  Deletes everything MicrobeTrace doesn't need in order to run. **Don't use this
  unless you're deploying to a system with very little free space, or other
  weird constraints.**

- [`build-bx.sh`](https://github.com/aaboyles/MicrobeTrace/blob/dev/scripts/build-bx.sh) -
  Rebuilds the [bx-distance-models](https://github.com/AABoyles/bx-distance-models)
  WebAssembly distance engine from a local checkout and copies it into
  [`vendor/`](https://github.com/aaboyles/MicrobeTrace/tree/dev/vendor).
