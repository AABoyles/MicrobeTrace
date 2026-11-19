// Timings show only when debugging is on: runWorker names the worker "debug" then (see MT.debugging in src/common.js)
const debugTime = (label, start) => { if (globalThis.name == 'debug') console.log(label + ' time: ', (Date.now() - start).toLocaleString(), 'ms'); };
importScripts('../vendor/bx_distance_models.js');

// Computes genetic distances with bx-distance-models (WebAssembly) for rows
// [rowStart, rowEnd) of the upper triangle of the pairwise matrix: pairs (i, j),
// i < j, row by row. MT.computeLinks splits the rows across several of these
// workers and concatenates their results.
//
// mode is 'skip', 'resolve', 'average' or 'hivtrace-g'. 'hivtrace-g' is HIV-TRACE's
// `tn93 -a resolve -g F` (F is `fraction`), decided pair by pair: a pair's
// ambiguities are resolved, unless the sites in it with a resolvable IUPAC
// ambiguity code (RYMKWSBDHV; gaps and N are not ambiguity) are at least F times
// the sites compared in it (those where neither sequence has a gap), in which
// case they are averaged.
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

  // Each metric's parts, range by range
  const parts = metrics.map(() => []);
  const hivtrace = mode == 'hivtrace-g';
  if (!hivtrace) {
    const set = new wasm_bindgen.SequenceSet(seqs, mode);
    metrics.forEach((metric, m) => parts[m].push(distancesOrLinks(set, metric, thresholds && thresholds[m], rowStart, rowEnd)));
    set.free();
  } else {
    const resolve = new wasm_bindgen.SequenceSet(seqs, 'resolve');
    const average = new wasm_bindgen.SequenceSet(seqs, 'average');
    const kinds = seqs.map(siteKinds);
    const n = seqs.length;
    // Rows in chunks, so the two sets of distances held at once stay small
    for (let a = rowStart; a < rowEnd;) {
      postMessage({ progress: (a - rowStart) / Math.max(1, rowEnd - rowStart) });
      let b = a, pairs = 0;
      while (b < rowEnd && (pairs == 0 || pairs < 1e6)) pairs += n - 1 - b++;
      const r = metrics.map(metric => resolve.distances(metric, a, b));
      const v = metrics.map(metric => average.distances(metric, a, b));
      const chosen = metrics.map(() => new Float64Array(pairs));
      let k = 0;
      for (let i = a; i < b; i++) {
        for (let j = i + 1; j < n; j++, k++) {
          const useAverage = tooAmbiguous(kinds[i], kinds[j], fraction);
          metrics.forEach((metric, m) => { chosen[m][k] = (useAverage ? v : r)[m][k]; });
        }
      }
      metrics.forEach((metric, m) => {
        if (!thresholds) {
          parts[m].push(chosen[m]);
        } else {
          const source = [], target = [], distance = [];
          let k = 0;
          for (let i = a; i < b; i++) {
            for (let j = i + 1; j < n; j++, k++) {
              if (chosen[m][k] <= thresholds[m]) { source.push(i); target.push(j); distance.push(chosen[m][k]); }
            }
          }
          parts[m].push({ source: Uint32Array.from(source), target: Uint32Array.from(target), distance: Float64Array.from(distance) });
        }
      });
      a = b;
    }
    resolve.free();
    average.free();
  }

  const results = parts.map(metricParts => !thresholds
    // Float32 is what the graph stores, and halves the transfer
    ? { distances: Float32Array.from(concat(Float64Array, metricParts)) }
    : {
      source: concat(Uint32Array, metricParts.map(p => p.source)),
      target: concat(Uint32Array, metricParts.map(p => p.target)),
      distance: concat(Float64Array, metricParts.map(p => p.distance))
    });

  debugTime('Links Compute (rows ' + rowStart + '-' + rowEnd + ', ' + metrics.join(', ') + ')', start);
  const buffers = results.flatMap(r => Object.values(r).map(v => v.buffer));
  postMessage({ results, start: Date.now() }, buffers);
  close();
};

// One metric's distances (as an array) or, with a threshold, its links (as arrays)
function distancesOrLinks(set, metric, threshold, a, b) {
  if (threshold === null || threshold === undefined) return set.distances(metric, a, b);
  const links = set.links(metric, threshold, a, b);
  const part = { source: links.source, target: links.target, distance: links.distance };
  links.free();
  return part;
}

// Per site: 0 for a gap (or N, which the distance code treats like a gap), 1 for an
// unambiguous base, 2 for a resolvable IUPAC ambiguity code
const AMBIGUOUS = new Set('RYMKWSBDHV');
function siteKinds(seq) {
  const kinds = new Uint8Array(seq.length);
  for (let i = 0; i < seq.length; i++) {
    const c = seq[i].toUpperCase();
    kinds[i] = AMBIGUOUS.has(c) ? 2 : 'ACGTU'.includes(c) ? 1 : 0;
  }
  return kinds;
}

// tn93 -g: average when the ambiguous sites resolved in the pair are at least
// fraction of the sites compared
function tooAmbiguous(x, y, fraction) {
  const len = Math.min(x.length, y.length);
  let compared = 0, ambiguous = 0;
  for (let s = 0; s < len; s++) {
    if (x[s] && y[s]) {
      compared++;
      if (x[s] == 2 || y[s] == 2) ambiguous++;
    }
  }
  return compared > 0 && ambiguous >= fraction * compared;
}

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
