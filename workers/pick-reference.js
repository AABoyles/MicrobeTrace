// Timings show only when debugging is on: runWorker names the worker "debug" then (see MT.debugging in src/common.js)
const debugTime = (label, start) => { if (globalThis.name === 'debug') console.log(label + ' time: ', (Date.now() - start).toLocaleString(), 'ms'); };
// A provisional reference for building a consensus (#317): the medoid of the
// raw, unaligned sequences by k-mer distance. It needs no alignment, so it is
// cheap, and it only has to be close to everything else, not right.
// Nothing here is random, so the same sequences always give the same answer.

// Uppercase, no gaps or whitespace, and RNA read as DNA, so that 'acgu-acgu'
// and 'ACGTACGT' are the same sequence
function normalise(seq){
 return String(seq || '').toUpperCase().replace(/[-\s]/g, '').replace(/U/g, 'T');
}

const CODE = { A: 0, C: 1, G: 2, T: 3 };

// The distinct k-mers of a sequence as a sorted Uint32Array, two bits a base.
// A k-mer with anything but ACGT in it is skipped, since it has no code.
// k is at most 15 so the code fits in 30 bits.
function kmersOf(s, k){
 const mask = Math.pow(4, k) - 1;
 const found = new Set();
 let code = 0, run = 0;
 for (let i = 0; i < s.length; i++) {
  const c = CODE[s[i]];
  if (c === undefined) { run = 0; code = 0; continue; }
  code = ((code * 4) + c) % (mask + 1);
  if (++run >= k) found.add(code);
 }
 return Uint32Array.from(found).sort();
}

// 1 - Jaccard of two sorted sets, by merging them. Two empty sets are as far
// apart as sets can be.
function distance(a, b){
 if (!a.length && !b.length) return 1;
 let i = 0, j = 0, shared = 0;
 while (i < a.length && j < b.length) {
  if (a[i] === b[j]) { shared++; i++; j++; }
  else if (a[i] < b[j]) i++;
  else j++;
 }
 return 1 - shared / (a.length + b.length - shared);
}

// The longest of the given indices, the lowest index on a tie
function longest(indices, lengths){
 let best = -1;
 for (const i of indices) if (best < 0 || lengths[i] > lengths[best]) best = i;
 return best;
}

function pickReference(seqs, options){
 options = options || {};
 const k = Math.max(1, Math.min(15, Math.floor(options.k || 8)));
 const sample = Math.max(1, Math.floor(options.sample || 200));
 if (!seqs || !seqs.length) return -1;

 const clean = seqs.map(normalise);
 const lengths = clean.map(s => s.length);
 const usable = [];
 for (let i = 0; i < clean.length; i++) if (lengths[i]) usable.push(i);
 if (!usable.length) return -1;
 if (usable.length <= 2) return longest(usable, lengths);

 // Evenly spaced rather than random, so the answer depends only on the input
 let chosen = usable;
 if (usable.length > sample) {
  chosen = [];
  for (let i = 0; i < sample; i++) chosen.push(usable[Math.floor(i * usable.length / sample)]);
 }

 const sets = chosen.map(i => kmersOf(clean[i], k));
 // A sequence with no k-mers is no use as a reference unless nothing else is
 if (!sets.some(s => s.length)) return longest(usable, lengths);

 const n = chosen.length;
 const sums = new Float64Array(n);
 for (let a = 0; a < n; a++) {
  for (let b = a + 1; b < n; b++) {
   const d = distance(sets[a], sets[b]);
   sums[a] += d;
   sums[b] += d;
  }
 }

 // chosen is in ascending index order, so the first smallest is the lowest index
 let best = -1;
 for (let a = 0; a < n; a++) {
  if (!sets[a].length) continue;
  if (best < 0 || sums[a] < sums[best]) best = a;
 }
 return chosen[best];
}

if(typeof module !== 'undefined' && module.exports) module.exports = { pickReference };

if(typeof onmessage !== 'undefined' || typeof self !== 'undefined') onmessage = function(e){
 var start = Date.now();
 var index = pickReference(e.data.seqs, { k: e.data.k, sample: e.data.sample });
 debugTime('Pick Reference Compute', start);
 start = Date.now();
 postMessage({index: index, start: start});
 close();
};
