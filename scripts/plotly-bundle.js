// The Plotly traces MicrobeTrace uses. scripts/bundle.sh builds this into the
// secondary bundle: Plotly's prebuilt partial bundles leave out sankey, which
// the flow diagram needs.
var Plotly = require('plotly.js/lib/core');

Plotly.register([
  require('plotly.js/lib/heatmap'),
  require('plotly.js/lib/histogram'),
  require('plotly.js/lib/sankey')
]);

module.exports = Plotly;
