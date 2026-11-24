// Timings show only when debugging is on: runWorker names the worker "debug" then (see MT.debugging in src/common.js)
const debugTime = (label, start) => { if (globalThis.name === 'debug') console.log(label + ' time: ', (Date.now() - start).toLocaleString(), 'ms'); };

// The share of each sequence (a string) that is not A, C, G or T, in either
// case: N, the other IUPAC codes, U and gaps all count (#170).
const BASE = new Uint8Array(128);
for (const c of 'ACGTacgt') BASE[c.charCodeAt(0)] = 1;

onmessage = function(e) {
 const start = Date.now();
 const seqs = e.data;
 const n = seqs.length;
 let output = new Float32Array(n);
 for (let i = 0; i < n; i++) {
  const sequence = seqs[i];
  const sequenceLength = sequence.length;
  let count = 0;
  for (let j = 0; j < sequenceLength; j++){
   count += !BASE[sequence.charCodeAt(j)];
  }
  output[i] = count/sequenceLength;
 }
 debugTime('Ambiguity Count', start);
 postMessage({ counts: output.buffer, start: Date.now() }, [output.buffer]);
 close();
};
