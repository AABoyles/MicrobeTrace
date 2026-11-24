// The libraries the page needs before anything is drawn (#342). bundle.js builds
// this into dist/bundle.primary.js, and each import below is assigned to the global
// the app's classic scripts use. Nothing here is a module for the app: src/ and
// components/ still read `d3`, `bootstrap` and the rest as globals.
import * as d3Namespace from 'd3';
import * as goldenLayout from 'golden-layout/dist/esm/index.js';
// The bundled build includes Popper, which Bootstrap's dropdowns and tooltips need
import bootstrap from 'bootstrap/dist/js/bootstrap.bundle.js';
import TomSelect from 'tom-select';
import Papa from 'papaparse';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import { TabulatorFull as Tabulator } from 'tabulator-tables';

// d3 is a copy, not the module namespace: namespaces can't be added to, and the
// secondary bundle adds the extra symbol shapes to d3 once it loads.
globalThis.d3 = { ...d3Namespace };
globalThis.goldenLayout = goldenLayout;
globalThis.bootstrap = bootstrap;
globalThis.TomSelect = TomSelect;
globalThis.Papa = Papa;
globalThis.JSZip = JSZip;
globalThis.XLSX = XLSX;
globalThis.Tabulator = Tabulator;
