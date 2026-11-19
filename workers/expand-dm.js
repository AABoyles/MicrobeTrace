// Takes the condensed upper triangle of the distances (NaN where there's no
// link, in MTGraph.pairIndex order) and the number of nodes, and returns the
// full n by n matrix as a flat Float64Array: 0 on the diagonal, NaN where
// there's no distance. Reports its progress by rows, as it builds them.
onmessage = function(e){
  const start = Date.now();
  const n = e.data.n, tri = e.data.tri;
  const dm = new Float64Array(n * n).fill(NaN);
  const every = Math.max(1, Math.floor(n / 100));
  let k = 0;
  for (let i = 0; i < n; i++) {
    dm[i * n + i] = 0;
    for (let j = i + 1; j < n; j++, k++) {
      const v = tri[k];
      if (isFinite(v)) dm[i * n + j] = dm[j * n + i] = v;
    }
    if (i % every == 0) postMessage({progress: i / n});
  }
  postMessage({dm: dm, start: start}, [dm.buffer]);
};
