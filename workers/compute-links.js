importScripts('../vendor/bx_distance_models.js');

// Computes genetic distances with bx-distance-models (WebAssembly) for rows
// [rowStart, rowEnd) of the upper triangle of the pairwise matrix: pairs (i, j),
// i < j, row by row. MT.computeLinks splits the rows across several of these
// workers and concatenates their results.
//
// mode is 'skip', 'resolve' or 'average'. 'hivtrace-g' resolves ambiguities
// unless either sequence is too ambiguous, in which case it averages them: the
// caller puts the too-ambiguous sequences first, so the first averageRows rows
// hold exactly the pairs that must be averaged.
//
// metrics are computed from one parsed set of sequences, and returned in
// order as results. With thresholds (one per metric), only the pairs at or
// under a metric's threshold are returned for it (as source, target and
// distance arrays). Without, every pair's distance is (Float32).

const ready = wasm_bindgen({ module_or_path: '../vendor/bx_distance_models_bg.wasm' });

onmessage = async function(e) {
  await ready;
  let start = Date.now();
  const { seqs, metrics, mode, averageRows, rowStart, rowEnd } = e.data;
  const thresholds = e.data.thresholds ? e.data.thresholds.map(parseFloat) : null;

  const ranges = mode == 'hivtrace-g' ? [
    ['average', rowStart, Math.min(rowEnd, averageRows)],
    ['resolve', Math.max(rowStart, averageRows), rowEnd]
  ] : [[mode, rowStart, rowEnd]];

  // Each metric's parts, range by range
  const parts = metrics.map(() => []);
  ranges.forEach(([ambiguity, a, b]) => {
    if (a >= b) return;
    const set = new wasm_bindgen.SequenceSet(seqs, ambiguity);
    metrics.forEach((metric, m) => {
      if (!thresholds) {
        parts[m].push(set.distances(metric, a, b));
      } else {
        const links = set.links(metric, thresholds[m], a, b);
        parts[m].push({ source: links.source, target: links.target, distance: links.distance });
        links.free();
      }
    });
    set.free();
  });

  const results = parts.map(metricParts => !thresholds
    // Float32 is what the graph stores, and halves the transfer
    ? { distances: Float32Array.from(concat(Float64Array, metricParts)) }
    : {
      source: concat(Uint32Array, metricParts.map(p => p.source)),
      target: concat(Uint32Array, metricParts.map(p => p.target)),
      distance: concat(Float64Array, metricParts.map(p => p.distance))
    });

  console.log('Links Compute time (rows ' + rowStart + '-' + rowEnd + ', ' + metrics.join(', ') + '): ', (Date.now() - start).toLocaleString(), 'ms');
  const buffers = results.flatMap(r => Object.values(r).map(v => v.buffer));
  postMessage({ results, start: Date.now() }, buffers);
  close();
};

function concat(Type, arrays) {
  if (arrays.length == 1) return arrays[0];
  const out = new Type(arrays.reduce((sum, a) => sum + a.length, 0));
  let offset = 0;
  arrays.forEach(a => {
    out.set(a, offset);
    offset += a.length;
  });
  return out;
}
