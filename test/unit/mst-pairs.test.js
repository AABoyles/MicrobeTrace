// workers/compute-mst.js flags the same links as it did when it kept a V * V
// table of the longest MST edge between every pair of nodes (#249): the worker
// is compared, on random graphs, with that implementation, copied below.
// Run with: npm test
const test = require('node:test');
const assert = require('node:assert');
const { runWorker } = require('../golden/harness.js');

// ---- The reference: the worker's code before #249 -------------------------
const minKey = (key, mstSet, V) => {
  let min = Number.MAX_VALUE;
  let min_index = -1;
  for (let v = 0; v < V; v++)
    if (!mstSet[v] && key[v] < min) {
      min = key[v];
      min_index = v;
    }
  return min_index;
};

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
          parent[v] = u;
          key[v] = w;
        }
      }
    }
  }
  return parent;
};

const nearest_neighbour_graph = (V, weight, mst_parents, epsilon) => {
  let mst = [];
  for (let i = 0; i < V; ++i) mst.push([]);
  for (let i = 0; i < V; ++i) {
    if (mst_parents[i] < 0) continue;
    mst[i].push(mst_parents[i]);
    mst[mst_parents[i]].push(i);
  }
  let nng = [];
  let longest_edge = new Float64Array(V * V);
  for (let i = 0; i < V; ++i) nng.push([]);
  for (let i = 0; i < V; ++i) bfs_update_matrix(V, mst, weight, i, longest_edge);
  for (let i = 0; i < V; ++i) {
    for (let j = 0; j < V; ++j) {
      const w = weight(i, j);
      if (i != j && w < Infinity && w <= longest_edge[i * V + j] * (1.0 + epsilon)) {
        nng[i].push(j);
        nng[j].push(i);
      }
    }
  }
  return nng;
};

const bfs_update_matrix = (V, mst, weight, root, longest_edge) => {
  let visited = new Uint8Array(V);
  let queue = [root];
  while (queue.length) {
    let v = queue.shift();
    visited[v] = 1;
    mst[v].forEach(u => {
      if (visited[u]) return;
      queue.push(u);
      const value = Math.max(weight(v, u), Math.max(longest_edge[root * V + u], longest_edge[root * V + v]));
      longest_edge[root * V + u] = value;
      longest_edge[u * V + root] = value;
    });
  }
};

function reference(n, tri, epsilonPower) {
  const epsilon = Math.pow(10, epsilonPower);
  const weight = (u, v) => {
    if (u == v) return 0;
    const w = u < v ? tri[u * n - u * (u + 1) / 2 + v - u - 1] : tri[v * n - v * (v + 1) / 2 + u - v - 1];
    return w == w ? w : Infinity;
  };
  const mst = primMST(n, weight);
  const nng = nearest_neighbour_graph(n, weight, mst, epsilon);
  const pairs = [];
  for (let i = 0; i < n; i++) {
    nng[i].push(mst[i]);
    new Set(nng[i]).forEach(u => {
      if (u >= 0) pairs.push(i, u);
    });
  }
  return pairs;
}
// ---------------------------------------------------------------------------

// A small seeded generator, so a failure can be reproduced
const random = seed => () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};

// Distances between n nodes, some missing, some tied or zero
function graph(n, rand, { missing, integers, zeros }) {
  const tri = new Float64Array(n * (n - 1) / 2);
  for (let k = 0; k < tri.length; k++) {
    let w = integers ? Math.floor(rand() * 6) + (zeros ? 0 : 1) : rand() * 10;
    if (rand() < missing) w = NaN;
    tri[k] = w;
  }
  return tri;
}

test('the MST worker flags the same links, in the same order, as the V*V implementation', async () => {
  const rand = random(249);
  let cases = 0;
  for (let n = 1; n <= 40; n += (n < 12 ? 1 : 7)) {
    for (const missing of [0, 0.3, 0.9]) {
      for (const [integers, zeros] of [[false, false], [true, false], [true, true]]) {
        for (const epsilon of [-8, -1, 0]) {
          const tri = graph(n, rand, { missing, integers, zeros });
          const expected = reference(n, tri, epsilon);
          const out = await runWorker('workers/compute-mst.js', { n, matrix: tri.slice(), epsilon });
          assert.deepStrictEqual(Array.from(new Uint32Array(out.pairs)), expected,
            `n=${n} missing=${missing} integers=${integers} zeros=${zeros} epsilon=${epsilon}`);
          cases++;
        }
      }
    }
  }
  assert.ok(cases > 200);
});

test('the MST worker allocates no V*V table', async () => {
  // The harness clones the input (n*(n-1)/2 doubles); a V*V table of doubles
  // would add twice that again, so the buffers must stay under twice the input.
  const n = 3000, rand = random(7);
  const tri = new Float64Array(n * (n - 1) / 2).fill(NaN);
  for (let i = 0; i < n - 1; i++) tri[i * n - i * (i + 1) / 2] = 1 + rand(); // a chain
  const before = process.memoryUsage().arrayBuffers;
  let peak = 0;
  const timer = setInterval(() => { peak = Math.max(peak, process.memoryUsage().arrayBuffers - before); }, 1);
  const out = await runWorker('workers/compute-mst.js', { n, matrix: tri, epsilon: -8 });
  clearInterval(timer);
  assert.strictEqual(new Uint32Array(out.pairs).length, 2 * 2 * (n - 1));
  assert.ok(peak < 2 * tri.byteLength, 'array buffers peaked at ' + peak + ' bytes');
});
