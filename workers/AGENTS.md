# Workers (workers/)

Classic (non-module) Web Workers, started through `MT.runWorker(script, message, options)` in
`src/common.js`, one worker per call.

- A worker sets `onmessage`, does one job, replies once with `postMessage` and calls `close()`.
  Send large numeric results as typed-array buffers in the transfer list, not JSON.
- Libraries come from `vendor/` with `importScripts('../vendor/...')`, never from `dist/` or the
  network. A library a worker needs must be copied into `vendor/` by `scripts/bundle.sh`.
- No DOM, and nothing from `MT`. Keep workers pure functions of their message: the golden tests
  (`test/golden/harness.js`) run them in a Node `vm` context with only `importScripts`, `fetch`
  (for the WebAssembly in `vendor/`), `postMessage`, `close` and a few globals.
- Distances from `compute-links.js` (bx-distance-models) can be `NaN` or `Infinity` and can exceed
  1. `compute-links-legacy.js` (tn93.js) exists only for the GapMM ambiguity strategy.
- A numerical change should be checked against `test/golden/`, whose expected values come from an
  independent implementation; don't regenerate them to match new output.
- After adding or renaming a worker, run `npm run cache`.
