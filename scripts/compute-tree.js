importScripts('../node_modules/patristic/dist/patristic.min.js');

onmessage = function(e){
  var start = Date.now();
  var matrix = e.data.matrix;
  var labels = e.data.labels.map(l => l.replace(/[;(),]*/g, ''));
  var RNJ = patristic.parseMatrix(matrix, labels);
  console.log('Tree Compute time: ', ((Date.now()-start)/1000).toLocaleString(), 's');
  start = Date.now();
  var encoder = new TextEncoder();
  var output = encoder.encode(JSON.stringify(RNJ.toObject())).buffer;
  postMessage({tree: output, start: start}, [output]);
  close();
};
