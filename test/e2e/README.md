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
| `recall.spec.js` | The Recall dialog: stashes listed newest first by name and when they were stashed, choosing one anywhere on its row, recalling one by double-clicking it, undoing a deletion, a stash that can't be read, and nothing stashed |
| `words.spec.js` | Tables and words: the aggregation sorted by count alone (as numbers), shares to one decimal and right-aligned; the table opening without its internal Index, columns sized to fit and lists comma-separated; a loading log that counts node rows and says how many links are within the threshold; a file that isn't a table saying so while Launch waits; File > New saying what it clears and offering to save first; Save's and exports' formats by name; hover text without typos; one name for each view and setting; blue main actions and Done or Close; the View menu's network above lined-up columns; and the tree's Label and Tooltip menus turning them off with None |
| `framing.spec.js` | Views framed to their data: the network kept in view as its layout spreads (clear of the docked tables), its labels one size at any zoom and never overlapping; the choropleth opening on the regions with data under a titled legend; the globe zooming to the nodes, with a Fit button and Borders; plots below the toolbar and clear of the docked tables, with outlined scatterplot points; the heatmap naming its metric, greying missing pairs and labelling ids; the flow diagram naming its columns, values in order with empty last; the map and the tree clear of the docked tables; the timeline starting where the network is, with years, centered; and the waterfall saying what to choose and what it doesn't list |
| `a11y.spec.js` | Accessibility: every control named (color swatches for their rows, as in "G0 color", menus for their labels) and every dialog for its title; the settings panes' tabs wired to their panels; no listbox roles on draggable rows and a mended ARIA tree in tables; and [axe](https://github.com/dequelabs/axe-core) finding nothing against WCAG 2.1 A and AA in each view with its pane open, an export dialog, the timeline's Play button and the alignment warning's links |
| `dark.spec.js` | The interface light or dark as the system is, changing with it: in dark, the menu bar, menus, panel tabs, toolbars, settings panes, multi-selects, floating color tables, dialogs, the threshold histogram and the table views are dark with light text, while the views keep drawing in their own colors |
| `panes.spec.js` | Settings panes beside what they change: in the table and chart views, a pane opening moves the content aside and redraws it at its new width when the view is wide enough, and covers it in a narrower view (and moves it aside once the view widens); and the Table view's text size in a toolbar menu, with no settings pane |
| `dates.spec.js` | Dates and sequences that can be read: the epi curve's bars counting calendar weeks or months (a setting), with a count axis, hover counts and gaps between bars; the Gantt chart's rows tall enough for their labels, in order of date, scrolling under an axis that stays in view, with single dates as dots; and the sequences' ids beside the alignment, letters only in cells wide enough, four distinct base colors with a key, and the ids in the PNG export |
| `fit.spec.js` | Controls that fit: sliders filling their column in one style, labels on one line, toggle buttons inside their groups with dividers, the heatmap's colors, flow variables and Gantt dates held in their rows, padded color tables, pane sections that show whether they're open (with Colors as a link to its dialog), a search bar that stays put, the Files pane pushing its footer too, aligned style-file and disabled toolbar buttons, sort arrows beside their own titles, and one meaning per icon |
| `hidden.spec.js` | Nothing hidden: the view tabs below a menu bar that wraps in a narrow window, the table views' and Sequence Settings' dialogs covering the menu bar, the table's column picker's menu opening over the page, pinned selected rows in line, no-matches shown in the search box, and the link threshold's histogram in its column, marking the threshold |
| `legends.spec.js` | Colors and labels matching the data: numbers and empty values drawn in their legend rows' colors (with the timeline too), links on the map and globe and bars in the histogram following the link legend those views dock, values shown as the data has them, and the crosstab and aggregation labelling empty values, axes and order |
| `missing-values.spec.js` | Nodes missing values, from CSV and spreadsheets: missing dates filled with the earliest date, missing numbers (latitudes, counts) left missing, and which values count as dates |
| `conflicts.spec.js` | The Conflicts view: where files disagree, using another file's value for a node or another file's values for a field, the notice after launching, other views following, and sessions keeping the choices |
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
