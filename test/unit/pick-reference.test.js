// The provisional reference (#317): the medoid of unaligned sequences by
// k-mer distance, chosen deterministically and without alignment.
const test = require('node:test');
const assert = require('node:assert');
const { pickReference } = require('../../workers/pick-reference.js');

// A small seeded PRNG (mulberry32), so the tests are repeatable
function rng(seed){
  return () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const randomSeq = (rand, n) => { let s = ''; for (let i = 0; i < n; i++) s += 'ACGT'[Math.floor(rand() * 4)]; return s; };
const mutate = (rand, s, rate) => [...s].map(c => rand() < rate ? 'ACGT'[Math.floor(rand() * 4)] : c).join('');

// n point-mutated copies of one seed, and the outliers' positions in the result
function family(rand, n, len = 400){
  const seed = randomSeq(rand, len);
  return Array.from({ length: n }, () => mutate(rand, seed, 0.02));
}

test('an empty input has no reference', () => {
  assert.strictEqual(pickReference([]), -1);
  assert.strictEqual(pickReference(['', '--', ' ']), -1);
});

test('with one or two sequences, the longest wins, the lowest index on a tie', () => {
  assert.strictEqual(pickReference(['ACGTACGTAC']), 0);
  assert.strictEqual(pickReference(['ACGT', 'ACGTACGT']), 1);
  assert.strictEqual(pickReference(['ACGTACGT', 'ACGT']), 0);
  assert.strictEqual(pickReference(['ACGT', 'TTTT']), 0);
  assert.strictEqual(pickReference(['', 'AC', '']), 1);
});

test('it never picks an unrelated outlier', () => {
  const rand = rng(1);
  const seqs = family(rand, 10);
  seqs.splice(3, 0, randomSeq(rand, 400));
  seqs.push(randomSeq(rand, 400));
  const outliers = [3, seqs.length - 1];
  const picked = pickReference(seqs);
  assert.ok(picked >= 0 && !outliers.includes(picked));
});

test('sequences that differ only by their ends still pick an overlapping one', () => {
  const rand = rng(2);
  const genome = randomSeq(rand, 1000);
  const seqs = [0, 20, 40, 60, 80, 100].map(o => genome.slice(o, o + 800));
  seqs.push(randomSeq(rand, 800));
  const picked = pickReference(seqs);
  assert.ok(picked >= 0 && picked < 6);
});

test('shuffling the input returns the same sequence', () => {
  const rand = rng(3);
  const seqs = family(rand, 15);
  seqs.push(randomSeq(rand, 400));
  const expected = seqs[pickReference(seqs)];
  for (let round = 0; round < 5; round++) {
    const shuffled = seqs.slice();
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    assert.strictEqual(shuffled[pickReference(shuffled)], expected);
  }
});

test('with more sequences than the sample, it still returns a valid non-outlier index', () => {
  const rand = rng(4);
  const seqs = family(rand, 60);
  for (let i = 0; i < 3; i++) seqs.push(randomSeq(rand, 400));
  const first = pickReference(seqs, { sample: 20 });
  assert.ok(first >= 0 && first < 60);
  assert.strictEqual(pickReference(seqs, { sample: 20 }), first);
});

test('gaps, case and U are normalised', () => {
  const plain = ['ACGTACGTAC', 'ACGTACGTAA', 'ACGTACGTAG', 'TTGACCATGC'];
  const messy = ['acgu-acgu-ac', 'ACGT ACGT AA', 'acgtacgtag', 'ttgacc--atgc'];
  assert.strictEqual(pickReference(messy, { k: 4 }), pickReference(plain, { k: 4 }));
  assert.strictEqual(pickReference(['acgu-acgu', 'ACGTACGT', 'AC'], { k: 4 }), 0);
});

test('k-mers with ambiguity codes are skipped rather than breaking things', () => {
  const rand = rng(5);
  const seqs = family(rand, 8).map((s, i) => i % 2 ? s.slice(0, 50) + 'NNRY' + s.slice(54) : s);
  assert.ok(pickReference(seqs) >= 0);
});

test('sequences shorter than k are only picked when every sequence is', () => {
  assert.strictEqual(pickReference(['ACG', 'ACGTA', 'AC'], { k: 8 }), 1);
  assert.strictEqual(pickReference(['AC', 'ACG', 'ACG'], { k: 8 }), 1);
  const rand = rng(6);
  const seqs = family(rand, 5);
  seqs.unshift('ACG');
  assert.notStrictEqual(pickReference(seqs), 0);
});
