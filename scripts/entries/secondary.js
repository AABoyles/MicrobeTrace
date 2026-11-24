// The libraries the views need, loaded after the page is up (#342); see primary.js.
// bundle.js builds this into dist/bundle.secondary.js.
import * as symbolExtra from 'd3-symbol-extra';
import Plotly from '../plotly-bundle.js';
import TidyTree from 'tidytree/src/main.ts';
import './leaflet-global.js';
import 'leaflet.markercluster';
import sortable from 'html5sortable/dist/html5sortable.es.js';
import alignmentViewer from 'alignment-viewer/dist/alignment-viewer.min.js';

// d3 itself comes from the primary bundle, which loads first. d3 7 already has
// d3.polygonHull, so d3-polygon is no longer added on top of it.
Object.assign(globalThis.d3, symbolExtra);
globalThis.Plotly = Plotly;
globalThis.TidyTree = TidyTree;
globalThis.sortable = sortable;
globalThis.alignmentViewer = alignmentViewer;
