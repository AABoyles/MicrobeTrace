// Sequence lengths (#215): MT.align cuts sequences that run past the reference
// and pads shorter ones, and the app reports how many, and warns when
// alignment is off and lengths differ. Run with: npm test
const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('../golden/harness.js');

test('fitToReference counts the sequences it cut and padded', () => {
  const { MT } = loadApp();
  const nodes = [
    { _seq: 'ACGTACGTAC', _padding: 0 },    // exact
    { _seq: 'ACGTACGTACGGG', _padding: 0 }, // cut
    { _seq: 'ACGT', _padding: 0 },          // padded
    { _seq: '', _padding: 0 },              // no sequence
    { _seq: 'ACGTACGT', _padding: 2 }       // leading gaps bring it to the reference length
  ];
  const fit = MT.fitToReference(nodes, 10, 0);
  assert.deepStrictEqual({ ...fit }, { empty: 1, truncated: 1, padded: 1, referenceLength: 10 });
  assert.ok(nodes.every(d => d._seq.length === 10));
  assert.strictEqual(nodes[1]._seq, 'ACGTACGTAC');
  assert.strictEqual(nodes[2]._seq, 'ACGT------');
  assert.strictEqual(nodes[3]._seq, '----------');
});

test('MT.align reports the sequences it truncated', async () => {
  const { MT } = loadApp();
  const reference = 'ACGTTGCAAGCTTGCAGGCATCCGATTACG';
  const nodes = [
    { id: 'same', seq: reference },
    { id: 'long', seq: reference + 'TTTTTTTTTTTTTTTTTTTT' },
    { id: 'short', seq: reference.slice(0, 20) }
  ];
  const out = await MT.align({ nodes, reference, aligner: 'sw', match: [1, -1], gap: [-5, -2] });
  assert.strictEqual(out.fit.truncated, 1); // the 20 extra bases the aligner dropped
  assert.strictEqual(out.fit.padded, 1);
  assert.ok(out.every(d => d._seq.length === reference.length));
  assert.ok(MT.lengthWarnings(out.fit).length >= 1);
});

test('lengthWarnings reports cut and padded counts', () => {
  const { MT } = loadApp();
  const w = MT.lengthWarnings({ truncated: 2, padded: 1 });
  assert.strictEqual(w.length, 2);
  assert.match(w[0], /2 sequences extended past the end/);
  assert.match(w[1], /1 sequence did not reach the end/);
  assert.strictEqual(MT.lengthWarnings({ truncated: 0, padded: 0 }).length, 0);
});

test('lengthWarnings warns when alignment is off and lengths differ', () => {
  const { MT } = loadApp();
  const w = MT.lengthWarnings(null, [100, 100, 90]);
  assert.strictEqual(w.length, 1);
  assert.match(w[0], /Alignment is off.*90 to 100/);
  assert.strictEqual(MT.lengthWarnings(null, [100, 100]).length, 0);
});

test('sequence-less (all gap) nodes would change the consensus, so they are left out of it', async () => {
  const { MT } = loadApp();
  const have = [{ seq: 'ACGTACGTAC' }, { seq: 'ACGTACGTAA' }, { seq: 'ACGTACGTAC' }];
  const consensus = await MT.computeConsensus(have);
  assert.strictEqual(consensus, 'ACGTACGTAC');
  const gaps = { seq: '----------' };
  const polluted = await MT.computeConsensus(have.concat(gaps, gaps, gaps, gaps));
  assert.notStrictEqual(polluted, consensus);
});
