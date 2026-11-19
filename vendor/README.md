# The `vendor` Directory

This is the odd directory of MicrobeTrace dependencies that can't be bundled. for the Javascripts, this is probably because we need accessible to `importScripts` in Workers. For others, it's probably because of some CSS relative path shenanigans.

The version of each library here (and in `dist/`) is recorded in `dist/versions.json`, which `scripts/bundle.sh` writes.

Either way, most of this directory is built by copying or building from `node_modules` (`npm run bundle`), and isn't committed (#325): `npm start`, CI, the Pages deploy and the Docker build build it. Only what isn't on NPM is committed: this README and the bx-distance-models build below.

## bx-distance-models

`bx_distance_models.js` and `bx_distance_models_bg.wasm` are the WebAssembly build of
[bx-distance-models](https://github.com/AABoyles/bx-distance-models), the engine that
`workers/compute-links.js` uses to compute genetic distances (TN93, TN92, K2P, JC69, SNPs,
Hamming, p-distance, transitions, transversions and Ts/Tv ratio). It isn't published to NPM, so
rebuild it from a checkout with `scripts/build-bx.sh path/to/bx-distance-models` and commit the result (needs Rust with
the `wasm32-unknown-unknown` target and `wasm-pack`). The committed build is from commit `f0fb4cf` (bx-distance-models PR #7, ape reference tests; built with Rust 1.100.0 and wasm-pack 0.15.1). Since `39f47f3` it implements TN92 as Tamura (1992) (3cb2ca9), no longer caps corrected distances at 1 (they can exceed 1, or be `Infinity` when the model saturates, with no Hamming fallback), and returns `NaN` rather than 1 for a pair with no comparable sites. Consumers of distances have to tolerate both.

`tn93.min.js` is still used to encode sequences (`_seqInt`) and by
`workers/compute-links-legacy.js`, which handles the GapMM ambiguity strategy that
bx-distance-models doesn't implement.

`tn93.min.js` is a local patch of tn93 0.3.5 from NPM. Its `resolutionsCount` table (the weight
of each resolution in GapMM) had one extra 0.5 entry, shifting every later weight by one index,
so B, N and gaps were weighted wrongly. The table is now derived from `resolutions` (1 / number of
bases the code covers, 0 if none) and no other part of the file was changed. The fix is applied
automatically: `scripts/bundle.sh` builds it with `scripts/patch-tn93.js`, which fails if a new tn93
release no longer contains the table it fixes. Test: `test/unit/golden-distances.test.js`.

## cosmos.gl

`cosmos.min.js` is a build of [cosmos.gl](https://github.com/cosmosgl/graph) (`@cosmos.gl/graph`
3.6.0, MIT), which lays out and draws the 2D network on the GPU. `components/network.html` loads
it the first time that view opens. `scripts/bundle.sh` builds it from `node_modules` unpatched: since
3.6 cosmos.gl shifts the many-body force's grid every tick itself, which the earlier local patch did.
