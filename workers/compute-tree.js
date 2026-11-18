importScripts('../vendor/patristic.min.js');

onmessage = function(e){
  let start = Date.now();
  const matrix = e.data.matrix;
  const RNJ = patristic.parseMatrix(matrix, e.data.labels);
  console.log('Tree Compute time: ', (Date.now()-start).toLocaleString(), 'ms');
  start = Date.now();
  postMessage({tree: RNJ.toObject(), start: start});
  close();
};
