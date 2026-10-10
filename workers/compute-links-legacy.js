importScripts('../vendor/tn93.min.js');

// The original tn93.js engine, kept for the GapMM ambiguity strategy, which
// bx-distance-models does not implement. It takes the same messages and returns
// the same output as compute-links.js (TN93 only).

onmessage = function(e) {
  let start = Date.now();
  const { seqs, rowStart, rowEnd } = e.data;
  const n = seqs.length;
  const threshold = e.data.threshold == null ? null : parseFloat(e.data.threshold);
  const ints = seqs.map(tn93.toInts);
  const onInts = tn93.onInts;

  let output;
  if (threshold == null) {
    let distances = new Float32Array((rowEnd - rowStart) * n - (rowEnd * (rowEnd + 1) - rowStart * (rowStart + 1)) / 2);
    let t = 0;
    for (let i = rowStart; i < rowEnd; i++) {
      for (let j = i + 1; j < n; j++) {
        distances[t++] = onInts(ints[i], ints[j], 'GAPMM');
      }
    }
    output = { distances };
  } else {
    let source = [], target = [], distance = [];
    for (let i = rowStart; i < rowEnd; i++) {
      for (let j = i + 1; j < n; j++) {
        const d = onInts(ints[i], ints[j], 'GAPMM');
        if (d <= threshold) {
          source.push(i);
          target.push(j);
          distance.push(d);
        }
      }
    }
    output = {
      source: Uint32Array.from(source),
      target: Uint32Array.from(target),
      distance: Float64Array.from(distance)
    };
  }

  console.log('Links Compute time (rows ' + rowStart + '-' + rowEnd + '): ', (Date.now() - start).toLocaleString(), 'ms');
  output.start = Date.now();
  postMessage(output, Object.values(output).filter(v => v.buffer).map(v => v.buffer));
  close();
};
