// Unit tests for what the format modules in src/formats parse (#337): the plain data they
// give for FASTA, link lists, node lists and Newick trees, with no session or page.
// Run with: node --test test/unit
import test from 'node:test';
import assert from 'node:assert';
import { createRequire } from 'node:module';
import * as fasta from '../../src/formats/fasta.js';
import * as links from '../../src/formats/links.js';
import * as nodes from '../../src/formats/nodes.js';
import * as newick from '../../src/formats/newick.js';
import * as matrix from '../../src/formats/matrix.js';
import { detectFormat } from '../../src/formats/index.js';
import { cleanID, claimId } from '../../src/formats/shared.js';

const require = createRequire(import.meta.url);
globalThis.Papa = require('papaparse');
globalThis.patristic = require('patristic');
const XLSX = globalThis.XLSX = require('xlsx');
const { parseFasta } = require('../../workers/parse-fasta.js');

const origin = ['file.csv'];

test('claimId trims an ID, counts a blank, and counts a repeat while still returning it', () => {
  assert.strictEqual(cleanID('  a '), 'a');
  assert.strictEqual(cleanID(null), '');
  assert.strictEqual(cleanID(7), '7');
  const tally = { blanks: 0, duplicates: 0 }, seen = new Set();
  assert.strictEqual(claimId(' a', seen, tally), 'a');
  assert.strictEqual(claimId('a ', seen, tally), 'a');
  assert.strictEqual(claimId('', seen, tally), null);
  assert.strictEqual(claimId(undefined, seen, tally), null);
  assert.deepStrictEqual(tally, { blanks: 2, duplicates: 1 });
});

test('FASTA gives a node for each sequence, and says when there are none', () => {
  const sequences = parseFasta('>a\nAC\nGT\n>b\nTTTT\n');
  const result = fasta.parse('', { sequences, origin });
  assert.deepStrictEqual(result.nodes, [{ _id: 'a', seq: 'ACGT', origin }, { _id: 'b', seq: 'TTTT', origin }]);
  assert.strictEqual(result.total, 2);
  assert.deepStrictEqual([...result.ids], ['a', 'b']);
  assert.strictEqual(result.problem, undefined);
  const none = fasta.parse('', { sequences: parseFasta('no header here'), origin });
  assert.match(none.problem, /holds no sequences/);
  assert.deepStrictEqual(none.nodes, []);
});

test('FASTA counts repeated and blank IDs, keeping the repeats for the caller to merge', () => {
  const result = fasta.parse('', { sequences: parseFasta('>a\nAC\n>a\nGT\n>\nTT\n> b \nCC\n'), origin });
  assert.deepStrictEqual(result.nodes.map(n => n._id), ['a', 'a', 'b']);
  assert.strictEqual(result.duplicates, 1);
  assert.strictEqual(result.blanks, 1);
  assert.strictEqual(result.total, 4);
});

test('a link list gives its links with distances, and its nodes once each', () => {
  const text = 'source,target,distance,note\na,b,0.5,x\nb,c,0.25,y\n';
  const r = links.parse(text, { field1: 'source', field2: 'target', field3: 'distance', metric: 'tn93', origin });
  assert.strictEqual(r.total, 2);
  assert.deepStrictEqual(r.links.map(l => [l.source, l.target, l.tn93, l.note, l.visible]), [['a', 'b', 0.5, 'x', true], ['b', 'c', 0.25, 'y', true]]);
  assert.deepStrictEqual(r.nodes, [{ _id: 'a', origin }, { _id: 'b', origin }, { _id: 'c', origin }]);
  assert.deepStrictEqual(r.fields, ['source', 'target', 'distance', 'note']);
  assert.deepStrictEqual([r.noColumn, r.missing, r.bad, r.blanks], [0, 0, 0, 0]);
  assert.strictEqual(r.links[0].origin, origin);
});

test('a link list with no distance column marks its links unmeasured', () => {
  const r = links.parse('s,t\na,b\nb,c\n', { field1: 's', field2: 't', field3: 'None', metric: 'tn93', origin });
  assert.strictEqual(r.noColumn, 2);
  assert.ok(r.links.every(l => l.unmeasured === true && !('tn93' in l)));
});

