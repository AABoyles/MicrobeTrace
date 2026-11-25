# Scripts

_A directory for build scripts_

...Because I don't like writing Makefiles.

- [`bundle.js`](https://github.com/aaboyles/MicrobeTrace/blob/master/scripts/bundle.js) -
  Takes all the JS and CSS dependencies and packages them into bundle files (see
  the contents of
  [`dist/`](https://github.com/aaboyles/MicrobeTrace/tree/master/dist)). Each script
  bundle is built by esbuild from an entry module in
  [`entries/`](https://github.com/aaboyles/MicrobeTrace/tree/master/scripts/entries)
  (`primary.js` for what the page needs at once, and one for each lazy bundle: `xlsx`, `table`, `sankey`, `tree`, `alignment`): it imports the npm packages and assigns the
  globals the app's classic scripts use (`d3`, `bootstrap`, ...), so to add a
  library you import it there. Stylesheets are still
  joined and minified with cssnano.

  It also writes `dist/versions.json` (via `write-versions.js`), which records the
  version of every library in `dist/` and `vendor/`, and `inputsHash`, a hash of
  everything the build reads besides `node_modules` (`inputs-hash.js`: the lockfile, the
  build scripts and the entry modules). Run it with `npm run
  bundle` after `npm ci`, then `npm run cache`. The output (`dist/`, `fonts/` and the
  generated files in `vendor/`) is not committed: CI, the Docker build and the Pages
  deploy build it. It is plain Node, so it runs on Windows as well as Linux and macOS (#328).

- [`ensure-built.js`](https://github.com/aaboyles/MicrobeTrace/blob/master/scripts/ensure-built.js) -
  Run by `npm start`, `npm test`, `npm run coverage` and the Playwright web server: runs `bundle.js`
  if the `inputsHash` in `dist/versions.json` differs from the current one (file times are not
  used, since a checkout changes them, #345), or if a bundle, `fonts/` or
  `vendor/cosmos.min.js` is missing, then `build-sw.js`.

- `npm run build` runs `bundle`, `cache` and `site` in that order.

- [`build-sw.js`](https://github.com/aaboyles/MicrobeTrace/blob/master/scripts/build-sw.js) -
  (`npm run cache`) Writes `sw.js` (not committed) from
  [`sw.template.js`](https://github.com/aaboyles/MicrobeTrace/blob/master/scripts/sw.template.js),
  filling in the precache list and cache name from the files that exist, so run it after
  `bundle`. The service worker's own code lives in the template. Only the app shell is
  precached (`shellList()`: `index.html` and what it loads, the modules those import, the
  primary bundle, the Files view, workers, vendor, fonts and images); every other file, such as the
  lazy library bundles and the other views, is cached the first time it is fetched (#343).
  The cache name hashes all of the app's files, so a changed view is a new version too.

- To deploy only the files the app needs (for example, to a static host), run
  [`node scripts/build-site.js`](https://github.com/aaboyles/MicrobeTrace/blob/master/scripts/build-site.js).
  It copies exactly those files into `_site/` and leaves everything else in the repository behind.
  It also writes a Brotli (`.br`) and a gzip (`.gz`) copy of each text file of 1 KB or more,
  which `server.js` sends to browsers that accept them (#350); `server.js` compresses nothing
  itself, so serve the built site (`SITE_DIR=_site npm start`, as the Docker image does).

- [`build-bx.sh`](https://github.com/aaboyles/MicrobeTrace/blob/master/scripts/build-bx.sh) -
  Rebuilds the [bx-distance-models](https://github.com/AABoyles/bx-distance-models)
  WebAssembly distance engine from a local checkout and copies it into
  [`vendor/`](https://github.com/aaboyles/MicrobeTrace/tree/master/vendor).
