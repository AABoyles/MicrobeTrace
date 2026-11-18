// Golden tests for the network and tree computations (#171): MicrobeTrace's own
// minimum spanning tree and nearest-neighbour workers (through MT.computeMST and
// MT.computeNN), cluster tagging (MT.tagClusters), the neighbour-joining tree
// worker and the Smith-Waterman aligner worker, against answers worked out by
// hand in test/golden/graph.json (see test/golden/README.md).
// Run with: npm test
const test = require('node:test');
const assert = require('node:assert');
const { runWorker, loadApp, parseFasta, expected } = require('../golden/harness.js');
const MTAlignerScoring = require('../../src/aligner.js');
const tn93js = require('../../vendor/tn93.min.js');

const golden = expected('graph.json');
const pairKey = ([a, b]) => [a, b].sort().join('-');
const pairSet = pairs => pairs.map(pairKey).sort();
const partition = groups => groups.map(g => g.slice().sort().join(',')).sort();

// The toy's distances, stored the way MT.computeLinks stores computed ones
function load(toy, widgets = {}) {
  const app = loadApp(Object.assign({ 'link-sort-variable': 'tn93', 'filtering-epsilon': -8 }, widgets));
  const { session } = app, n = toy.nodes.length;
  session.data.nodes = toy.nodes.map((id, index) => ({ _id: id, index }));
  const tri = new Float32Array(n * (n - 1) / 2).fill(NaN);
  toy.distances.forEach(([a, b, d]) => {
    let i = toy.nodes.indexOf(a), j = toy.nodes.indexOf(b);
    if (i > j) [i, j] = [j, i];
    tri[i * n - i * (i + 1) / 2 + j - i - 1] = d;
  });
  session.data.graph.setDistances(toy.nodes, tri, 'tn93', 'Genetic Distance');
  return app;
}

// The links MT.computeMST / MT.computeNN flagged
function flagged({ ctx, session }) {
  const g = session.data.graph, out = [];
  g.forEachEdge((e, s, t) => {
    if (g.getFlags(e) & ctx.MTGraph.NN) out.push([g.ids[s], g.ids[t]]);
  });
  return pairSet(out);
}

// An independent check of the hand-worked answers: an edge is in some minimum
// spanning tree iff its ends aren't joined by edges strictly lighter than it
// (the cycle property), and with distinct weights that is the one tree.
function inSomeMST(toy) {
  return toy.distances.filter(([a, b, w]) => {
    const seen = new Set([a]), stack = [a];
    while (stack.length) {
      const u = stack.pop();
      toy.distances.forEach(([x, y, v]) => {
        if (v >= w) return;
        const other = x == u ? y : y == u ? x : null;
        if (other && !seen.has(other)) { seen.add(other); stack.push(other); }
      });
    }
    return !seen.has(b);
  }).map(([a, b]) => [a, b]);
}

test('the hand-worked minimum spanning trees are right', () => {
  assert.deepStrictEqual(pairSet(inSomeMST(golden.toy)), pairSet(golden.toy.mst));
  const weight = golden.toy.mst.reduce((s, p) => s + golden.toy.distances.find(d => pairKey(d) == pairKey(p))[2], 0);
  assert.ok(Math.abs(weight - golden.toy.mstWeight) < 1e-12);
  assert.deepStrictEqual(pairSet(inSomeMST(golden.square)), pairSet(golden.square.mstUnion));
});

test('MT.computeMST flags the minimum spanning tree', async () => {
  const app = load(golden.toy);
  await app.MT.computeMST();
  assert.deepStrictEqual(flagged(app), pairSet(golden.toy.mst));
});

test('MT.computeMST flags every minimum spanning tree\'s edges when weights tie', async () => {
  const app = load(golden.square);
  await app.MT.computeMST();
  assert.deepStrictEqual(flagged(app), pairSet(golden.square.mstUnion));
});

test('MT.computeNN flags each node\'s nearest neighbours', async () => {
  const app = load(golden.toy);
  await app.MT.computeNN();
  assert.deepStrictEqual(flagged(app), pairSet(golden.toy.nearestNeighbours));
});

test('MT.computeNN flags tied nearest neighbours', async () => {
  const app = load(golden.square);
  await app.MT.computeNN();
  assert.deepStrictEqual(flagged(app), pairSet(golden.square.nearestNeighbours));
});

for (const [threshold, clusters] of Object.entries(golden.toy.clusters)) {
  test(`MT.tagClusters at a link threshold of ${threshold}`, async () => {
    const app = load(golden.toy, { 'link-threshold': parseFloat(threshold) });
    app.MT.setLinkVisibility(true);
    await app.MT.tagClusters();
    const nodes = app.session.data.nodes, byCluster = {};
    nodes.forEach(d => { (byCluster[d.cluster] = byCluster[d.cluster] || []).push(d._id); });
    assert.deepStrictEqual(partition(Object.values(byCluster)), partition(clusters));
    assert.strictEqual(app.session.data.clusters.length, clusters.length);
  });
}

