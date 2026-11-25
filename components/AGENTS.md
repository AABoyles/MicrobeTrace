# Views (components/)

Each view is `NAME.html` (its markup) plus `NAME.js` (its code). When the view opens,
`src/views.js` fetches the HTML into a Golden Layout panel, loads the code and runs its mount
function. `bubbles.js` is the cleanest example to copy.

## The view contract

Views are ES modules, loaded with `import()` (#339).

```js
// components/NAME.js
export const libraries = ['sankey'];       // optional: the lazy bundles to load before mount

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
  both. Library globals from the bundles (`d3`, `Tabulator`, `XLSX`, `MTBind`, ...) stay
  globals. Module-level helpers that need `ctx` can keep it in a module variable set by `mount`
  (`network.js` does this as `app`), but only in a view that can be open once: each copy has its own.
- A view can be open more than once (#365), unless `MT.singleViews` (`src/views.js`) lists it. Its
  second copy has the instance number 2, and is called `NAME@2` (`MT.viewId`). Each copy has its own
  settings: name their prefix with `export const settingsPrefix = 'map-'`, and use `ctx.settings`,
  never `MT.settings`, for them. They are stored under the plain key for the first copy and `key@2`
  for the second; other settings are shared. IDs and radio buttons' names in the HTML get a suffix in
  the second copy, as do the labels, tabs and dialogs that refer to them, so find elements by class
  or `data-setting` and not by ID.
- `libraries` names the lazy bundles (`MT.loadLibrary`) the view needs; `views.js` awaits them
  before `mount`, and shows "Could not load the X view" if one fails. A view that needs one only
  for an action loads it in that action.
- Query inside `root`, never by global ID.
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

## Adding a view

A new view touches more than this directory:

1. `components/NAME.html` and `components/NAME.js` (a module: see the contract above).
2. A `viewbutton` with `data-href="NAME"` in the View menu in `index.html`.
3. Defaults for its settings (`NAME-...` keys) in `MT.defaultWidgets` in `src/common.js`.
4. Its entries in `MT.viewNeeds` in `src/views.js`: what the view needs of the session (the
   empty-state note). Its accessible summary is set with `MT.describeView`, as `network.js` does.
   Search for an existing view's name, e.g. `waterfall`.
5. Its entry in the view catalog in `VIEWS` in `src/webmcp/views/helpers.js`.
6. `test/e2e/NAME.spec.js`, and a row in `test/e2e/README.md`.

Views must draw correctly in light and dark (`dark.spec.js`) and pass axe with their pane open
(`a11y.spec.js`).