test('empty and unreadable distances are counted and left off, not read as 0 or NaN', () => {
  const text = 's,t,d\na,b,\nb,c,far\nc,d,"0,5"\nd,e,1e-3\ne,f,Infinity\n';
  const r = links.parse(text, { field1: 's', field2: 't', field3: 'd', metric: 'd', origin });
  assert.strictEqual(r.missing, 1);
  assert.strictEqual(r.bad, 2);
  assert.strictEqual(r.badExample, 'far');
  assert.deepStrictEqual(r.links.map(l => l.d), [undefined, undefined, 0.5, 0.001, undefined]);
  // A distance column that is not the metric's is copied under the metric
  const other = links.parse('s,t,len\na,b,3\nb,c,\n', { field1: 's', field2: 't', field3: 'len', metric: 'tn93', origin });
  assert.deepStrictEqual(other.links.map(l => l.tn93), [3, undefined]);
  assert.strictEqual(other.links[0].len, 3);
  assert.strictEqual(other.missing, 1);
});

test('links with a blank end are skipped and counted, and IDs are cleaned and kept as text', () => {
  const text = 's,t\n 007 , 1E3 \n,b\na,\nx,y\n';
  const r = links.parse(text, { field1: 's', field2: 't', field3: 'None', metric: 'tn93', origin });
  assert.strictEqual(r.blanks, 2);
  assert.deepStrictEqual(r.links.map(l => [l.source, l.target]), [['007', '1E3'], ['x', 'y']]);
  // The lone endpoints are still nodes, as the load has always made them
  assert.deepStrictEqual(r.nodes.map(n => n._id), ['007', '1E3', 'b', 'a', 'x', 'y']);
  assert.strictEqual(r.total, 4);
});

test('a link list reads tab-separated text, and rows the worker already read', () => {
  const tab = links.parse('s\tt\td\na\tb\t1\n', { field1: 's', field2: 't', field3: 'd', metric: 'd', origin, delimiter: '\t' });
  assert.deepStrictEqual(tab.links.map(l => [l.source, l.target, l.d]), [['a', 'b', 1]]);
  const given = links.parse('', { field1: 's', field2: 't', field3: 'None', metric: 'd', origin, rows: [{ s: 'a', t: 'b', extra: 1 }], fields: ['s', 't', 'extra', 'unused'] });
  assert.deepStrictEqual(given.fields, ['s', 't', 'extra', 'unused']);
  assert.strictEqual(given.links.length, 1);
});

test('a link list that was cut off in a row, or holds no rows, still parses what it has', () => {
  const r = links.parse('s,t,d\na,b,1\nc', { field1: 's', field2: 't', field3: 'd', metric: 'd', origin });
  assert.deepStrictEqual(r.links.map(l => [l.source, l.target]), [['a', 'b']]);
  assert.strictEqual(r.blanks, 1);
  assert.strictEqual(links.parse('', { field1: 's', field2: 't', field3: 'None', metric: 'd', origin }).links.length, 0);
});

test('a node list gives a node per row with its other columns, and keeps IDs and sequences as text', () => {
  const text = 'id,seq,date,n\n007,ACGT,2020-01-02,5\n1E3,,2021,6\n';
  const r = nodes.parse(text, { field1: 'id', field2: 'seq', origin });
  assert.deepStrictEqual(r.nodes, [
    { _id: '007', seq: 'ACGT', origin, date: '2020-01-02', n: 5 },
    { _id: '1E3', seq: '', origin, date: 2021, n: 6 },
  ]);
  assert.deepStrictEqual(r.fields, ['date', 'n']);
  assert.strictEqual(r.total, 2);
  assert.deepStrictEqual([r.blanks, r.duplicates], [0, 0]);
});

test('a node list with no sequence column gives empty sequences', () => {
  const r = nodes.parse('id,group\na,x\n', { field1: 'id', field2: 'None', origin });
  assert.deepStrictEqual(r.nodes, [{ _id: 'a', seq: '', origin, group: 'x' }]);
  assert.deepStrictEqual(r.fields, ['id', 'group'].filter(f => f != 'id'));
});

test('a node list counts repeated and blank IDs, and a blank row adds no fields', () => {
  const text = 'id,a,b\nx,1,2\nx,3,4\n,5,6\n y ,7,8\n';
  const r = nodes.parse(text, { field1: 'id', field2: 'None', origin });
  assert.deepStrictEqual(r.nodes.map(n => n._id), ['x', 'x', 'y']);
  assert.strictEqual(r.duplicates, 1);
  assert.strictEqual(r.blanks, 1);
  assert.strictEqual(r.total, 4);
  assert.deepStrictEqual([...r.ids], ['x', 'y']);
  const onlyBlank = nodes.parse('id,a\nx,1\n,2\n', { field1: 'id', field2: 'None', origin });
  assert.deepStrictEqual(onlyBlank.fields, ['a']);
  const late = nodes.parse('id,a,b\n,1,2\nx,3,\n', { field1: 'id', field2: 'None', origin });
  assert.deepStrictEqual(late.fields, ['a', 'b']);
});

