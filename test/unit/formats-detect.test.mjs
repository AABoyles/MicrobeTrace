// Unit tests for the format registry in src/formats (#337): which format a file's contents
// are, and what its name says when they say nothing. Run with: node --test test/unit
import test from 'node:test';
import assert from 'node:assert';
import { createRequire } from 'node:module';
import { formats, formatByName, detectFormat, guessByName } from '../../src/formats/index.js';

// The bundle's globals, which the format modules look up when they are called
globalThis.Papa = createRequire(import.meta.url)('papaparse');

const kind = (text, name = 'file.csv') => detectFormat(text, name).kind;

test('the registry lists each format once, by name', () => {
  assert.deepStrictEqual(formats.map(f => f.name), ['fasta', 'newick', 'matrix', 'node', 'link']);
  for (const f of formats) {
    assert.strictEqual(formatByName(f.name), f);
    assert.strictEqual(typeof f.label, 'string');
    assert.ok(Array.isArray(f.extensions));
  }
  assert.strictEqual(formatByName('nope'), undefined);
  assert.strictEqual(formatByName('__proto__'), undefined);
  assert.strictEqual(globalThis.MTFormats.detectFormat, detectFormat);
});

test('FASTA is read from its first character, whatever the file is called', () => {
  assert.strictEqual(kind('>a\nACGT\n', 'x.txt'), 'fasta');
  assert.strictEqual(kind('\n  >a\nACGT\n'), 'fasta');
  assert.strictEqual(kind('﻿>a\nACGT\n'), 'fasta');
});

test('a balanced, terminated tree is Newick; an unbalanced or open one is not', () => {
  assert.strictEqual(kind('(A:1,B:2,(C:1,D:1):1);\n', 'x.txt'), 'newick');
  assert.strictEqual(kind('((A,B),C);'), 'newick');
  assert.strictEqual(kind('(A:1,B:2'), undefined);
  assert.strictEqual(kind('(A,B));'), undefined);
  assert.strictEqual(kind('(A,B)'), undefined);
});

test('a square matrix has its header repeat its rows below an empty corner', () => {
  const square = ',a,b,c\na,0,1,2\nb,1,0,3\nc,2,3,0\n';
  assert.strictEqual(kind(square), 'matrix');
  assert.deepStrictEqual(detectFormat(square, 'm.csv'), { kind: 'matrix', delimiter: ',' });
  // Triangular
  assert.strictEqual(kind(',a,b,c\na,0\nb,1,0\nc,2,3,0\n'), 'matrix');
  assert.strictEqual(kind(',a,b,c\na,0,1,2\nb,,0,3\nc,,,0\n'), 'matrix');
  // Labels with quotes and spaces still match
  assert.strictEqual(kind(', "a", b ,c\n a,0,1,2\n"b",1,0,3\nc,2,3,0\n'), 'matrix');
  // Missing a row (cut off): the header names more than the file has
  assert.strictEqual(kind(',a,b,c\na,0,1,2\nb,1,0,3\n'), undefined);
  // Rows in another order than the header
  assert.strictEqual(kind(',a,b,c\nb,0,1,2\na,1,0,3\nc,2,3,0\n'), undefined);
});

test('a matrix may lack its header row when it is a square table of numbers below names', () => {
  assert.strictEqual(kind('x,a,b,c\na,0,1,2\nb,1,0,3\nc,2,3,0\n'), undefined); // text in the header: a link list
  assert.strictEqual(kind('a,0,1,2\nb,1,0,3\nc,2,3,0\n'), 'matrix');
  assert.strictEqual(kind('a,b,c\n0,1,2\n1,0,3\n'), undefined);
});

test('a decimal comma does not stop a table being a matrix, text in its cells does', () => {
  assert.strictEqual(kind(';a;b;c\na;0;0,5;1\nb;0,5;0;2\nc;1;2;0\n'), 'matrix');
  assert.strictEqual(kind(',a,b,c\na,x,y,z\nb,x,y,z\nc,x,y,z\n'), undefined);
});

test('a node list has an ID column and not both Source and Target', () => {
  assert.strictEqual(kind('ID,seq,date\na,ACGT,2020\nb,ACGA,2021\n'), 'node');
  assert.strictEqual(kind('_id,x\na,1\n'), 'node');
  assert.strictEqual(kind(' "Id" ,x\na,1\n'), 'node');
  assert.strictEqual(kind('id,source,target\na,b,c\n'), undefined);
  assert.strictEqual(kind('id,source\na,b\n'), 'node');
  assert.strictEqual(kind('ID,Source,Target\n1,a,b\n'), undefined);
  assert.strictEqual(kind('Source,Target,Distance\na,b,1\n'), undefined);
});

test('a table needs two rows and two columns to be anything but a link list', () => {
  assert.strictEqual(kind('id\na\nb\n'), undefined);
  assert.strictEqual(kind('id,x\n'), undefined);
  assert.strictEqual(kind(''), undefined);
});

test('the delimiter is the one the rows use, and a comma where they say none', () => {
  assert.strictEqual(detectFormat('id\tseq\na\tACGT\nb\tACGA\n', 'n.tsv').delimiter, '\t');
  assert.strictEqual(kind('id\tseq\na\tACGT\nb\tACGA\n'), 'node');
  assert.strictEqual(detectFormat('source;target\na;b\nb;c\n').delimiter, ';');
  assert.strictEqual(detectFormat('source|target\na|b\nb|c\n').delimiter, '|');
  assert.strictEqual(detectFormat('source,target\na,b\n').delimiter, ',');
  assert.strictEqual(detectFormat('just some words\n').delimiter, ',');
  assert.strictEqual(detectFormat('>a\nAC\n').delimiter, ',');
  assert.strictEqual(detectFormat('(A,B);').delimiter, ',');
  assert.strictEqual(detectFormat('').delimiter, ',');
});

test('contents that are not text (a read that failed, a spreadsheet that cannot be read) give a comma and no kind', () => {
  assert.deepStrictEqual(detectFormat(null, 'x.csv'), { delimiter: ',' });
  assert.deepStrictEqual(detectFormat(undefined, 'x.csv'), { delimiter: ',' });
  assert.deepStrictEqual(detectFormat(new ArrayBuffer(4), 'x.csv'), { delimiter: ',' });
  // (No XLSX here: reading a sheet throws, which is how a corrupt workbook behaves)
  assert.deepStrictEqual(detectFormat(new ArrayBuffer(4), 'x.xlsx'), { delimiter: ',' });
});

test('a file with a leading byte-order mark is read from what follows it', () => {
  assert.strictEqual(kind('﻿ID,x\na,1\n'), 'node');
});

test('the name decides only what the contents cannot: fasta, newick, node, else link', () => {
  assert.strictEqual(guessByName('reads.fasta'), 'fasta');
  assert.strictEqual(guessByName('reads.fas'), 'fasta');
  assert.strictEqual(guessByName('tree.nwk'), 'newick');
  assert.strictEqual(guessByName('tree.newick'), 'newick');
  assert.strictEqual(guessByName('my_nodes.csv'), 'node');
  assert.strictEqual(guessByName('NODES.csv'), 'node');
  assert.strictEqual(guessByName('links.csv'), 'link');
  assert.strictEqual(guessByName('data.xlsx'), 'link');
  assert.strictEqual(guessByName('matrix.csv'), 'link');
  // Both: the sequences come first
  assert.strictEqual(guessByName('nodes.fasta'), 'fasta');
  assert.strictEqual(guessByName('nodes.csv', 'nwk'), 'newick');
});
