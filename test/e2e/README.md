# End-to-End (E2E) Tests

Browser tests of MicrobeTrace's UI, with [Playwright](https://playwright.dev). They start the
app (`node server.js`), load a small network from `fixtures/` (300 sequences plus a links file
and a nodes file) through the Files view, and drive it like a user would.

```sh
npx playwright install chromium   # once
npm run test:e2e
npm run test:e2e -- test/e2e/histogram.spec.js   # one file
```

To use a Chromium that's already installed instead, point `PLAYWRIGHT_CHROMIUM_EXECUTABLE` at
it. WebGL runs in software (SwiftShader), so no GPU is needed.

| File | Covers |
|---|---|
| `views.spec.js` | The network statistics, and every view opening and drawing without errors |
| `layout.spec.js` | Tabs, splitting a panel, resizing, saving and reloading the layout, New Session |
| `ui.spec.js` | The license dialog, menus, the settings dialog, toggle buttons |
| `global.spec.js` | The page around the views: filtering, the color tables and colors, statistics, search, reading dates, the global timeline, saving and reopening sessions, stashes, New Session |
| `panels.spec.js` | The floating panels following the view in front without overlapping, the timeline bar below the views, settings panes closing, and dialog backdrops |
| `controls.spec.js` | How controls and text look: links, the chosen option in toggle groups, primary and secondary buttons and their focus ring, color settings, the color tables' icons and sorting, panel tabs, labels not wrapping, and the statistics |
| `menus.spec.js` | The menus and the words in dialogs: search and its options, the File, View and Help menus, the license, the empty Files view and its rows, the loading dialog, and the names Save, Stash and Export suggest |
| `view-defaults.spec.js` | What views open on: variables chosen from the data (crosstab, flow diagram, scatterplot), the first field of dates or a note saying what to choose (epi curve, Gantt), sizes that fit the view (bubbles, tree leaves), and the network keeping its layout while the epi curve has a date |
| `missing-values.spec.js` | Nodes missing values, from CSV and spreadsheets: missing dates filled with the earliest date, missing numbers (latitudes, counts) left missing, and which values count as dates |
| `provenance.spec.js` | Where node values come from: files that disagree (the top file winning, others filling its gaps), tracing values to their files, reordering files, a node listed twice in a file, merging many nodes quickly, and keeping all this in saved and stashed sessions |
| `binder.spec.js` | `src/binder.js` on every control type |
| `histogram.spec.js` | The histogram's settings, drawing, restoring and export |
| `heatmap.spec.js` | The heatmap's settings, drawing, restoring, and PNG and CSV export |
| `scatterplot.spec.js` | The scatterplot's datasets, variables, scale, restoring and export |
| `flow_diagram.spec.js` | The flow diagram's variables, datasets, redraws, restoring and export |
| `table.spec.js` | The table's datasets, column picker, row selection, text size and export |
| `crosstab.spec.js` | The crosstab's variables, pivot, datasets, redraws and export |
| `aggregation.spec.js` | The aggregation tables: adding, changing and removing them, redraws and export |
| `network.spec.js` | The network: sizes, shapes, colors, labels, tooltips, links, physics, polygons, selection, pinning, the node menu (including copying), restoring and export |
| `choropleth.spec.js` | The choropleth: counting nodes by state and country, colors, transparency, tile layers, redraws, fitting and export |
| `geo_map.spec.js` | The geo map: placing nodes from coordinates and places, links, layers, collapsing, jitter, selection, tooltips, redraws and export |
| `waterfall.spec.js` | The waterfall: clusters, their nodes, a node's links, redraws and background |
| `sequences.spec.js` | The sequences: drawing, cell size, characters, restoring and export |
| `timeline.spec.js` | The epi curve: the date field, cumulation, brushing to hide nodes, colors, resizing and restoring |
| `gantt.spec.js` | The Gantt chart: adding, changing and removing dates, colors, redraws, restoring and export |
| `files.spec.js` | The files view: adding files and their kinds and fields, the loading settings, generating sequences, alignment and audit, launching |
| `bubbles.spec.js` | The bubbles: grouping, size, selection, colors, redraws, restoring and export |
| `phylogenetic_tree.spec.js` | The tree: layout, type and branch settings, leaf sizes, colors, labels and tooltips, selection, the context menu, restoring and export |
| `globe.spec.js` | The globe: placing nodes, links, layers, transparency, jitter, turning, redraws, restoring and export |

`helpers.js` lists the errors that also happen on `master` (`KNOWN_ERRORS`), which don't fail a
test. Each one is a bug to fix: remove its pattern when it is.

When a view moves onto the settings store and `MT.registerView` (see `src/settings.js`,
`src/binder.js` and the view contract in `src/common.js`), give it a spec like
`histogram.spec.js` first, run it against the old version, then port the view.
