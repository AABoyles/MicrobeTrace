// Unit tests for src/aligner.js. Run with: npm test
const test = require('node:test');
const assert = require('node:assert');
const MTAlignerScoring = require('../../src/aligner.js');
const bioseq = require('../../vendor/bioseq.min.js');

const defaults = { match: 1, mismatch: 1, gapOpen: 5, gapExtend: 2 };

// As workers/align-sw.js calls it: a global alignment of the query against the reference
function align(reference, query, costs) {
  const { match, gap } = MTAlignerScoring(costs);
  const result = bioseq.align(reference, query, false, match, gap);
  return { score: result.score, cigar: bioseq.cigar2str(result.CIGAR) };
}

test('costs become a positive match score and negative penalties', () => {
  assert.deepStrictEqual(MTAlignerScoring(defaults), { match: [1, -1], gap: [-5, -2] });
});

test('a cost entered as a negative number is read as its magnitude', () => {
  assert.deepStrictEqual(
    MTAlignerScoring({ match: -2, mismatch: -3, gapOpen: -4, gapExtend: -1 }),
    { match: [2, -3], gap: [-4, -1] }
  );
});

test('a mismatch costs the mismatch score', () => {
  assert.deepStrictEqual(align('ACGTACGT', 'ACGTACGT', defaults), { score: 8, cigar: '8M' });
  assert.deepStrictEqual(align('ACGTACGT', 'ACGAACGT', defaults), { score: 6, cigar: '8M' });
  assert.deepStrictEqual(align('ACGTACGT', 'ACGAACGT', { ...defaults, mismatch: 3 }), { score: 4, cigar: '8M' });
});

test('a gap costs the opening plus the extension per base', () => {
  // A two-base deletion in the query: 14 matches, less 5 + 2 * 2
  assert.deepStrictEqual(align('ACGTACGTTTGACCAG', 'ACGTACGTGACCAG', defaults), { score: 5, cigar: '8M,2D,6M' });
  assert.deepStrictEqual(align('ACGTACGTTTGACCAG', 'ACGTACGTGACCAG', { ...defaults, gapOpen: 7 }), { score: 3, cigar: '8M,2D,6M' });
});
