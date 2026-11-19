// FASTA / MEGA parser edge cases (#222, #223), directly and through the worker.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { parseFasta } = require('../../workers/parse-fasta.js');
const { parseMega } = require('../../workers/parse-mega.js');
const { runWorker } = require('../golden/harness.js');

const A = [{ id: 'a', seq: 'ACGT' }];
const BAD = fs.readFileSync(path.join(__dirname, 'badSequences.fasta'), 'utf8');

test('normal multi-record file, N is kept as an ambiguity code, headers trimmed', () => {
  assert.deepStrictEqual(parseFasta('>a \nacgn\nT\n>b\nGG\n'), [{ id: 'a', seq: 'ACGNT' }, { id: 'b', seq: 'GG' }]);
});
// N is an ambiguity code, not a gap: a FASTA sequence must be the same string a
// node-list CSV sequence would be, so both are treated the same (#232)
test('N stays N, so FASTA and node-list CSV sequences are the same string', () => {
  assert.deepStrictEqual(parseFasta('>a\nNNAC\n>b\nnn-t\n'), [{ id: 'a', seq: 'NNAC' }, { id: 'b', seq: 'NN-T' }]);
});
test('worker keeps N (#232)', async () => {
  const out = await runWorker('workers/parse-fasta.js', '>a\nACNGT\n');
  assert.deepStrictEqual(out.nodes, [{ id: 'a', seq: 'ACNGT' }]);
});
test('leading blank line', () => assert.deepStrictEqual(parseFasta('\n\n>a\nACGT\n'), A));
test('leading comment', () => assert.deepStrictEqual(parseFasta('; note\n>a\nACGT\n'), A));
test('comment between records', () => assert.deepStrictEqual(parseFasta('>a\nAC\n;x\nGT\n'), A));
test('BOM', () => assert.deepStrictEqual(parseFasta('﻿>a\nACGT\n'), A));
test('CRLF', () => assert.deepStrictEqual(parseFasta('>a\r\nAC\r\nGT\r\n'), A));
test('no header at all yields no records', () => assert.deepStrictEqual(parseFasta('ACGT\n'), []));
test('empty / blank input yields no records', () => {
  assert.deepStrictEqual(parseFasta(''), []);
  assert.deepStrictEqual(parseFasta('\n\n'), []);
});

test('worker answers an empty file with an empty result (#222)', async () => {
  const out = await runWorker('workers/parse-fasta.js', '');
  assert.deepStrictEqual(out.nodes, []);
  const m = await runWorker('workers/parse-mega.js', '');
  assert.deepStrictEqual(m.nodes, []);
});
test('worker parses a file with a BOM and leading comment', async () => {
  const out = await runWorker('workers/parse-fasta.js', '﻿; c\r\n\r\n>a\r\nACGT\r\n');
  assert.deepStrictEqual(out.nodes, A);
});

// test/unit/badSequences.fasta (#172): records that are wrong in the ways real files are. The
// parser keeps every one, as written, and leaves judging them to the app.
test('badSequences.fasta: every record comes back, with its sequence as written', async () => {
  const ids = ['ThisIsValid', 'ThisIsEmpty', 'ThisIsGaps', 'ThisIsRNA', 'ThisIsAminoAcids', 'ThisIsCIGAR', 'ThisIsMalformed'];
  const seqs = parseFasta(BAD);
  assert.deepStrictEqual(seqs.map(s => s.id), ids);
  assert.strictEqual(seqs[1].seq, '', 'a header with no sequence');
  assert.match(seqs[2].seq, /^-+$/, 'gaps are not removed');
  assert.ok(seqs[3].seq.includes('U') && !seqs[3].seq.includes('T'), 'RNA is not converted to DNA');
  assert.strictEqual(seqs[6].seq, 'ASDLFKJL;K\tQEMN', 'a line that is not a header is kept whole, tab and ; included');
  // The worker gives the same records
  const out = await runWorker('workers/parse-fasta.js', BAD);
  assert.deepStrictEqual(out.nodes, seqs);
});

// The same ID on two records. The parser keeps both, in order, as the file has them. The app
// then merges them into one node and reports the repeat (files.js), as it always has.
test('a duplicate ID gives both records, in file order', () => {
  assert.deepStrictEqual(parseFasta('>a\nAC\n>b\nGG\n>a\nTT\n'), [{ id: 'a', seq: 'AC' }, { id: 'b', seq: 'GG' }, { id: 'a', seq: 'TT' }]);
});

// A FASTA file has no end marker, so one cut off mid-sequence keeps what it has: the last record is short.
// Nothing in the text shows that it was cut, so the parser cannot report it.
test('a file cut mid-sequence keeps its records, the last one short, with no error', async () => {
  assert.deepStrictEqual(parseFasta('>a\nACGT\n>b\nAC'), [{ id: 'a', seq: 'ACGT' }, { id: 'b', seq: 'AC' }]);
  const out = await runWorker('workers/parse-fasta.js', '>a\nACGT\n>b\nAC');
  assert.deepStrictEqual(out.nodes, [{ id: 'a', seq: 'ACGT' }, { id: 'b', seq: 'AC' }]);
});
test('a file cut mid-header keeps the record, with no sequence', () => {
  assert.deepStrictEqual(parseFasta('>a\nACGT\n>b'), [{ id: 'a', seq: 'ACGT' }, { id: 'b', seq: '' }]);
});

test('MEGA: leading blank/comment/BOM, CRLF, multi-record, empty', () => {
  assert.deepStrictEqual(parseMega('﻿\r\n;c\r\n#a\r\nac\r\ngt\r\n#b\r\nTT\r\n'), [{ id: 'a', seq: '#ACGT' }, { id: 'b', seq: '#TT' }]);
  assert.deepStrictEqual(parseMega(''), []);
});
