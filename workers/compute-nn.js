// Flags each node's nearest neighbors (every link within epsilon of its shortest
// link). Takes the condensed distance matrix (NaN where there's no link) of n
// nodes and returns the flagged links as pairs of node positions.
onmessage = function(e){
  const start = Date.now();
  const n = e.data.n,
      tri = e.data.matrix,
      epsilon = Math.pow(10, e.data.epsilon);
  const value = (i, j) => i < j ? tri[i * n - i * (i + 1) / 2 + j - i - 1] : tri[j * n - j * (j + 1) / 2 + i - j - 1];
  let pairs = [];
  for(let i = 0; i < n; i++){
    let minDist = Number.MAX_VALUE;
    for(let j = 0; j < n; j++){
      if(j == i) continue;
      const v = value(i, j);
      if(v < minDist) minDist = v;
    }
    for(let h = 0; h < n; h++){
      if(h == i) continue;
      const v = value(i, h);
      if(v == v && Math.abs(v - minDist) < epsilon) pairs.push(i, h);
    }
  }
  const output = Uint32Array.from(pairs);
  console.log('NN Compute time: ', (Date.now()-start).toLocaleString(), 'ms');
  postMessage({pairs: output.buffer, start: Date.now()}, [output.buffer]);
  close();
};
