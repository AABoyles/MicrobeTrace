// leaflet.markercluster's code refers to a global `L`, and imports are evaluated
// in order, so secondary.js imports this before the plugin (#342).
import L from 'leaflet';

globalThis.L = L;
