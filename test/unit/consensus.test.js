// The consensus sequence and the differences from it (#232): a gap where the
// consensus is also a gap is not a difference, counts don't wrap at 65,535,
// ties go to a fixed character, and N is an ordinary character.
const test = require('node:test');
const assert = require('node:assert');
const { consensusOf } = require('../../workers/compute-consensus.js');
const { consensusDistances } = require('../../workers/compute-consensus-distances.js');
const { runWorker } = require('../golden/harness.js');

const seqs = list => list.map(seq => ({ seq }));

test('consensus takes the most common character at each site', () => {
  assert.strictEqual(consensusOf(seqs(['ACGT', 'ACGA', 'ACTT'])), 'ACGT');
});

test('a tie goes to the first character in the fixed order A C G T -, whatever the input order', () => {
  assert.strictEqual(consensusOf(seqs(['C', 'A'])), 'A');
  assert.strictEqual(consensusOf(seqs(['A', 'C'])), 'A');
  assert.strictEqual(consensusOf(seqs(['T', 'G'])), 'G');
  assert.strictEqual(consensusOf(seqs(['G', 'T'])), 'G');
  assert.strictEqual(consensusOf(seqs(['-', 'A'])), 'A');
});

test('N and other ambiguity codes are counted like any character (no NaN)', () => {
  assert.strictEqual(consensusOf(seqs(['AN', 'AN', 'AC'])), 'AN');
  assert.strictEqual(consensusOf(seqs(['AR', 'AC'])), 'AC');
});

test('an empty set has an empty consensus', () => {
  assert.strictEqual(consensusOf([]), '');
});

test('a gap where the consensus is also a gap is not a difference', () => {
  assert.deepStrictEqual(Array.from(consensusDistances('AC-T', seqs(['AC-T']))), [0]);
  // A gap facing a base is a difference, in either direction
  assert.deepStrictEqual(Array.from(consensusDistances('AC-T', seqs(['ACGT']))), [1]);
  assert.deepStrictEqual(Array.from(consensusDistances('ACGT', seqs(['AC-T']))), [1]);
});

test('a length difference counts, and each differing site counts once', () => {
  // Two missing sites at the end, plus G against the consensus gap
  assert.deepStrictEqual(Array.from(consensusDistances('AC-T', seqs(['AC']))), [2]);
  assert.deepStrictEqual(Array.from(consensusDistances('AC-T', seqs(['ACGTA']))), [2]);
});

test('sequences are compared in upper case, as the consensus is', () => {
  assert.deepStrictEqual(Array.from(consensusDistances('AC-T', seqs(['ac-t']))), [0]);
});

test('counts above 65,535 do not wrap (Uint32)', async () => {
  const n = 70000;
  const out = await runWorker('workers/compute-consensus-distances.js', {
    consensus: 'A'.repeat(n), subset: seqs(['C'.repeat(n)]), start: 0
  });
  assert.strictEqual(new Uint32Array(out.dists)[0], n);
});