test('a node list reads its delimiter, and a file cut off mid-row', () => {
  const tab = nodes.parse('id\tseq\na\tACGT\nb\tAC', { field1: 'id', field2: 'seq', origin, delimiter: '\t' });
  assert.deepStrictEqual(tab.nodes.map(n => [n._id, n.seq]), [['a', 'ACGT'], ['b', 'AC']]);
  const cut = nodes.parse('id,seq,date\na,ACGT,2020\nb', { field1: 'id', field2: 'seq', origin });
  assert.deepStrictEqual(cut.nodes.map(n => n._id), ['a', 'b']);
  assert.strictEqual(nodes.parse('', { field1: 'id', field2: 'None', origin }).total, 0);
});

test('a Newick tree gives its leaves as nodes and every pair as a link, each node before its links', () => {
  const r = newick.parse('((A:1,B:2):3,C:4);', { origin, metric: 'tn93' });
  assert.deepStrictEqual(r.labels.slice().sort(), ['A', 'B', 'C']);
  assert.strictEqual(r.nodes.length, 3);
  assert.strictEqual(r.links.length, 3);
  assert.ok(r.nodes.every(n => n.origin === origin));
  const distance = (a, b) => r.links.find(l => (l.source == a && l.target == b) || (l.source == b && l.target == a)).tn93;
  assert.strictEqual(distance('A', 'B'), 3);
  assert.strictEqual(distance('A', 'C'), 8);
  assert.strictEqual(distance('B', 'C'), 9);
  // The links of node i are those between it and the nodes before it
  r.nodes.forEach((node, i) => {
    const mine = r.links.slice(i * (i - 1) / 2, i * (i + 1) / 2);
    assert.strictEqual(mine.length, i);
    mine.forEach(l => assert.strictEqual(l.source, node._id));
  });
  assert.ok(r.tree);
});

// A workbook's bytes, as a file read for a spreadsheet gives them
const workbook = (rows, sheets = 1) => {
  const book = XLSX.utils.book_new();
  for (let i = 0; i < sheets; i++) XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), 'Sheet' + (i + 1));
  const bytes = XLSX.write(book, { type: 'array', bookType: 'xlsx' });
  return bytes instanceof ArrayBuffer ? bytes : new Uint8Array(bytes).buffer;
};

test('a distance matrix is detected here and read elsewhere; its sheets become CSV text', () => {
  assert.strictEqual(matrix.parse, undefined);
  assert.strictEqual(matrix.label, 'a distance matrix');
  assert.strictEqual(matrix.matchName('csv', 'matrix.csv'), false);
  const bytes = workbook([['', 'a', 'b'], ['a', 0, 1], ['b', 1, 0]]);
  assert.strictEqual(matrix.toText(bytes).trim().split(/\r?\n/)[1], 'a,0,1');
  assert.strictEqual(detectFormat(bytes, 'm.xlsx').kind, 'matrix');
  const three = workbook([['', 'a', 'b', 'c'], ['a', 0, 1, 2], ['b', 1, 0, 3], ['c', 2, 3, 0]]);
  assert.strictEqual(detectFormat(three, 'm.xlsx').kind, 'matrix');
  assert.strictEqual(detectFormat(workbook([['id', 'x'], ['a', 1]]), 'n.xls').kind, 'node');
});

test('link and node lists read the first sheet of a spreadsheet', () => {
  const bytes = workbook([['s', 't', 'd'], ['a', 'b', 1], ['b', 'c', 2]], 2);
  const l = links.parse(bytes, { field1: 's', field2: 't', field3: 'd', metric: 'd', origin, sheet: true });
  assert.deepStrictEqual(l.links.map(x => [x.source, x.target, x.d]), [['a', 'b', 1], ['b', 'c', 2]]);
  assert.strictEqual(l.nodes.length, 3);
  const n = nodes.parse(workbook([['id', 'seq', 'g'], ['a', 'AC', 'x'], ['', 'GT', 'y']]), { field1: 'id', field2: 'seq', origin, sheet: true });
  assert.deepStrictEqual(n.nodes, [{ _id: 'a', seq: 'AC', origin, g: 'x' }]);
  assert.strictEqual(n.blanks, 1);
});
