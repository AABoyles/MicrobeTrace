// Timings show only when debugging is on: runWorker names the worker "debug" then (see MT.debugging in src/common.js)
const debugTime = (label, start) => { if (globalThis.name == 'debug') console.log(label + ' time: ', (Date.now() - start).toLocaleString(), 'ms'); };
importScripts('../vendor/bx_distance_models.js');

// Computes genetic distances with bx-distance-models (WebAssembly) for rows
// [rowStart, rowEnd) of the upper triangle of the pairwise matrix: pairs (i, j),
// i < j, row by row. MT.computeLinks splits the rows across several of these
// workers and concatenates their results.
//
// mode is one of HIV-TRACE's `tn93 -a` modes ('skip', 'resolve', 'average' or
// 'gapmm') or 'hivtrace-g', which is `tn93 -a resolve -g F` (F is `fraction`):
// each pair is resolved, unless the sites resolution touched are at least F of
// its compared sites, in which case it is averaged. bx-distance-models decides
// that pair by pair, as tn93 does.
//
// metrics are computed from one parsed set of sequences, and returned in
// order as results. With thresholds (one per metric), only the pairs at or
// under a metric's threshold are returned for it (as source, target and
// distance arrays). Without, every pair's distance is (Float32).

const ready = wasm_bindgen({ module_or_path: '../vendor/bx_distance_models_bg.wasm' });

onmessage = async function(e) {
 await ready;
 let start = Date.now();
 const { seqs, metrics, mode, fraction, rowStart, rowEnd } = e.data;
 const thresholds = e.data.thresholds ? e.data.thresholds.map(parseFloat) : null;

 const hivtrace = mode == 'hivtrace-g';
 const set = new wasm_bindgen.SequenceSet(seqs, hivtrace ? 'resolve' : mode,
  hivtrace ? { maxAmbiguityFraction: fraction } : undefined);
 const results = metrics.map((metric, m) => {
  const threshold = thresholds && thresholds[m];
  // Float32 is what the graph stores, and halves the transfer
  if (threshold === null || threshold === undefined) return { distances: Float32Array.from(set.distances(metric, rowStart, rowEnd)) };
  const links = set.links(metric, threshold, rowStart, rowEnd);
  const part = { source: links.source, target: links.target, distance: links.distance };
  links.free();
  return part;
 });
 set.free();

 debugTime('Links Compute (rows ' + rowStart + '-' + rowEnd + ', ' + metrics.join(', ') + ')', start);
 const buffers = results.flatMap(r => Object.values(r).map(v => v.buffer));
 postMessage({ results, start: Date.now() }, buffers);
 close();
};
