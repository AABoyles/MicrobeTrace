// Plotly, loaded when a chart view first opens (#324). It is built from
// scripts/plotly-bundle.js, which holds just the traces MicrobeTrace draws.
import Plotly from '../plotly-bundle.js';

globalThis.Plotly = Plotly;
