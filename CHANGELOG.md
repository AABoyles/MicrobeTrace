# Changelog

The version is the `version` in `package.json`. Help > About shows it, with the commit the site was built from. Numbers in brackets are the pull requests that made each change.

## Unreleased

### Analysis

- Genetic distances agree with HIV-TRACE's tn93 in every ambiguity strategy (bx-distance-models 0.2.0). GapMM weighs a gap facing a base as one site, not 4/3 (#282), and works with every distance metric. MicrobeTrace no longer loads tn93.js.
- **Sequences with N are farther apart under Average, the default ambiguity strategy.** N and ? now count as any base when resolving or averaging, as tn93 does, instead of being skipped: under Average an N facing a base is three quarters of a mismatch, and under HIV-TRACE -g it counts toward the ambiguity fraction. Resolve barely changes (an N facing a base is a match, where it used to be left out). On the test data (300 sequences, most with a few N), TN93 links within 0.015 fall from 466 to 289 under Average and from 483 to 453 under HIV-TRACE -g. Resolve gives nearly the same links as before.

### Files and sessions

- A Newick tree loads together with a FASTA file of the same IDs; it used to fail with "source.add is not a function". When one file can't be read, the load is reported as failed only after the other files have finished.

### Reliability and performance

- The page loads faster. Its startup scripts are 1.6 MB instead of 4.9 MB: the spreadsheet, table, Plotly, map, tree, alignment and PDF libraries load the first time a feature needs them. (#324)
- The service worker stores the app's shell when it is installed, and the other files (the other views and the libraries) the first time they are used, so a first visit downloads less. Whatever has been opened still works offline. (#343)

### Build, deployment and project

- `dist/`, `vendor/`, `fonts/` and `sw.js` are no longer committed: CI, the Pages deploy and the Docker build bundle them from the lockfile, and `npm start` does when they are missing. A copy of the repository needs `npm ci && npm run bundle && npm run cache` before it can be deployed. (#325)
- `npm run bundle` is a Node script (`scripts/bundle.js`) instead of bash, so the bundles build on Windows. (#328)
- The core of the app (`src/common.js` and the files split from it, and the settings, events, graph, nodes, dates and database stores) loads as native ES modules, with no build step. The file loader and the network view are broken into named functions. (#323, #240)
- Views are ES modules loaded with `import()`, each exporting `mount`. File formats are one module each in `src/formats/`, WebMCP tools one file each under `src/webmcp/`, and the session's data is written through `MT.session`, which emits `session-data-change`; a lint rule rejects direct writes. (#337, #338, #339, #340)
- `createMT` builds `MT` for the page and for the tests, which import it instead of running the code in a `vm` context. `test/app-files.js` is gone. (#341)
- Bundles are built by esbuild from entry modules in `scripts/entries/`, and are rebuilt when a hash of their inputs changes, not when file times change. The Docker build installs dependencies once and prunes the dev dependencies before it finishes. (#342, #344, #345)
- ESLint reports no warnings: `no-unused-vars` and `eqeqeq` are errors, and `npm run typecheck` runs tsc over the JSDoc-annotated modules in CI. (#346)

## 0.7.1 (2026-11-20)

### Analysis

- Smith-Waterman alignment is much faster (bioseq 0.2.0), and has a Band Width setting: how far a gap may shift a sequence against the reference. A narrower band is faster; a blank band compares every position.

### Views and interface

- Links can be told apart by dash pattern as well as color (Dash By), and node shapes are suggested when a color variable has many values. (#294)
- In the network, G selects the focused node's neighbours and takes in one more link each press; Shift+G adds them to the selection. (#295)
- The tree, heatmap and sequences views compute in the background, with progress and a Cancel button. (#293)
- Toggle buttons work and show their state without a compatibility script, and the network's pin button shows when an AI agent pinned the nodes. (#326)

### Files and sessions

- A file cut off mid-row keeps its header, instead of reporting that no columns were found. (#172)
- A distance matrix with a repeated ID, or cut off before a node's row, is refused with a message naming the ID. (#172)
- The loading log says correctly that a repeated ID keeps its first row's values. (#172)
- Sequences that differ only in letter case are no longer reported as conflicting between files.
- The demo session uses the current field names and has all 88 nodes, and the demo files agree on their IDs. (#297)

### Reliability and performance

- The timeline no longer stops with an error when a variable's color table isn't cached. (#243)
- Changes the timeline and the color tables make to settings reach the views that follow them. (#327)
- WebMCP tools refuse arguments that don't match their schema before they run or ask you to allow them, and no longer depend on the page's markup. (#176, #242)
- Timing messages are printed only when debugging is on. (#239)

### Build, deployment and project

- ESLint runs in CI, and the code has no undefined names. (#243)
- `src/common.js` is split by subject into seven scripts. (#240)
- The unused triangulation and patristic-matrix workers and other dead code are removed. (#238)
- Unit-test coverage is reported in CI, and there are more tests for malformed input and the workers. End-to-end tests wait on page state instead of fixed delays, and fail on failed requests. (#170, #172, #175, #178)
- TidyTree 0.8.1 fixes the bugs that local patches worked around, and the d3 and Bootstrap compatibility shims are gone. (#326)
- Dependencies are updated, and `AGENTS.md` files describe the codebase for coding agents.

## 0.7.0 (2026-11-19)

Changes since 0.6.2 (June 2020).

### Analysis

- Distances are computed by bx-distance-models, a WebAssembly engine. The metrics are TN93, TN92, K2P, JC69, SNPs, Hamming, p-distance, transitions, transversions and the Ts/Tv ratio, each with its own default threshold. (#119)
- Several metrics can be computed for the same sequences, and links can be filtered on any of them, each with its own threshold. (#163)
- Ambiguous bases can be averaged, resolved, skipped, or handled as HIV-TRACE does with `-g`. (#119)
- Alignments use a consensus built from the loaded sequences as the default reference, instead of HXB2. (#322)
- The phylogenetic tree can be built from a Newick file. (#100)
- Results that could be wrong without telling you are fixed: TN92 and GapMM are corrected, and the app reports problems rather than hiding them. (#279, #285, #288)

### Views and interface

- The 2D network is drawn on the GPU with cosmos.gl and is now called Network. The Pixi and 3D views are removed. (#121, #130)
- Views open on what the data offers, at sizes that fit, and are framed to their data. (#145, #160)
- The Conflicts view shows where files disagree about a node, and lets you choose which value to use. (#148)
- Each file's node values are kept, and the file nearest the top wins where they disagree. Where values came from is saved with the session. (#146, #147)
- The network pauses while another view is in front, and redraws once per change. (#164)
- The WebMCP tools let AI agents use MicrobeTrace's features in the browser. It is off by default and applies to the current tab only. (#168, #285)
- The interface uses Bootstrap 5, Bootstrap Icons and golden-layout 2. Map base layers come from CARTO and Esri ArcGIS. (#123, #124, #140)
- The interface follows the system's dark mode. (#159)
- Menus, dialogs, controls, labels, dates and sequences are cleaned up, and several interface bugs are fixed. (#141, #143, #144, #150, #151, #155, #156, #157, #161)
- The floating panels stay in the view in front of them, without overlapping. (#142)
- The network can be reached from the keyboard. (#285)

### Accessibility

- Controls and dialogs have names, settings panes' tabs are wired to their panels, and faint text is darker. (#162)

### Files and sessions

- Sessions are versioned and validated before they replace the current session. A file that isn't a session leaves your work as it is. (#289)
- Stashes are committed, and recovery is offered after a failure. (#289)
- Empty files no longer hang the loading dialog, and a failed worker reports its error. (#289)
- Tables and aggregations sort, show their defaults and name their columns clearly. (#161)

### Reliability and performance

- Large datasets load and redraw faster: one redraw per change, with a benchmark that sets budgets. (#164, #300)
- Stashed sessions are committed as they are saved, and recovery is offered after a failure. (#289)

### Security and privacy

- Loaded data is written as text, not markup. (#280)
- The Content-Security-Policy no longer allows `unsafe-inline`, and the server serves only an allowlist of files. (#299)
- The app works offline through a service worker, which tells you when a new version is ready. (#194)

### Build, deployment and project

- Node 26 is used in CI, the Pages deploy and the Docker image. (#287)
- The Pages deploy publishes only the files the app loads. (#287)
- Bundles are reproducible: CI rebuilds `dist/` and `vendor/` from the lockfile and fails if they differ. (#200, #287)
- Every pull request runs the unit tests, the bundle check and the Playwright end-to-end suite. (#127, #284)
- The project is licensed under Apache-2.0. (#287, #290)
- The Docker image runs as an unprivileged user and serves the same files as the Pages site. (#299)

### Earlier changes (2020 to 2021)

- A global timeline in the settings, and polygons drawn from convex hulls. (#44, #253)
- Flow diagram variable names, Greenland on the map, patristic matrices on large trees, and files without sequence information. (#181, #247, #250, #249)
- Stashing is fixed. (#254)
- Offline help was removed in favour of the wiki. (2020)
