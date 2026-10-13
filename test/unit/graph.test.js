// Unit tests for src/graph.js. Run with: node --test test/unit
const test = require('node:test');
const assert = require('node:assert');
const MTGraph = require('../../src/graph.js');

const { IMPLICIT, pairIndex, pairRows } = MTGraph;

function rng(seed) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

// The old representation: link objects plus temp.matrix, merged like MT.addLink.
function reference() {
  const matrix = {}, links = [];
  return {
    links,
    add(l) {
      matrix[l.source] = matrix[l.source] || {};
      matrix[l.target] = matrix[l.target] || {};
      if (l.source == l.target) return 0;
      const old = matrix[l.source][l.target];
      if (old) {
        const origin = [...new Set((l.origin || []).concat(old.origin))];
        Object.assign(old, l, { origin });
        return 0;
      }
      const link = Object.assign({ origin: [] }, l);
      matrix[l.source][l.target] = matrix[l.target][l.source] = link;
      links.push(link);
      return 1;
    },
    get: (a, b) => (matrix[a] || {})[b]
  };
}

const sortedLinks = links => links
  .map(l => ({ key: [l.source, l.target].sort().join('|'), l }))
  .sort((a, b) => a.key < b.key ? -1 : 1);

test('pairIndex and pairRows are inverses', () => {
  for (const n of [2, 3, 7, 100, 4097]) {
    let k = 0;
    for (let i = 0; i < Math.min(n, 60); i++) {
      for (let j = i + 1; j < n; j++, k++) {
        assert.strictEqual(pairIndex(i, j, n), k);
        assert.deepStrictEqual(pairRows(k, n), [i, j]);
      }
    }
    const last = n * (n - 1) / 2 - 1;
    assert.deepStrictEqual(pairRows(last, n), [n - 2, n - 1]);
  }
});

test('explicit links merge like MT.addLink', () => {
  const r = rng(1), g = new MTGraph(), ref = reference();
  const origins = ['a.csv', 'b.csv', 'Genetic Distance'];
  for (let x = 0; x < 3000; x++) {
    const s = 'n' + Math.floor(r() * 60), t = 'n' + Math.floor(r() * 60);
    const link = { source: s, target: t, origin: [origins[Math.floor(r() * 3)]] };
    if (r() < 0.8) link.distance = Math.round(r() * 1000) / 1000;
    if (r() < 0.3) link.label = 'L' + Math.floor(r() * 5);
    if (r() < 0.1) link.distance = null;
    assert.strictEqual(g.addLink(Object.assign({}, link)), ref.add(Object.assign({}, link)));
  }
  g.freeze();
  assert.strictEqual(g.edgeCount, ref.links.length);
  const got = [];
  g.forEachEdge(e => got.push(g.link(e)));
  const a = sortedLinks(got), b = sortedLinks(ref.links);
  a.forEach((x, i) => {
    const want = b[i].l;
    assert.strictEqual(x.l.source, want.source);
    assert.strictEqual(x.l.target, want.target);
    assert.deepStrictEqual(x.l.origin, want.origin);
    assert.strictEqual(x.l.distance, want.distance == undefined ? null : want.distance);
    assert.strictEqual(x.l.label, want.label == undefined ? null : want.label);
  });
  // Pair lookup through the CSR index, both directions
  for (let x = 0; x < 500; x++) {
    const s = Math.floor(r() * 60), t = Math.floor(r() * 60);
    const e = g.edgeBetween(g.index.get('n' + s), g.index.get('n' + t));
    const want = ref.get('n' + s, 'n' + t);
    if (s == t || !want) assert.strictEqual(e, -1);
    else assert.strictEqual(g.link(e).distance, want.distance == undefined ? null : want.distance);
  }
  // Adding after freeze thaws the index
  g.addLink({ source: 'n0', target: 'zz', distance: 1 });
  assert.ok(g.edgeBetween(g.index.get('n0'), g.index.get('zz')) >= 0);
});

test('a column falls back to a plain array for non-numeric values', () => {
  const g = new MTGraph();
  g.addLink({ source: 'a', target: 'b', w: 1 });
  g.addLink({ source: 'b', target: 'c', w: 'x' });
  g.addLink({ source: 'c', target: 'd' });
  assert.deepStrictEqual([0, 1, 2].map(e => g.getValue(e, 'w')), [1, 'x', null]);
});

test('dense distances behave like one explicit link per pair', () => {
  const r = rng(2), ids = Array.from({ length: 40 }, (_, i) => 's' + i);
  const n = ids.length, tri = new Float32Array(n * (n - 1) / 2).map(() => Math.round(r() * 100) / 1000);
  tri[5] = NaN;
  const imported = [];
  for (let x = 0; x < 150; x++) {
    const s = 's' + Math.floor(r() * 50), t = 's' + Math.floor(r() * 50); // some outside the triangle
    imported.push({ source: s, target: t, origin: ['links.csv'], distance: 9, weight: x });
  }
  const before = imported.slice(0, 100), after = imported.slice(100);

  // Old way: imported links, then computeLinks' addLink per pair, then more imports
  const ref = reference();
  before.forEach(l => ref.add(Object.assign({}, l)));
  let k = 0;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++, k++) {
    ref.add({ source: ids[j], target: ids[i], distance: tri[k], origin: ['Genetic Distance'] });
  }
  after.forEach(l => ref.add(Object.assign({}, l)));

  const g = new MTGraph();
  before.forEach(l => g.addLink(Object.assign({}, l)));
  g.setDistances(ids, tri, 'distance', 'Genetic Distance');
  after.forEach(l => g.addLink(Object.assign({}, l)));
  g.freeze();

  assert.strictEqual(g.edgeCount, ref.links.length);
  const got = [];
  g.forEachEdge(e => got.push(g.link(e)));
  const a = sortedLinks(got), b = sortedLinks(ref.links);
  a.forEach((x, i) => {
    const want = b[i].l;
    assert.strictEqual(x.key, b[i].key);
    assert.deepStrictEqual([x.l.source, x.l.target], [want.source, want.target]);
    assert.deepStrictEqual(x.l.origin, want.origin);
    const d = want.distance;
    if (isNaN(d)) assert.strictEqual(x.l.distance, null);
    else assert.strictEqual(x.l.distance, d);
    assert.strictEqual(x.l.weight, want.weight == undefined ? null : want.weight);
  });

  // Every value seen once by forEachValue
  let count = 0, sum = 0, refSum = 0;
  g.forEachValue('distance', v => { count++; sum += v; });
  ref.links.forEach(l => { if (l.distance != null && !isNaN(l.distance)) refSum += l.distance; });
  assert.strictEqual(count, ref.links.filter(l => l.distance != null && !isNaN(l.distance)).length);
  assert.ok(Math.abs(sum - refSum) < 1e-9);
});

