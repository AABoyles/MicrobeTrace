// FASTA / MEGA parser edge cases (#222, #223), directly and through the worker.
const test = require('node:test');
const assert = require('node:assert');
const { parseFasta } = require('../../workers/parse-fasta.js');
const { parseMega } = require('../../workers/parse-mega.js');
const { runWorker } = require('../golden/harness.js');

const A = [{ id: 'a', seq: 'ACGT' }];

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

test('MEGA: leading blank/comment/BOM, CRLF, multi-record, empty', () => {
  assert.deepStrictEqual(parseMega('﻿\r\n;c\r\n#a\r\nac\r\ngt\r\n#b\r\nTT\r\n'), [{ id: 'a', seq: '#ACGT' }, { id: 'b', seq: '#TT' }]);
  assert.deepStrictEqual(parseMega(''), []);
});
