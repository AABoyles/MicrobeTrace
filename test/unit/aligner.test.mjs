// Unit tests for src/aligner.js. Run with: npm test
import test from 'node:test';
import assert from 'node:assert';
import { MTAlignerScoring } from '../../src/aligner.js';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The vendored copy is what the worker runs. Since 0.2 it is a browser script that defines a
// global bioseq rather than a UMD module, so run it the way importScripts would.
const bioseqContext = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, '../../vendor/bioseq.min.js'), 'utf8'), bioseqContext);
const bioseq = bioseqContext.bioseq;

const defaults = { match: 1, mismatch: 1, gapOpen: 5, gapExtend: 2 };

// As workers/align-sw.js calls it: a global alignment of the query against the reference
function align(reference, query, costs) {
  const { match, gap, band } = MTAlignerScoring(costs);
  const result = bioseq.align(reference, query, { mode: 'global', matrix: match, gap, band });
  return { score: result.score, cigar: bioseq.cigar2str(result.CIGAR) };
}

test('costs become a positive match score and negative penalties', () => {
  assert.deepStrictEqual(MTAlignerScoring(defaults), { match: [1, -1], gap: [-5, -2], band: null });
});

test('a cost entered as a negative number is read as its magnitude', () => {
  assert.deepStrictEqual(
    MTAlignerScoring({ match: -2, mismatch: -3, gapOpen: -4, gapExtend: -1 }),
    { match: [2, -3], gap: [-4, -1], band: null }
  );
});

test('a mismatch costs the mismatch score', () => {
  assert.deepStrictEqual(align('ACGTACGT', 'ACGTACGT', defaults), { score: 8, cigar: '8M' });
  assert.deepStrictEqual(align('ACGTACGT', 'ACGAACGT', defaults), { score: 6, cigar: '8M' });
  assert.deepStrictEqual(align('ACGTACGT', 'ACGAACGT', { ...defaults, mismatch: 3 }), { score: 4, cigar: '8M' });
});

test('a gap costs the opening plus the extension per base', () => {
  // A two-base deletion in the query: 14 matches, less 5 + 2 * 2
  assert.deepStrictEqual(align('ACGTACGTTTGACCAG', 'ACGTACGTGACCAG', defaults), { score: 5, cigar: '8M2D6M' });
  assert.deepStrictEqual(align('ACGTACGTTTGACCAG', 'ACGTACGTGACCAG', { ...defaults, gapOpen: 7 }), { score: 3, cigar: '8M2D6M' });
});

test('the band is a whole number of bases, or null for none', () => {
  assert.strictEqual(MTAlignerScoring({ ...defaults, band: 0 }).band, 0);
  assert.strictEqual(MTAlignerScoring({ ...defaults, band: 12.7 }).band, 12);
  assert.strictEqual(MTAlignerScoring({ ...defaults, band: -3 }).band, 3);
  // A blank input reads as NaN
  assert.strictEqual(MTAlignerScoring({ ...defaults, band: NaN }).band, null);
});

test('a band too narrow for an indel misplaces it; widening the band places it', () => {
  // The query has a two-base deletion and a two-base insertion, so it is as
  // long as the reference: band 0 allows no shift at all, band 2 allows the indels
  const reference = 'ACGTACGTTTGACCAGTTCAGGCATCGA';
  const query = 'ACGTACGTGACCAGTTCAGGCAAATCGA';
  const unbanded = align(reference, query, defaults);
  assert.deepStrictEqual(unbanded, { score: 8, cigar: '8M2D14M2I4M' });
  assert.deepStrictEqual(align(reference, query, { ...defaults, band: 2 }), unbanded);
  const narrow = align(reference, query, { ...defaults, band: 0 });
  assert.strictEqual(narrow.cigar, '28M');
  assert.ok(narrow.score < unbanded.score);
});
