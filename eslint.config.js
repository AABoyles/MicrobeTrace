// Lint rules for MicrobeTrace (#243). The app is plain scripts, moving to ES
// modules a few files at a time (#323): the files share globals through `self` (MT, session, temp) and the vendor bundles
// in dist/ and vendor/ set theirs on `self` too, so each group of files is given
// the globals it really sees. A file that needs one more says so with a
// `/* global */` comment rather than adding it here.
const globals = require("globals");

// Set on `self` by src/common.js and src/index.js, and read across files
const appGlobals = {
  MT: "readonly",
  session: "writable",
  temp: "writable",
};

// Set by the vendor bundles (dist/, vendor/) and by the src/*.js modules that
// attach themselves to `self` (MTBind, MTGraph, ...). `module` is the UMD guard
// in those same files.
const libGlobals = {
  Cosmos: "readonly", JSZip: "readonly", L: "readonly", Papa: "readonly", Plotly: "readonly",
  Tabulator: "readonly", TomSelect: "readonly", TidyTree: "readonly", XLSX: "readonly", alignmentViewer: "readonly",
  bootstrap: "readonly", d3: "readonly", db: "readonly", goldenLayout: "readonly", patristic: "readonly",
  pdfMake: "readonly", sortable: "readonly", tn93: "readonly", module: "readonly",
  MTAlignerScoring: "readonly", MTBind: "readonly", MTDates: "readonly", MTEvents: "readonly", MTFormats: "readonly", MTGraph: "readonly",
  MTNodeSources: "readonly", MTSessionFormat: "readonly", MTSettings: "readonly", MTWebMCP: "readonly",
};

// Workers load their libraries with importScripts (see each worker's header)
const workerGlobals = {
  bioseq: "readonly", module: "readonly", Papa: "readonly", patristic: "readonly", tn93: "readonly",
  wasm_bindgen: "readonly",
};

// Generated and vendored code is built, not written, so it isn't linted
const ignores = ["dist/**", "vendor/**", "fonts/**", "sw.js", "_site/**", "coverage/**", "playwright-report/**", "test-results/**"];

// Warnings for now; an error only where the codebase is already clean
const rules = {
  "no-undef": "error",
  "no-unused-vars": "warn",
  "eqeqeq": ["warn", "always", { null: "ignore" }],
};

// Settings are written through MT.settings.set, so that subscribers hear about them (#327).
// The selectors catch X.widgets[k] =, X.widgets.k = and widgets[k] = in the app code.
// The session upgrades in src/common.js are the exception, with disable comments.
const noDirectWidgets = {
  "no-restricted-syntax": ["error",
    {
      selector: "AssignmentExpression > MemberExpression.left[object.property.name='widgets']",
      message: "Write settings through MT.settings.set (src/settings.js), not session.style.widgets directly (#327)",
    },
    {
      selector: "AssignmentExpression > MemberExpression.left[object.name='widgets']",
      message: "Write settings through MT.settings.set (src/settings.js), not a widgets object directly (#327)",
    },
  ],
};

const common = { ecmaVersion: "latest" };

// The src files already converted to ES modules (#323). They still set a global
// for the classic scripts, so their names stay in libGlobals until those convert.
const esModules = [
  "src/aligner.js", "src/binder.js", "src/dates.js", "src/db.js", "src/events.js",
  "src/graph.js", "src/nodes.js", "src/session-format.js", "src/settings.js",
  "src/common.js", "src/loading.js", "src/links-clusters.js", "src/colors.js", "src/export.js",
  "src/views.js", "src/ui.js", "src/formats/*.js", "src/webmcp/**/*.js",
];

module.exports = [
  { ignores },
  {
    files: ["src/**/*.js", "components/*.js"],
    languageOptions: { ...common, sourceType: "script", globals: { ...globals.browser, ...appGlobals, ...libGlobals } },
    rules: { ...rules, ...noDirectWidgets },
  },
  {
    files: esModules,
    languageOptions: { ...common, sourceType: "module", globals: { ...globals.browser, ...appGlobals, ...libGlobals } },
    rules: { ...rules, ...noDirectWidgets },
  },
  {
    files: ["workers/*.js"],
    languageOptions: { ...common, sourceType: "script", globals: { ...globals.worker, ...appGlobals, ...workerGlobals } },
    rules,
  },
  {
    files: ["scripts/**/*.js", "server.js", "eslint.config.js", "playwright.config.js", "test/*.js", "test/unit/**/*.js", "test/golden/**/*.js"],
    languageOptions: { ...common, sourceType: "commonjs", globals: globals.node },
    rules,
  },
  {
    // The bundle entry modules import the libraries (#342); esbuild runs them in the browser
    files: ["scripts/entries/*.js"],
    languageOptions: { ...common, sourceType: "module", globals: globals.browser },
    rules,
  },
  {
    files: ["test/unit/**/*.mjs"],
    languageOptions: { ...common, sourceType: "module", globals: globals.node },
    rules,
  },
  {
    // Specs and the security fixtures run code in the page through page.evaluate and
    // friends; `layout` is the page's GoldenLayout (self.layout), which the specs read
    files: ["test/e2e/**/*.js", "test/security/**/*.js"],
    languageOptions: { ...common, sourceType: "commonjs", globals: { ...globals.node, ...globals.browser, ...appGlobals, ...libGlobals, layout: "readonly" } },
    rules,
  },
];
