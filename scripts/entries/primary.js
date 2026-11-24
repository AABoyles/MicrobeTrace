// The libraries the page needs before anything is drawn (#342). bundle.js builds
// this into dist/bundle.primary.js, and each import below is assigned to the global
// the app's classic scripts use. Nothing here is a module for the app: src/ and
// components/ still read `d3`, `bootstrap` and the rest as globals.
//
// The other libraries are lazy bundles (xlsx, table, plotly, tree,
// alignment): MT.loadLibrary fetches each when a feature first needs it (#324).
import * as d3Namespace from 'd3';
import * as symbolExtra from 'd3-symbol-extra';
import * as goldenLayout from 'golden-layout/dist/esm/index.js';
// The bundled build includes Popper, which Bootstrap's dropdowns and tooltips need
import bootstrap from 'bootstrap/dist/js/bootstrap.bundle.js';
import TomSelect from 'tom-select';
import Papa from 'papaparse';
import sortable from 'html5sortable/dist/html5sortable.es.js';

// d3 is a copy, not the module namespace, which can't be added to: the extra
// symbol shapes the network offers for nodes go on it.
globalThis.d3 = Object.assign({ ...d3Namespace }, symbolExtra);
globalThis.goldenLayout = goldenLayout;
globalThis.bootstrap = bootstrap;
globalThis.TomSelect = TomSelect;
globalThis.Papa = Papa;
globalThis.sortable = sortable;