test('MT.tagClusters on computed TN93 distances (distances.fasta, threshold 0.03)', async () => {
  // Clusters from the reference distances by union-find, against the app's
  const exp = expected('distances.expected.json');
  const parent = {};
  const find = x => parent[x] == x ? x : (parent[x] = find(parent[x]));
  exp.ids.forEach(id => { parent[id] = id; });
  exp.pairs.forEach(([a, b], k) => { if (exp.modes.resolve.tn93[k] <= 0.03) parent[find(a)] = find(b); });
  const want = {};
  exp.ids.forEach(id => { (want[find(id)] = want[find(id)] || []).push(id); });

  const { MT, session } = loadApp({ 'ambiguity-resolution-strategy': 'RESOLVE', 'link-storage': 'all', 'link-threshold': 0.03 });
  const seqs = await parseFasta('distances.fasta');
  const nodes = session.data.nodes = seqs.map((s, i) => ({ _id: s.id, seq: s.seq, index: i, _seqInt: tn93js.toInts(s.seq) }));
  await MT.computeLinks(nodes.slice());
  MT.setLinkVisibility(true);
  await MT.tagClusters();
  const got = {};
  nodes.forEach(d => { (got[d.cluster] = got[d.cluster] || []).push(d._id); });
  assert.deepStrictEqual(partition(Object.values(got)), partition(Object.values(want)));
  assert.deepStrictEqual(partition(Object.values(want)), partition([['ref', 'ident', 'ts_ag', 'ts_ct', 'tv', 'gapped'], ['mix'], ['far']]));
});

// Leaf-to-leaf path lengths and the leaf sets below each internal branch of a
// tree object ({ id, length, children }), whatever its rooting
function treeSummary(tree) {
  const adj = new Map(), leaves = [];
  let next = 0;
  (function walk(node, parent) {
    const id = node.children && node.children.length ? '#' + next++ : node.id;
    if (!adj.has(id)) adj.set(id, []);
    if (parent != null) {
      adj.get(id).push([parent, node.length || 0]);
      adj.get(parent).push([id, node.length || 0]);
    }
    if (node.children && node.children.length) node.children.forEach(c => walk(c, id));
    else leaves.push(id);
  })(tree, null);
  const dist = (a, b) => {
    const seen = new Map([[a, 0]]), stack = [a];
    while (stack.length) {
      const u = stack.pop();
      adj.get(u).forEach(([v, w]) => { if (!seen.has(v)) { seen.set(v, seen.get(u) + w); stack.push(v); } });
    }
    return seen.get(b);
  };
  return { leaves, dist, adj };
}

test('the tree worker recovers the tree behind an additive matrix', async () => {
  const t = golden.tree;
  const out = await runWorker('workers/compute-tree.js', { matrix: Float64Array.from(t.matrix.flat()), labels: t.labels });
  const tree = JSON.parse(new TextDecoder().decode(out.tree));
  const { leaves, dist, adj } = treeSummary(tree);
  assert.deepStrictEqual(leaves.slice().sort(), t.labels);
  // Its path lengths are the matrix, so its unrooted topology and branch lengths are the tree's
  t.labels.forEach((a, i) => t.labels.forEach((b, j) => {
    if (i < j) assert.ok(Math.abs(dist(a, b) - t.matrix[i][j]) < 1e-9, `${a}-${b}: ${dist(a, b)} vs ${t.matrix[i][j]}`);
  }));
  // Each leaf's pendant branch, through a root of degree 2 if the tree was rooted on it
  Object.entries(t.leafLengths).forEach(([leaf, len]) => {
    let [[node, pendant]] = adj.get(leaf), prev = leaf;
    while (adj.get(node).length == 2) {
      const [nextNode, w] = adj.get(node).find(([v]) => v != prev);
      pendant += w;
      prev = node;
      node = nextNode;
    }
    assert.ok(Math.abs(pendant - len) < 1e-9, `${leaf}: ${pendant} vs ${len}`);
  });
  // A and B (and D and E) are cherries: each pair's path is its two pendant branches
  t.splits.forEach(([a, b]) => assert.ok(Math.abs(dist(a, b) - t.leafLengths[a] - t.leafLengths[b]) < 1e-9));
});

test('the Smith-Waterman worker gaps a two-base deletion where it is', async () => {
  const a = golden.alignment;
  const out = await runWorker('workers/align-sw.js', {
    reference: a.reference,
    nodes: [{ seq: a.query }],
    ...MTAlignerScoring({ match: 1, mismatch: 1, gapOpen: 5, gapExtend: 2 })
  });
  const [node] = JSON.parse(new TextDecoder().decode(out.nodes));
  assert.strictEqual(node._seq, a.aligned);
  assert.strictEqual(node._score, a.score);
  assert.strictEqual(node._padding, 0);
});

// #232: a pair with no distance is no edge, not a zero-weight one
test('MT.computeMST treats a missing link as no edge', async () => {
  const toy = { nodes: ['a', 'b', 'c', 'd'], distances: [['a', 'b', 0.5], ['c', 'd', 0.4]] };
  const app = load(toy);
  await app.MT.computeMST();
  assert.deepStrictEqual(flagged(app), pairSet([['a', 'b'], ['c', 'd']]));
});

