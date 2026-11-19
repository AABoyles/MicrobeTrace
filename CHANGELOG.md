# Changelog

The version is the `version` in `package.json`. Help > About shows it, with the commit the site was built from. Numbers in brackets are the pull requests that made each change.

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
- The tree, heatmap and sequences views compute in the background, each with its own progress, Cancel and Retry. (#329)

### Accessibility

- Controls and dialogs have names, settings panes' tabs are wired to their panels, and faint text is darker. (#162)
- The network's nodes can be selected by neighbourhood from the keyboard (G, and Shift+G to add), and by value from the node color table. (#329)
- Links can be told apart by dash pattern as well as color (Dash By), and a color variable with many values offers node shapes too. (#329)

### Files and sessions

- Sessions are versioned and validated before they replace the current session. A file that isn't a session leaves your work as it is. (#289)
- Stashes are committed, and recovery is offered after a failure. (#289)
- Empty files no longer hang the loading dialog, and a failed worker reports its error. (#289)
- Tables and aggregations sort, show their defaults and name their columns clearly. (#161)
- A distance matrix that repeats an ID, or is cut off before a node's row, is refused with a message naming the ID, instead of loading with wrong or missing distances. A table cut off mid-row keeps its header. (#329)
- Sequences that differ only in case are no longer reported as a conflict between files. (#329)
- The demo session is rebuilt from the current demo files, with all 88 nodes. The COVID sample data, whose source wasn't recorded, is removed. (#329)
- WebMCP tools check their arguments against their schemas before they run or ask you anything. (#329)

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
- `dist/`, `vendor/` (except the bx-distance-models build), `fonts/` and `sw.js` are built, not committed: CI, the Pages deploy and the Docker build build them, and `npm start` builds them when they're missing. A fresh clone needs `npm ci` before `npm start`. (#200, #287, #325)
- Every pull request runs the unit tests with coverage, ESLint and the Playwright end-to-end suite. (#127, #284, #329)
- The out-of-date manual, VPAT and flyers are removed from `docs/`, and the README explains how to build, test and deploy. (#329)
- The project is licensed under Apache-2.0. (#287, #290)
- The Docker image runs as an unprivileged user and serves the same files as the Pages site. (#299)

### Earlier changes (2020 to 2021)

- A global timeline in the settings, and polygons drawn from convex hulls. (#44, #253)
- Flow diagram variable names, Greenland on the map, patristic matrices on large trees, and files without sequence information. (#181, #247, #250, #249)
- Stashing is fixed. (#254)
- Offline help was removed in favour of the wiki. (2020)