test('visibility and components match a direct computation', () => {
  const r = rng(3), ids = Array.from({ length: 30 }, (_, i) => 'q' + i);
  const n = ids.length, tri = new Float32Array(n * (n - 1) / 2).map(() => r());
  const g = new MTGraph();
  g.addLink({ source: 'q1', target: 'q2', distance: 0.01, origin: ['x'] });
  g.addLink({ source: 'q3', target: 'extra', distance: 0.02, origin: ['x'] });
  g.setDistances(ids, tri, 'distance', 'Genetic Distance');
  g.freeze();
  const all = [];
  g.forEachEdge(e => all.push(g.link(e)));
  const t = 0.05;
  const vis = g.computeVisible('distance', t, false, () => true);
  const want = all.filter(l => l.distance != null && l.distance <= t);
  assert.strictEqual(vis.length, want.length);

  // Components by BFS over the visible links
  const adj = new Map();
  want.forEach(l => {
    [[l.source, l.target], [l.target, l.source]].forEach(([a, b]) => {
      if (!adj.has(a)) adj.set(a, []);
      adj.get(a).push(b);
    });
  });
  const comp = g.components();
  g.ids.forEach((id, i) => {
    (adj.get(id) || []).forEach(nb => assert.strictEqual(comp[g.index.get(nb)], comp[i]));
  });
  const clusters = new Set(comp).size;
  const seen = new Set();
  let bfsCount = 0;
  g.ids.forEach(id => {
    if (seen.has(id)) return;
    bfsCount++;
    const queue = [id];
    seen.add(id);
    while (queue.length) (adj.get(queue.pop()) || []).forEach(nb => { if (!seen.has(nb)) { seen.add(nb); queue.push(nb); } });
  });
  assert.strictEqual(clusters, bfsCount);

  // The NN flag on an implicit edge, and the nnOnly filter
  const e = vis.find(e => e >= IMPLICIT);
  g.setFlag(e, MTGraph.NN, true);
  const nnVis = g.computeVisible('distance', t, true, () => true);
  assert.ok(nnVis.includes(e));
  assert.ok(g.link(e).nn);
});

test('several metrics over the same sequences are kept side by side', () => {
  const r = rng(4), ids = Array.from({ length: 25 }, (_, i) => 'm' + i);
  const n = ids.length, pairs = n * (n - 1) / 2;
  const tn93 = new Float32Array(pairs).map(() => Math.round(r() * 100) / 1000);
  const snps = new Float32Array(pairs).map(() => Math.floor(r() * 40));
  const g = new MTGraph();
  g.addLink({ source: 'm3', target: 'm1', origin: ['links.csv'], weight: 7 });
  g.setDistances(ids, tn93, 'distance', 'Genetic Distance');
  g.setDistances(ids, snps, 'snps', 'Genetic Distance');
  // A link added later, over a computed pair, carries both
  g.addLink({ source: 'm5', target: 'm9', origin: ['links.csv'] });
  g.freeze();

  assert.strictEqual(g.edgeCount, pairs);
  const at = (a, b) => g.edgeBetween(g.index.get(a), g.index.get(b));
  const k = (a, b) => pairIndex(Math.min(a, b), Math.max(a, b), n);
  [['m3', 'm1', 1, 3], ['m5', 'm9', 5, 9], ['m2', 'm20', 2, 20]].forEach(([a, b, i, j]) => {
    const l = g.link(at(a, b));
    assert.strictEqual(l.distance, tn93[k(i, j)]);
    assert.strictEqual(l.snps, snps[k(i, j)]);
  });
  assert.strictEqual(g.link(at('m3', 'm1')).weight, 7);

  // Each field is read, and filters, on its own
  let count = 0, sum = 0;
  g.forEachValue('snps', v => { count++; sum += v; });
  assert.strictEqual(count, pairs);
  assert.strictEqual(sum, snps.reduce((a, b) => a + b, 0));
  const within = Array.from(snps).filter(v => v <= 10).length;
  assert.strictEqual(g.computeVisible('snps', 10, false, () => true).length, within);
  assert.strictEqual(g.computeVisible('distance', 0.05, false, () => true).length, Array.from(tn93).filter(v => v <= 0.05).length);

  // Distances over other sequences replace them all
  const others = ['m1', 'm2', 'm3'];
  g.setDistances(others, new Float32Array([0.1, 0.2, 0.3]), 'distance', 'Genetic Distance');
  assert.strictEqual(g.denseValues('snps'), null);
  assert.strictEqual(g.link(at('m1', 'm2')).distance, Math.fround(0.1));
});
