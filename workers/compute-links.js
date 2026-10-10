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
// With a threshold, only pairs at or under it are returned (as source, target and
// distance arrays). Without one, every pair's distance is returned.

const ready = wasm_bindgen({ module_or_path: '../vendor/bx_distance_models_bg.wasm' });

onmessage = async function(e) {
  await ready;
  let start = Date.now();
  const { seqs, metric, mode, averageRows, rowStart, rowEnd } = e.data;
  const threshold = e.data.threshold == null ? null : parseFloat(e.data.threshold);

  const ranges = mode == 'hivtrace-g' ? [
    ['average', rowStart, Math.min(rowEnd, averageRows)],
    ['resolve', Math.max(rowStart, averageRows), rowEnd]
  ] : [[mode, rowStart, rowEnd]];

  const parts = [];
  ranges.forEach(([ambiguity, a, b]) => {
    if (a >= b) return;
    const set = new wasm_bindgen.SequenceSet(seqs, ambiguity);
    if (threshold == null) {
      parts.push(set.distances(metric, a, b));
    } else {
      const links = set.links(metric, threshold, a, b);
      parts.push({ source: links.source, target: links.target, distance: links.distance });
      links.free();
    }
    set.free();
  });

  let output;
  if (threshold == null) {
    output = { distances: concat(Float64Array, parts) };
  } else {
    output = {
      source: concat(Uint32Array, parts.map(p => p.source)),
      target: concat(Uint32Array, parts.map(p => p.target)),
      distance: concat(Float64Array, parts.map(p => p.distance))
    };
  }

  console.log('Links Compute time (rows ' + rowStart + '-' + rowEnd + '): ', (Date.now() - start).toLocaleString(), 'ms');
  output.start = Date.now();
  postMessage(output, Object.values(output).filter(v => v.buffer).map(v => v.buffer));
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
