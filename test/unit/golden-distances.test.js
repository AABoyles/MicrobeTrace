// Golden tests for the genetic distances (#171): MicrobeTrace's own distance
// code (workers/compute-links.js running bx-distance-models' WebAssembly, and
// MT.computeLinks over it) against values derived
// independently of it, from the published formulas and HIV-TRACE's tn93. The
// data, the expected values and how they were derived are in test/golden/.
// Run with: npm test
const test = require('node:test');
const assert = require('node:assert');
const { runWorker, loadApp, parseFasta, expected } = require('../golden/harness.js');
const reference = require('../golden/reference.js');

const METRICS = ['tn93', 'snps', 'hamming', 'p_distance', 'jc69', 'k2p', 'tn92', 'transitions', 'transversions', 'ts_tv_ratio'];
const STRATEGIES = { skip: 'SKIP', resolve: 'RESOLVE', average: 'AVERAGE', gapmm: 'GAPMM' };
const FILES = ['distances', 'ambiguity'];

// Expected values are stored as numbers, or 'Infinity' / 'NaN'
const num = v => typeof v == 'number' ? v : Number(v);
const near = (got, want, tol) => got === want || Math.abs(got - want) <= tol * Math.max(1, Math.abs(want));

// Checks every pair of one metric; ts_tv_ratio has no value when a pair has
// neither transitions nor transversions, which the app reports as 0 (a convention).
function checkMetric(metric, got, want, pairs, tol) {
  const bad = [];
  want.forEach((w, k) => {
    w = num(w);
    const ok = metric == 'ts_tv_ratio' && Number.isNaN(w) ? got[k] === 0 : near(got[k], w, tol);
    if (!ok) bad.push(`${pairs[k].join('-')}: app ${got[k]}, reference ${w}`);
  });
  assert.deepStrictEqual(bad, [], `${metric} differs from the reference`);
}

// The reference implementation reproduces the stored values, and through them
// tn93's and scikit-bio's (derive.js checks those agree to 1e-12)
test('the stored expected values are the reference implementation\'s', async () => {
  for (const file of FILES.concat('hivtrace-g')) {
    const exp = expected(`${file}.expected.json`);
    const seqs = await parseFasta(`${file}.fasta`);
    const ids = seqs.map(s => s.id);
    exp.pairs.forEach(([a, b], k) => {
      const s1 = seqs[ids.indexOf(a)].seq, s2 = seqs[ids.indexOf(b)].seq;
      Object.entries(exp.modes).forEach(([mode, values]) => {
        const r = mode == 'hivtrace-g' ? reference.hivtraceG(s1, s2, values.fraction) : reference.distances(s1, s2, mode);
        METRICS.filter(m => values[m]).forEach(m => {
          const w = num(values[m][k]);
          assert.ok(Number.isNaN(w) ? Number.isNaN(r[m]) : near(r[m], w, 1e-12), `${file} ${mode} ${m} ${a}-${b}`);
        });
      });
      Object.entries(exp.external).filter(([tool]) => tool.startsWith('tn93 ')).forEach(([tool, values]) => {
        const mode = tool.includes('-g') ? 'hivtrace-g' : tool.split(' ').pop();
        assert.ok(near(num(exp.modes[mode].tn93[k]), values[k], 1e-12), `${file} ${tool} ${a}-${b}`);
      });
    });
  }
});

// Every metric's expected values for one mode of one file. The files store only
// TN93 for GapMM (the value tn93 -a gapmm checks); the other metrics come from
// the reference implementation, as the stored ones do.
async function want(file, mode) {
  const exp = expected(`${file}.expected.json`);
  const seqs = await parseFasta(`${file}.fasta`);
  const ids = seqs.map(s => s.id);
  const values = Object.assign({}, exp.modes[mode]);
  METRICS.filter(m => !values[m]).forEach(m => {
    values[m] = exp.pairs.map(([a, b]) => reference.distances(seqs[ids.indexOf(a)].seq, seqs[ids.indexOf(b)].seq, mode)[m]);
  });
  return { exp, values };
}

// The worker as MT.computeLinks runs it, asked for every pair (a threshold no
// pair exceeds) so it returns float64 distances rather than the float32 triangle
async function workerDistances(seqs, mode) {
  const n = seqs.length;
  const out = await runWorker('workers/compute-links.js', {
    seqs: seqs.map(s => s.seq), metrics: METRICS, mode, rowStart: 0, rowEnd: n,
    thresholds: METRICS.map(() => 'Infinity')
  });
  return out.results.map(({ source, target, distance }) => {
    const byPair = new Map();
    distance.forEach((d, l) => byPair.set(source[l] + ',' + target[l], d));
    const tri = [];
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) tri.push(byPair.get(i + ',' + j));
    return tri;
  });
}

for (const file of FILES) {
  for (const mode of Object.keys(STRATEGIES)) {
    test(`${file}.fasta, ${mode}: each metric from compute-links.js matches the reference`, async t => {
      const { exp, values } = await want(file, mode);
      const results = await workerDistances(await parseFasta(`${file}.fasta`), mode);
      for (const [m, metric] of METRICS.entries()) {
        await t.test(metric, () =>
          checkMetric(metric, results[m], values[metric], exp.pairs, 1e-9));
      }
    });
  }
}