// #236: the metric argument is honoured
test('MT.computeMST and MT.computeNN use the metric they are given', async () => {
  const app = load(golden.toy);
  const g = app.session.data.graph, n = golden.toy.nodes.length;
  // A second field holding the same distances negated would flip the tree
  const tri = g.denseValues('tn93').map(v => 1 - v);
  g.setDistances(golden.toy.nodes, tri, 'other', 'Genetic Distance');
  await app.MT.computeMST('tn93');
  const byTn93 = flagged(app);
  await app.MT.computeMST('other');
  assert.notDeepStrictEqual(flagged(app), byTn93);
  assert.deepStrictEqual(byTn93, pairSet(golden.toy.mst));
});

// #228
test('a threshold above the one links were stored within is reported', () => {
  const { MT, session } = loadApp({ 'link-sort-variable': 'tn93', 'link-stored-thresholds': { tn93: 0.015 } });
  assert.strictEqual(MT.storedThresholdBelow('tn93', 0.02), 0.015);
  assert.strictEqual(MT.storedThresholdBelow('tn93', 0.015), null);
  assert.strictEqual(MT.storedThresholdBelow('snps', 5), null);
});

// #229
test('MT.isCluster counts components of more than one node', () => {
  const { MT } = loadApp({});
  assert.strictEqual(MT.isCluster(1), false);
  assert.strictEqual(MT.isCluster(2), true);
  assert.strictEqual(MT.isCluster(undefined), false);
});

// #236: the two pruning options, and the tie rule they share
const triangle = { nodes: ['P', 'Q', 'R', 'S'], distances: [['P', 'Q', 0], ['Q', 'R', 0], ['P', 'R', 0], ['R', 'S', 0.01]] };

test('MT.computeMST keeps every zero-length link among identical sequences', async () => {
  const app = load(triangle);
  await app.MT.computeMST();
  assert.deepStrictEqual(flagged(app), pairSet([['P', 'Q'], ['Q', 'R'], ['P', 'R'], ['R', 'S']]));
});

test('MT.computeNN keeps each node\'s nearest neighbours among identical sequences', async () => {
  const app = load(triangle);
  await app.MT.computeNN();
  // S's nearest is R; R's are P and Q, at 0
  assert.deepStrictEqual(flagged(app), pairSet([['P', 'Q'], ['Q', 'R'], ['P', 'R'], ['R', 'S']]));
});

test('pruning treats distances within a fraction epsilon as ties, in both workers', async () => {
  // A's nearest is B (0.0100); C (0.0105) is within 10% of it, D (0.0120) is not
  const toy = { nodes: ['A', 'B', 'C', 'D'], distances: [['A', 'B', 0.0100], ['A', 'C', 0.0105], ['A', 'D', 0.0120]] };
  for (const compute of ['computeNN', 'computeMST']) {
    const strict = load(toy);
    await strict.MT[compute]();
    const loose = load(toy, { 'filtering-epsilon': -1 });
    await loose.MT[compute]();
    // The star is its own spanning tree, so the MST keeps all three; NN drops none that are nearest to the leaves
    assert.deepStrictEqual(flagged(strict), pairSet([['A', 'B'], ['A', 'C'], ['A', 'D']]), compute);
    assert.deepStrictEqual(flagged(loose), pairSet([['A', 'B'], ['A', 'C'], ['A', 'D']]), compute);
  }
  // With another way round from A, the MST and NN differ: C-B (0.003) replaces A-C in the MST
  const ring = { nodes: ['A', 'B', 'C'], distances: [['A', 'B', 0.0100], ['A', 'C', 0.0105], ['B', 'C', 0.003]] };
  const nn = load(ring, { 'filtering-epsilon': -1 });
  await nn.MT.computeNN();
  // A's nearest is B and C ties within 10%; B's and C's is each other
  assert.deepStrictEqual(flagged(nn), pairSet([['A', 'B'], ['A', 'C'], ['B', 'C']]));
  const nnStrict = load(ring);
  await nnStrict.MT.computeNN();
  assert.deepStrictEqual(flagged(nnStrict), pairSet([['A', 'B'], ['B', 'C']]));
  const mst = load(ring);
  await mst.MT.computeMST();
  assert.deepStrictEqual(flagged(mst), pairSet([['A', 'B'], ['B', 'C']]));
});

test('MT.computePruning runs the method the link-prune setting names', async () => {
  // The toy's nearest-neighbour graph and minimum spanning tree differ
  const nn = load(golden.toy, { 'link-prune': 'nn' });
  await nn.MT.computePruning();
  assert.deepStrictEqual(flagged(nn), pairSet(golden.toy.nearestNeighbours));
  const mst = load(golden.toy, { 'link-prune': 'mst' });
  await mst.MT.computePruning();
  assert.deepStrictEqual(flagged(mst), pairSet(golden.toy.mst));
  assert.notDeepStrictEqual(golden.toy.mst, golden.toy.nearestNeighbours);
});
