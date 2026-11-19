// Timings show only when debugging is on: runWorker names the worker "debug" then (see MT.debugging in src/common.js)
const debugTime = (label, start) => { if (globalThis.name == 'debug') console.log(label + ' time: ', (Date.now() - start).toLocaleString(), 'ms'); };
onmessage = function(e) {
 const start = Date.now();
 const subset = e.data;
 const n = subset.length;
 let output = new Float32Array(n);
 for (let i = 0; i < n; i++) {
  const sequence = subset[i]["_seqInt"];
  const sequenceLength = sequence.length;
  let count = 0;
  for (let j = 0; j < sequenceLength; j++){
   count += (sequence[j] > 3);
  }
  output[i] = count/sequenceLength;
 }
 debugTime('Ambiguity Count', start);
 postMessage({ counts: output.buffer, start: Date.now() }, [output.buffer]);
 close();
};