// The whole path the files page takes: MT.computeLinks splits the pairs over
// workers and stores the float32 triangle in the graph; read it back with
// MT.getCondensedDM.
async function pipeline(file, strategy, widgets = {}) {
  const { MT, session } = loadApp(Object.assign({
    'default-distance-metric': 'tn93',
    'distance-metrics-also': METRICS.slice(1),
    'ambiguity-resolution-strategy': strategy,
    'link-storage': 'all'
  }, widgets));
  const seqs = await parseFasta(`${file}.fasta`);
  const nodes = session.data.nodes = seqs.map((s, i) => ({ _id: s.id, seq: s.seq, index: i }));
  await MT.computeAmbiguityCounts();
  assert.ok(nodes.every(d => !('_seqInt' in d)), 'the encoded sequences are not kept on the nodes (#224)');
  assert.ok(!JSON.stringify(nodes).includes('_seqInt'));
  await MT.computeLinks(nodes.slice());
  return { MT, session, ids: seqs.map(s => s.id) };
}

for (const file of FILES) {
  for (const [mode, strategy] of Object.entries(STRATEGIES)) {
    test(`${file}.fasta, ${strategy}: MT.computeLinks stores the reference distances`, async t => {
      const { exp, values } = await want(file, mode);
      const { MT, ids } = await pipeline(file, strategy);
      for (const metric of METRICS) {
        await t.test(metric, () => {
          const { tri } = MT.getCondensedDM(metric, ids);
          checkMetric(metric, Array.from(tri), values[metric], exp.pairs, 1e-6);
        });
      }
    });
  }
}

test('kept within the link threshold, MT.computeLinks stores exactly the pairs within it', async () => {
  const exp = expected('distances.expected.json');
  const threshold = 0.03;
  const { MT, session, ids } = await pipeline('distances', 'RESOLVE', {
    'distance-metrics-also': [], 'link-storage': 'threshold', 'link-threshold': threshold
  });
  const want = exp.pairs.filter((p, k) => exp.modes.resolve.tn93[k] <= threshold).map(p => p.join('-')).sort();
  assert.strictEqual(session.data.graph.dense, null, 'links are stored sparse');
  const { tri } = MT.getCondensedDM('tn93', ids);
  const got = [];
  exp.pairs.forEach((p, k) => {
    if (Number.isNaN(tri[k])) return;
    got.push(p.join('-'));
    assert.ok(near(tri[k], exp.modes.resolve.tn93[k], 1e-12), p.join('-'));
  });
  assert.deepStrictEqual(got.sort(), want);
  assert.strictEqual(want.length, 12);
});

// N and ? are fourfold ambiguity codes in resolve, average and GapMM, as tn93
// reads them; skip leaves them out. The golden files have none, so these
// sequences do: N facing bases, codes and a gap, and ? facing an R.
const WITH_N = [
  { id: 'n0', seq: 'ACGTACGTACGTACGTACGTACGTACGTACGTACGTACGT' },
  { id: 'n1', seq: 'ACGTNCGTACGTACGTACRTACGTACGTANGTACGTACGT' },
  { id: 'n2', seq: 'ACGTACGNACGTAC-TACGTACGTAC?TACGTNCGTACGA' },
  { id: 'n3', seq: 'GCGTACGTACNTACGTACGTRCGTACGTACGTACGTAC-T' }
];
for (const mode of Object.keys(STRATEGIES)) {
  test(`N and ?, ${mode}: each metric from compute-links.js matches the reference`, async t => {
    const results = await workerDistances(WITH_N, mode);
    const pairs = [], values = {};
    WITH_N.forEach((a, i) => WITH_N.slice(i + 1).forEach(b => pairs.push([a, b])));
    METRICS.forEach(m => { values[m] = pairs.map(([a, b]) => reference.distances(a.seq, b.seq, mode)[m]); });
    for (const [m, metric] of METRICS.entries()) {
      await t.test(metric, () => checkMetric(metric, results[m], values[metric], pairs.map(([a, b]) => [a.id, b.id]), 1e-9));
    }
  });
}

// HIV-TRACE -g: hivtrace runs tn93 -a resolve -g FRACTION, which decides pair by
// pair whether to average: when the pair's resolvable ambiguity codes (not gaps)
// are at least FRACTION of the sites compared.
test('hivtrace-g.fasta, HIVTRACE-G: MT.computeLinks against tn93 -a resolve -g 0.015', async () => {
  const exp = expected('hivtrace-g.expected.json');
  const g = exp.modes['hivtrace-g'];
  const { MT, ids } = await pipeline('hivtrace-g', 'HIVTRACE-G', { 'distance-metrics-also': [], 'ambiguity-threshold': g.fraction });
  const { tri } = MT.getCondensedDM('tn93', ids);
  checkMetric('tn93', Array.from(tri), g.tn93, exp.pairs, 1e-6);
});

test('hivtrace-g.fasta, HIVTRACE-G with sparse storage keeps the same per-pair distances', async () => {
  const exp = expected('hivtrace-g.expected.json');
  const g = exp.modes['hivtrace-g'];
  const { MT, ids } = await pipeline('hivtrace-g', 'HIVTRACE-G', {
    'distance-metrics-also': [], 'ambiguity-threshold': g.fraction, 'link-storage': 'threshold', 'link-threshold': 0.03
  });
  const { tri } = MT.getCondensedDM('tn93', ids);
  const k = exp.pairs.map((p, i) => i).filter(i => g.tn93[i] <= 0.03);
  assert.ok(k.length > 0 && k.some(i => exp.pairs[i].join('-') == 'h1-h2'));
  checkMetric('tn93', k.map(i => tri[i]), k.map(i => g.tn93[i]), k.map(i => exp.pairs[i]), 1e-6);
});

test('the FASTA parser keeps N as an ambiguity code, as tn93 reads it (#232)', async () => {
  const seqs = await parseFasta('distances.fasta');
  assert.strictEqual(seqs.length, 8);
  assert.ok(seqs.every(s => s.seq.length == 40));
  const out = await runWorker('workers/parse-fasta.js', '>n\nACGNN\nNT\n');
  assert.deepStrictEqual(out.nodes, [{ id: 'n', seq: 'ACGNNNT' }]);
});
