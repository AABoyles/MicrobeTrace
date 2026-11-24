// Timings show only when debugging is on: runWorker names the worker "debug" then (see MT.debugging in src/common.js)
const debugTime = (label, start) => { if (globalThis.name === 'debug') console.log(label + ' time: ', (Date.now() - start).toLocaleString(), 'ms'); };
importScripts('../vendor/patristic.min.js');

// Takes the n by n distance matrix as a flat Float64Array (NaN where there's no
// distance) and the labels of its rows.
onmessage = function(e){
 let start = Date.now();
 const n = e.data.labels.length, flat = e.data.matrix;
 const matrix = new Array(n);
 for (let i = 0; i < n; i++) {
  const row = matrix[i] = new Array(n);
  for (let j = 0; j < n; j++) {
   const v = flat[i * n + j];
   row[j] = v === v ? v : null;
  }
 }
 const RNJ = patristic.parseMatrix(matrix, e.data.labels);
 debugTime('Tree Compute', start);
 start = Date.now();
 postMessage({tree: RNJ.toObject(), start: start});
 close();
};
