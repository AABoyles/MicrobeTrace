// Lint rules for MicrobeTrace (#243). The app is plain scripts, not modules: the
// files share globals through `self` (MT, session, temp) and the vendor bundles
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
  MTAlignerScoring: "readonly", MTBind: "readonly", MTDates: "readonly", MTEvents: "readonly", MTGraph: "readonly",
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
  "no-undef": "warn",
  "no-unused-vars": "warn",
  "eqeqeq": ["warn", "always", { null: "ignore" }],
};

const common = { ecmaVersion: "latest" };

module.exports = [
  { ignores },
  {
    files: ["src/**/*.js", "components/*.js"],
    languageOptions: { ...common, sourceType: "script", globals: { ...globals.browser, ...appGlobals, ...libGlobals } },
    rules,
  },
  {
    files: ["workers/*.js"],
    languageOptions: { ...common, sourceType: "script", globals: { ...globals.worker, ...appGlobals, ...workerGlobals } },
    rules,
  },
  {
    files: ["scripts/**/*.js", "server.js", "eslint.config.js", "playwright.config.js", "test/unit/**/*.js", "test/golden/**/*.js"],
    languageOptions: { ...common, sourceType: "commonjs", globals: globals.node },
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
