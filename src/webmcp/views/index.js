// WebMCP tools for views: which views exist and are open, where they sit in the
// layout, each view's own settings and buttons, and pictures and exports of
// what a view shows. (Global settings, filtering and colors are in style.js;
// loading data in session.js; reading data in query.js.)

import listViews from './list-views.js';
import openView from './open-view.js';
import closeView from './close-view.js';
import focusView from './focus-view.js';
import getLayout from './get-layout.js';
import setLayout from './set-layout.js';
import getViewSettings from './get-view-settings.js';
import setViewSettings from './set-view-settings.js';
import setViewControl from './set-view-control.js';
import listViewActions from './list-view-actions.js';
import invokeViewAction from './invoke-view-action.js';
import getViewImage from './get-view-image.js';
import exportView from './export-view.js';
import networkControl from './network-control.js';
import getNetworkLayout from './get-network-layout.js';

// In the order the tools are listed to an agent
export default [
  listViews,
  openView,
  closeView,
  focusView,
  getLayout,
  setLayout,
  getViewSettings,
  setViewSettings,
  setViewControl,
  listViewActions,
  invokeViewAction,
  getViewImage,
  exportView,
  networkControl,
  getNetworkLayout,
];
