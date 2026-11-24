// Unit tests for MT.getDM in src/links-clusters.js (#248): the flat matrix, its cache
// and its size limit. Run with: npm test
const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('../golden/harness.js');

function load(n) {
  const app = loadApp({ 'link-sort-variable': 'tn93' });
  const ids = Array.from({ length: n }, (_, i) => 'n' + i);
  app.session.data.nodes = ids.map((id, index) => ({ _id: id, index }));
  const tri = new Float32Array(n * (n - 1) / 2).fill(NaN);
  let k = 0;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++, k++) if ((i + j) % 3) tri[k] = i + j;
  app.session.data.graph.setDistances(ids, tri, 'tn93', 'Genetic Distance');
  return app;
}

test('getDM is a flat, symmetric Float64Array with NaN for missing pairs', async () => {
  const { MT } = load(6);
  const dm = await MT.getDM();
  assert.strictEqual(Object.prototype.toString.call(dm), "[object Float64Array]");
  assert.strictEqual(dm.length, 36);
  for (let i = 0; i < 6; i++) {
    assert.strictEqual(dm[i * 6 + i], 0);
    for (let j = 0; j < 6; j++) {
      assert.ok(Object.is(dm[i * 6 + j], dm[j * 6 + i]));
      if (i !== j) assert.ok((i + j) % 3 ? dm[i * 6 + j] === i + j : isNaN(dm[i * 6 + j]));
    }
  }
});

test('getDM is not computed again until the graph, metric or nodes change', async () => {
  const { MT, session } = load(5);
  const a = await MT.getDM();
  assert.strictEqual(await MT.getDM(), a);
  session.data.graph.version++;
  const b = await MT.getDM();
  assert.notStrictEqual(b, a);
  assert.strictEqual(await MT.getDM(), b);
  session.style.widgets['link-sort-variable'] = 'snps';
  assert.notStrictEqual(await MT.getDM(), b);
});

test('getDM refuses more nodes than its limit, saying so', async () => {
  const { MT } = load(5);
  await assert.rejects(MT.getDM(4), /too large.*limit is 4 nodes/);
  assert.ok(await MT.getDM(5));
});
