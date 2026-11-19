// workers/compute-ambiguity-counts.js (#170): the share of each sequence that is
// not A, C, G or T, run as the app runs it (encoded by tn93.toInts, which gives
// 0-3 for ACGT and more for N, the other codes and the gap). Run with: npm test
const test = require('node:test');
const assert = require('node:assert');
const tn93 = require('../../vendor/tn93.min.js');
const { runWorker } = require('../golden/harness.js');

// Each row: a sequence, and the count of non-ACGT characters over its length.
// The expected values are counted by hand from the strings.
const CASES = [
  ['ACGT', 0, 'no ambiguity'],
  ['acgt', 0, 'lower case is the same as upper case'],
  ['ACGTN', 1 / 5, 'one N in five'],
  ['ACGT----', 4 / 8, 'four gaps in eight: a gap counts as ambiguous'],
  ['ACRY', 2 / 4, 'R and Y are ambiguity codes'],
  ['ACGTNNGT--', 4 / 10, 'two N and two gaps in ten'],
  ['NNNN', 1, 'all N'],
  ['RYKMSWBDHVN', 1, 'every IUPAC code, none of them ACGT'],
  ['A', 0, 'one base'],
  ['-', 1, 'one gap'],
];

// Runs the worker on several sequences in one message, and reads its Float32Array back
async function counts(seqs) {
  const out = await runWorker('workers/compute-ambiguity-counts.js', seqs.map(s => ({ _seqInt: tn93.toInts(s) })));
  return Array.from(new Float32Array(out.counts));
}

// Float32Array rounds each value, so the expected value is rounded the same way
const f32 = x => Math.fround(x);

test('each sequence gets the share of its characters that are not A, C, G or T', async () => {
  for (const [seq, expected, why] of CASES) {
    const [got] = await counts([seq]);
    assert.strictEqual(got, f32(expected), `${seq}: ${why}`);
  }
});

test('one message returns one count per sequence, in the order they were sent', async () => {
  const seqs = CASES.map(c => c[0]);
  const got = await counts(seqs);
  assert.strictEqual(got.length, seqs.length);
  got.forEach((g, i) => assert.strictEqual(g, f32(CASES[i][1]), seqs[i]));
});

test('an empty list gets an empty result', async () => {
  assert.deepStrictEqual(await counts([]), []);
});
