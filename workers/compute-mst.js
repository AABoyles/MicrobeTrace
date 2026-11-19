// Timings show only when debugging is on: runWorker names the worker "debug" then (see MT.debugging in src/common.js)
const debugTime = (label, start) => { if (globalThis.name == 'debug') console.log(label + ' time: ', (Date.now() - start).toLocaleString(), 'ms'); };
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
  const pairs = nearest_neighbour_pairs(n, weight, mst, epsilon);
  const output = Uint32Array.from(pairs);
  debugTime('MST Compute', start);
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

// The links to flag, as pairs of node positions: each node's links no longer
// than the longest MST edge on the path between their ends (give or take a
// fraction epsilon), and its MST parent. One node at a time, the longest edge on
// the MST path to every other node is found by walking the tree from it, so the
// memory is O(V), not the V * V of a table of every pair (#249).
const nearest_neighbour_pairs = (V, weight, mst_parents, epsilon) => {
 // The MST's edges, as adjacency lists in one array
 const start = new Int32Array(V + 1);
 for (let i = 0; i < V; ++i) {
  if (mst_parents[i] < 0) continue;
  start[i + 1]++;
  start[mst_parents[i] + 1]++;
 }
 for (let i = 0; i < V; ++i) start[i + 1] += start[i];
 const next = start.slice(0, V), adjacent = new Int32Array(start[V]);
 for (let i = 0; i < V; ++i) {
  if (mst_parents[i] < 0) continue;
  adjacent[next[i]++] = mst_parents[i];
  adjacent[next[mst_parents[i]]++] = i;
 }

 const pairs = [];
 const longest_edge = new Float64Array(V);
 const visited = new Uint8Array(V);
 const queue = new Int32Array(V);
 for (let i = 0; i < V; ++i) {
  longest_edge.fill(0);
  visited.fill(0);
  let head = 0, tail = 0;
  queue[tail++] = i;
  visited[i] = 1;
  while (head < tail) {
   const v = queue[head++];
   for (let k = start[v]; k < start[v + 1]; ++k) {
    const u = adjacent[k];
    if (visited[u]) continue;
    visited[u] = 1;
    queue[tail++] = u;
    longest_edge[u] = Math.max(weight(v, u), longest_edge[v]);
   }
  }
  // Any link (zero-length ones too: identical sequences are each other's
  // nearest neighbours) no longer than the longest MST edge on the path
  // between its ends, give or take a fraction epsilon. Nodes in another
  // component have no path (0), so only zero-length links to them count.
  let parentSeen = mst_parents[i] < 0;
  for (let j = 0; j < V; ++j) {
   if (i == j) continue;
   const w = weight(i, j);
   if (w < Infinity && w <= longest_edge[j] * (1.0 + epsilon)) {
    pairs.push(i, j);
    if (j == mst_parents[i]) parentSeen = true;
   }
  }
  if (!parentSeen) pairs.push(i, mst_parents[i]);
 }
 return pairs;
};
