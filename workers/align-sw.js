// Timings show only when debugging is on: runWorker names the worker "debug" then (see MT.debugging in src/common.js)
const debugTime = (label, start) => { if (globalThis.name == 'debug') console.log(label + ' time: ', (Date.now() - start).toLocaleString(), 'ms'); };
importScripts("../vendor/bioseq.min.js");
onmessage = function(e) {
 let start = Date.now();
 let subset = e.data.nodes;
 let reference = e.data.reference;
 let n = subset.length;
 for (let i = 0; i < n; i++) {
  let node = subset[i];
  let rst = bioseq.align(
   reference,
   node.seq,
   false,
   e.data.match,
   e.data.gap
  );
  let fmt = bioseq.cigar2gaps(
   reference,
   node.seq,
   rst.position,
   rst.CIGAR,
   true
  );
  node._score = rst.score;
  node._padding = rst.position;
  node._cigar = rst.CIGAR;
  node._seq = fmt[1];
 }
 debugTime('Alignment', start);
 start = Date.now();
 postMessage({ nodes: subset, start: start });
 close();
};
