// The classic scripts that make up the app's MT namespace, in the order index.html
// loads them (#240). common.js comes first and creates MT; the tests that run the app's
// code in a vm context load them all in this order, as the page does.
module.exports = [
  'src/common.js',
  'src/loading.js',
  'src/links-clusters.js',
  'src/colors.js',
  'src/export.js',
  'src/views.js',
  'src/ui.js',
];
