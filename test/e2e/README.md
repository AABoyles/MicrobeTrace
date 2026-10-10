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
| `binder.spec.js` | `src/binder.js` on every control type |
| `histogram.spec.js` | The histogram's settings, drawing, restoring and export |
| `heatmap.spec.js` | The heatmap's settings, drawing, restoring, and PNG and CSV export |
| `scatterplot.spec.js` | The scatterplot's datasets, variables, scale, restoring and export |
| `flow_diagram.spec.js` | The flow diagram's variables, datasets, redraws, restoring and export |

`helpers.js` lists the errors that also happen on `master` (`KNOWN_ERRORS`), which don't fail a
test. Each one is a bug to fix: remove its pattern when it is.

When a view moves onto the settings store and `MT.registerView` (see `src/settings.js`,
`src/binder.js` and the view contract in `src/common.js`), give it a spec like
`histogram.spec.js` first, run it against the old version, then port the view.
