# Views (components/)

Each view is `NAME.html` (its markup) plus `NAME.js` (its code). When the view opens,
`src/common.js` fetches both, puts them in a Golden Layout panel and runs the mount function the
script registered. `histogram.js` is the cleanest example to copy.

## The view contract

```js
MT.registerView('histogram', (root, { settings, events }) => {
  const $ = selector => root.querySelector(selector);
  // ...
  return { resize() { ... }, destroy() { ... } };
});
```

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

## Adding a view

A new view touches more than this directory:

1. `components/NAME.html` and `components/NAME.js`.
2. A `viewbutton` with `data-href="NAME"` in the View menu in `index.html`.
3. Defaults for its settings (`NAME-...` keys) in `MT.defaultWidgets` in `src/common.js`.
4. Its entries in `common.js`'s per-view tables: the accessible summary and what the view needs of
   the session (the empty-state note). Search for an existing view's name, e.g. `waterfall`.
5. Its entry in the view catalog in `VIEWS` in `src/webmcp/views/helpers.js`.
6. `test/e2e/NAME.spec.js`, and a row in `test/e2e/README.md`.

Views must draw correctly in light and dark (`dark.spec.js`) and pass axe with their pane open
(`a11y.spec.js`).
