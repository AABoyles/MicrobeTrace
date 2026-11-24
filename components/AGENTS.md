# Views (components/)

Each view is `NAME.html` (its markup) plus `NAME.js` (its code). When the view opens,
`src/views.js` fetches the HTML into a Golden Layout panel, loads the code and runs its mount
function. `histogram.js` is the cleanest example to copy.

## The view contract

Views are ES modules, loaded with `import()` (#339). Some are still classic scripts (see
"Classic views" below); `MODULE_VIEWS` in `src/views.js` lists the converted ones.

```js
// components/histogram.js
export const libraries = ['plotly'];       // optional: the lazy bundles to load before mount

export function mount(root, ctx) {
  const { MT, settings, events } = ctx;    // ctx.session and ctx.temp are read when needed
  const $ = selector => root.querySelector(selector);
  // ...
  return { resize() { ... }, destroy() { ... } };
}
```

- `ctx` is `{ settings, events, container, MT, session, temp }`. A module has no `MT`, `session`
  or `temp` globals (the linter fails on them): take `MT` from `ctx`, and read `ctx.session` and
  `ctx.temp` where you use them, not destructured up front, because loading a session replaces
  both. Library globals from the bundles (`d3`, `Plotly`, `Tabulator`, `XLSX`, `MTBind`, ...) stay
  globals. Module-level helpers that need `ctx` can keep it in a module variable set by `mount`
  (`network.js` does this as `app`); the context is the same for every instance.
- `libraries` names the lazy bundles (`MT.loadLibrary`) the view needs; `views.js` awaits them
  before `mount`, and shows "Could not load the X view" if one fails. A view that needs one only
  for an action loads it in that action.
- Everything below applies to both forms.
- Query inside `root`, never by global ID: a view can be open more than once.
- Read and write settings with `settings.get/set` and redraw from `settings.subscribe(keys, fn)`,
  not by reading the DOM or listening for other views' clicks. Unsubscribe in `destroy()`, along
  with every `events.on` handler, timer, observer and animation frame.
- Never write `session.data` from a view: call `MT.session` (`src/session.js`), and redraw on its
  `session-data-change` event (detail: what changed) if the view shows loaded data outside a load.
- `resize()` runs on size changes and when the tab is shown; hidden views should do no work.
- Use the shared helpers rather than reinventing them: `MT.paneToggle` for the `.left-pane`
  settings pane and its gear button, `MT.fillSelect` for variable menus (it builds elements, so field names
  can't become markup), the color maps on `temp.style`, `MT.getVisibleNodes/Links`.
- Export dialogs live inside the view's HTML and follow the action-dialog rules in `CONTRIBUTING.md`.

## Classic views (being phased out, #339)

An unconverted view's HTML ends with `<script src="components/NAME.js"></script>`, and the script
is an IIFE that calls `MT.registerView('NAME', (root, { settings, events }) => {...})` and reads
`MT`, `session` and `temp` as globals. Its lazy libraries are listed in `VIEW_LIBRARIES` in
`src/views.js`. It behaves the same once mounted.

### Converting a view to a module

1. Turn the file into the module form above: drop the IIFE and `MT.registerView`, `export function
   mount(root, ctx)`, dedent, and `export const libraries = [...]` from its `VIEW_LIBRARIES` entry
   (then delete that entry).
2. Replace every `MT.`, `session` and `temp` with `ctx.`-reached ones (see above). Run
   `npx eslint components/NAME.js`: a leftover is a `no-undef` error once step 4 is done.
3. Delete the `<script src="components/NAME.js">` tag from `NAME.html`.
4. Add the name to `MODULE_VIEWS` in `src/views.js` and the file to `moduleViews` in
   `eslint.config.js`.
5. `npm run cache`, then run the view's spec and `views`, `panels`, `a11y`, `service-worker`.

## Adding a view

A new view touches more than this directory:

1. `components/NAME.html` and `components/NAME.js` (a module: see the contract above, and add it
   to `MODULE_VIEWS` and to `moduleViews` in `eslint.config.js`).
2. A `viewbutton` with `data-href="NAME"` in the View menu in `index.html`.
3. Defaults for its settings (`NAME-...` keys) in `MT.defaultWidgets` in `src/common.js`.
4. Its entries in `common.js`'s per-view tables: the accessible summary and what the view needs of
   the session (the empty-state note). Search for an existing view's name, e.g. `waterfall`.
5. Its entry in the view catalog in `VIEWS` in `src/webmcp/views/helpers.js`.
6. `test/e2e/NAME.spec.js`, and a row in `test/e2e/README.md`.

Views must draw correctly in light and dark (`dark.spec.js`) and pass axe with their pane open
(`a11y.spec.js`).
