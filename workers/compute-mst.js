// Flags the links of the minimum spanning tree plus the near-ties allowed by
// epsilon. Takes the condensed distance matrix (NaN where there's no link) of n
// nodes and returns the flagged links as pairs of node positions.
onmessage = function(e){
    const start = Date.now();
    const n = e.data.n;
    const tri = e.data.matrix;
    const epsilon = Math.pow(10, e.data.epsilon);

    // A missing link is no edge (Infinity), not a zero-weight one
    const weight = (u, v) => {
      if (u == v) return 0;
      const w = u < v ? tri[u * n - u * (u + 1) / 2 + v - u - 1] : tri[v * n - v * (v + 1) / 2 + u - v - 1];
      return w == w ? w : Infinity;
    };

    const mst = primMST(n, weight);
    const nng = nearest_neighbour_graph(n, weight, mst, epsilon);

    let pairs = [];
    for (let i = 0; i < n; i++) {
      nng[i].push(mst[i]);
      new Set(nng[i]).forEach(u => {
        if (u >= 0) pairs.push(i, u);
      });
    }
    const output = Uint32Array.from(pairs);
    console.log('MST Compute time: ', (Date.now()-start).toLocaleString(), 'ms');
    postMessage({pairs: output.buffer, start: Date.now()}, [output.buffer]);
    close();
};

const minKey = (key, mstSet, V) => {
  let min = Number.MAX_VALUE;
  let min_index = -1;
  for (let v = 0; v < V; v++)
    if (!mstSet[v] && key[v] < min) {
        min = key[v];
        min_index = v;
    }
  return min_index;
}

// A minimum spanning forest: where nodes have no links to the rest, each
// component gets its own root, whose parent is -1.
const primMST = (V, weight) => {
  let parent = new Int32Array(V).fill(-1);
  let key = new Float64Array(V).fill(Number.MAX_VALUE);
  let mstSet = new Uint8Array(V);
  for (let root = 0; root < V; root++) {
      if (mstSet[root]) continue;
      key[root] = 0.0;
      for (;;) {
          const u = minKey(key, mstSet, V);
          if (u < 0) break;
          mstSet[u] = 1;
          for (let v = 0; v < V; v++) {
              const w = weight(u, v);
              if (w >= 0 && w < Infinity && !mstSet[v] && w < key[v]) {
                  parent[v]  = u;
                  key[v] = w;
              }
          }
      }
  }
  return parent;
}

const nearest_neighbour_graph = (V, weight, mst_parents, epsilon) => {
  let mst = [];
  for (let i=0; i<V; ++i) {
    mst.push([]);
  }
  for (let i=0; i<V; ++i) {
    if (mst_parents[i] < 0) continue;
    mst[i].push(mst_parents[i]);
    mst[mst_parents[i]].push(i);
  }
  let nng = [];
  // Symmetric, so stored as a full matrix row by row
  let longest_edge = new Float64Array(V * V);
  for (let i=0; i<V; ++i) {
    nng.push([]);
  }
  for (let i=0; i<V; ++i) {
    bfs_update_matrix(V, mst, weight, i, longest_edge);
  }
  for (let i=0; i<V; ++i) {
    for (let j=0; j<V; ++j) {
      const w = weight(i, j);
      if ((w > 0 ) && (w <= (longest_edge[i * V + j] * (1.0 + epsilon)))) {
          nng[i].push(j);
          nng[j].push(i);
      } 
    }
  }
  return nng;
}

const bfs_update_matrix = (V, mst, weight, root, longest_edge) => {
  let visited = new Uint8Array(V);
  let queue = [root];
  while (queue.length) {
    let v = queue.shift();
    visited[v] = 1;
    mst[v].forEach(u => {
      if(visited[u]) return;
      queue.push(u);
      const value = Math.max(weight(v, u), Math.max(longest_edge[root * V + u], longest_edge[root * V + v]));
      longest_edge[root * V + u] = value;
      longest_edge[u * V + root] = value;
    })
  }
}
