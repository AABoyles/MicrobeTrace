// Golden tests for the genetic distances (#171): MicrobeTrace's own distance
// code (workers/compute-links.js running bx-distance-models' WebAssembly, the
// GapMM worker, and MT.computeLinks over them) against values derived
// independently of it, from the published formulas and HIV-TRACE's tn93. The
// data, the expected values and how they were derived are in test/golden/.
// Run with: npm test
const test = require('node:test');
const assert = require('node:assert');
const { runWorker, loadApp, parseFasta, expected } = require('../golden/harness.js');
const reference = require('../golden/reference.js');
const tn93js = require('../../vendor/tn93.min.js');

const METRICS = ['tn93', 'snps', 'hamming', 'p_distance', 'jc69', 'k2p', 'tn92', 'transitions', 'transversions', 'ts_tv_ratio'];
const STRATEGIES = { skip: 'SKIP', resolve: 'RESOLVE', average: 'AVERAGE' };
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

// The worker as MT.computeLinks runs it, asked for every pair (a threshold no
// pair exceeds) so it returns float64 distances rather than the float32 triangle
async function workerDistances(seqs, mode) {
  const n = seqs.length;
  const out = await runWorker('workers/compute-links.js', {
    seqs: seqs.map(s => s.seq), metrics: METRICS, mode, averageRows: 0, rowStart: 0, rowEnd: n,
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
      const exp = expected(`${file}.expected.json`);
      const results = await workerDistances(await parseFasta(`${file}.fasta`), mode);
      for (const [m, metric] of METRICS.entries()) {
        await t.test(metric, () =>
          checkMetric(metric, results[m], exp.modes[mode][metric], exp.pairs, 1e-9));
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
  nodes.forEach(d => { d._seqInt = tn93js.toInts(d.seq); });
  await MT.computeAmbiguityCounts();
  await MT.computeLinks(nodes.slice());
  return { MT, session, ids: seqs.map(s => s.id) };
}

for (const file of FILES) {
  for (const [mode, strategy] of Object.entries(STRATEGIES)) {
    test(`${file}.fasta, ${strategy}: MT.computeLinks stores the reference distances`, async t => {
      const exp = expected(`${file}.expected.json`);
      const { MT, ids } = await pipeline(file, strategy);
      for (const metric of METRICS) {
        await t.test(metric, () => {
          const { tri } = MT.getCondensedDM(metric, ids);
          checkMetric(metric, Array.from(tri), exp.modes[mode][metric], exp.pairs, 1e-6);
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

// GapMM (TN93 only) runs on tn93.js in workers/compute-links-legacy.js. tn93 -a
// gapmm counts a gap facing anything but a gap as an N.
for (const file of FILES) {
  test(`${file}.fasta, GAPMM: compute-links-legacy.js`, async t => {
    const exp = expected(`${file}.expected.json`);
    const seqs = await parseFasta(`${file}.fasta`);
    const out = await runWorker('workers/compute-links-legacy.js', { seqs: seqs.map(s => s.seq), rowStart: 0, rowEnd: seqs.length });
    const got = Array.from(out.distances), want = exp.modes.gapmm.tn93;
    // Pairs where no gap faces a base: GAPMM is plain averaging there
    const gapFacesBase = exp.pairs.map(([a, b]) => {
      const s1 = seqs.find(s => s.id == a).seq, s2 = seqs.find(s => s.id == b).seq;
      return [...s1].some((c, p) => (c == '-') != (s2[p] == '-'));
    });
    await t.test('pairs where no gap faces a base', () => {
      const k = exp.pairs.map((p, i) => i).filter(i => !gapFacesBase[i]);
      checkMetric('tn93', k.map(i => got[i]), k.map(i => want[i]), k.map(i => exp.pairs[i]), 1e-6);
    });
    await t.test('pairs where a gap faces a base', {
      todo: 'tn93.js weighs an N (so a GapMM gap) 1/3 per base, not 1/4, and B 1/2, not 1/3: ' +
        'e.g. ref vs gapped: app 0.1330724, tn93 -a gapmm 0.1084786'
    }, () => {
      const k = exp.pairs.map((p, i) => i).filter(i => gapFacesBase[i]);
      checkMetric('tn93', k.map(i => got[i]), k.map(i => want[i]), k.map(i => exp.pairs[i]), 1e-6);
    });
  });
}

// HIV-TRACE -g: hivtrace runs tn93 -a resolve -g FRACTION, which decides pair by
// pair whether to average. MicrobeTrace decides sequence by sequence: a pair is
// averaged when either sequence's share of non-ACGT characters (gaps included)
// reaches the fraction.
test('hivtrace-g.fasta, HIVTRACE-G: MT.computeLinks against tn93 -a resolve -g 0.015', async t => {
  const exp = expected('hivtrace-g.expected.json');
  const g = exp.modes['hivtrace-g'];
  const { MT, ids } = await pipeline('hivtrace-g', 'HIVTRACE-G', { 'distance-metrics-also': [], 'ambiguity-threshold': g.fraction });
  const { tri } = MT.getCondensedDM('tn93', ids);
  const differ = ['h0-h4', 'h1-h2'];
  const k = exp.pairs.map((p, i) => i);
  const same = k.filter(i => !differ.includes(exp.pairs[i].join('-')));
  const other = k.filter(i => differ.includes(exp.pairs[i].join('-')));
  await t.test('pairs where averaging by sequence and by pair agree', () =>
    checkMetric('tn93', same.map(i => tri[i]), same.map(i => g.tn93[i]), same.map(i => exp.pairs[i]), 1e-6));
  await t.test('pairs where they disagree', {
    todo: 'h1-h2 (one resolvable code each, 2 of 100 sites): tn93 averages (0.0205196), app resolves (0.0102056); ' +
      'h0-h4 (h4: one code, 20 gaps): tn93 resolves (0), app averages (0.0063275)'
  }, () => checkMetric('tn93', other.map(i => tri[i]), other.map(i => g.tn93[i]), other.map(i => exp.pairs[i]), 1e-6));
});

test('the FASTA parser reads N as a gap (a MicrobeTrace convention; tn93 reads it as A/C/G/T)', async () => {
  const seqs = await parseFasta('distances.fasta');
  assert.strictEqual(seqs.length, 8);
  assert.ok(seqs.every(s => s.seq.length == 40));
  const out = await runWorker('workers/parse-fasta.js', '>n\nACGNN\nNT\n');
  assert.deepStrictEqual(JSON.parse(new TextDecoder().decode(out.nodes)), [{ id: 'n', seq: 'ACG---T' }]);
});
