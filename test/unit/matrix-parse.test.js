// Tests for the distance-matrix parser (#221) and distance values (#220):
// workers/parse-csv-matrix.js run in Node as the browser runs it. Run with: npm test
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Papa = require('papaparse');
const MTGraph = require('../../src/graph.js').MTGraph;

const source = fs.readFileSync(path.join(__dirname, '../../workers/parse-csv-matrix.js'), 'utf8');

// Runs the worker on text; chunkSize makes Papa Parse split the text, as it does a large file
function parse(text, chunkSize) {
  let out;
  const ctx = {
    importScripts() {}, console, TextEncoder, JSON, Date, Number,
    Papa: chunkSize ? { parse: (t, config) => Papa.parse(t, Object.assign({ chunkSize }, config)) } : Papa,
    postMessage: msg => { out = msg.error !== undefined ? msg : JSON.parse(JSON.stringify(msg.data)); }, // into this realm
    close() {}
  };
  vm.createContext(ctx);
  vm.runInContext(source, ctx, { filename: path.join(__dirname, '../../workers/parse-csv-matrix.js') });  // a filename, so coverage counts it
  ctx.onmessage({ data: text });
  return out;
}

// Pair -> distance, ignoring direction
const pairs = parsed => {
  const m = new Map();
  parsed.links.forEach(l => m.set([l.source, l.target].sort().join('|'), l.distance));
  return m;
};
const asObject = parsed => Object.fromEntries(pairs(parsed));

const FULL = { 'A|B': 1, 'A|C': 5, 'B|C': 2 };

test('a square matrix', () => {
  const p = parse(',A,B,C\nA,0,1,5\nB,1,0,2\nC,5,2,0\n');
  assert.deepStrictEqual(p.nodes, ['A', 'B', 'C']);
  assert.deepStrictEqual(asObject(p), FULL);
});

test('an upper triangle, with and without the header row and diagonal', () => {
  assert.deepStrictEqual(asObject(parse(',A,B,C\nA,0,1,5\nB,,0,2\nC,,,0\n')), FULL);
  assert.deepStrictEqual(asObject(parse(',A,B,C\nA,,1,5\nB,,,2\nC,,,\n')), FULL);
  const p = parse('A,0,1,5\nB,,0,2\nC,,,0\n');
  assert.deepStrictEqual(p.nodes, ['A', 'B', 'C']);
  assert.deepStrictEqual(asObject(p), FULL);
});

test('a lower triangle, with and without the header row and diagonal', () => {
  assert.deepStrictEqual(asObject(parse(',A,B,C\nA,0\nB,1,0\nC,5,2,0\n')), FULL);
  assert.deepStrictEqual(asObject(parse(',A,B,C\nA\nB,1\nC,5,2\n')), FULL);
  const p = parse('A\nB,1\nC,5,2\n');
  assert.deepStrictEqual(p.nodes, ['A', 'B', 'C']);
  assert.deepStrictEqual(asObject(p), FULL);
});

test('empty cells are skipped, and never overwrite a real value', () => {
  // The lower half is empty, as in an upper triangle written as a square
  const p = parse(',A,B,C\nA,0,1,5\nB,,0,2\nC,,,0\n');
  assert.strictEqual(p.links.length, 3);
  assert.ok(p.links.every(l => typeof l.distance == 'number' && !Number.isNaN(l.distance)));
  // Loaded into the graph, as the app does, each pair keeps its value
  const g = new MTGraph();
  p.links.forEach(l => g.addLink(MTGraph.distanceLink(l, 'tn93')));
  assert.strictEqual(g.getValue(g.edgeBetween(g.index.get('A'), g.index.get('B')), 'tn93'), 1);
  assert.strictEqual(p.unparseable, 0);
});

test('cells that are not numbers are counted, not turned into NaN', () => {
  const p = parse(',A,B,C\nA,0,NA,5\nB,NA,0,<0.1\nC,5,<0.1,0\n');
  assert.deepStrictEqual(asObject(p), { 'A|C': 5 });
  assert.strictEqual(p.unparseable, 4);
  assert.strictEqual(p.example, 'NA');
  assert.ok(p.links.every(l => l.distance === l.distance));
});

test('a quoted decimal comma is read; ambiguous commas are not guessed', () => {
  const p = parse(',A,B,C\nA,0,"0,015","1,234"\nB,"0,015",0,2\nC,"1,234",2,0\n');
  assert.strictEqual(asObject(p)['A|B'], 0.015);
  assert.strictEqual('A|C' in asObject(p), false);
  assert.strictEqual(p.unparseable, 2);
  assert.strictEqual(MTGraph.parseDistance('0,015'), 0.015);
  assert.strictEqual(MTGraph.parseDistance(' 0.5 '), 0.5);
  assert.strictEqual(MTGraph.parseDistance(''), null);
  assert.strictEqual(MTGraph.parseDistance(undefined), null);
  assert.ok(Number.isNaN(MTGraph.parseDistance('NA')));
  assert.ok(Number.isNaN(MTGraph.parseDistance('0.1abc')));
  assert.ok(Number.isNaN(MTGraph.parseDistance('1,234')));
  assert.strictEqual(MTGraph.parseDistance(0), 0);
});

test('quoted IDs with commas, and untrimmed IDs', () => {
  const p = parse(' ,"Smith, J", B ,"C"\n"Smith, J",0,1,5\n B ,1,0,2\n"C" ,5,2,0\n');
  assert.deepStrictEqual(p.nodes, ['Smith, J', 'B', 'C']);
  assert.deepStrictEqual(asObject(p), { 'B|Smith, J': 1, 'C|Smith, J': 5, 'B|C': 2 });
});

test('an empty first line, blank lines and Windows line endings are tolerated', () => {
  const p = parse('\r\n,A,B\r\nA,0,1\r\n\r\nB,1,0\r\n');
  assert.deepStrictEqual(p.nodes, ['A', 'B']);
  assert.deepStrictEqual(asObject(p), { 'A|B': 1 });
});

test('a matrix large enough to be chunked is read as it is unchunked', () => {
  const n = 60, ids = Array.from({ length: n }, (_, i) => 'seq' + i);
  const d = (i, j) => Math.abs(i - j) / 100;
  const square = [',' + ids.join(',')].concat(ids.map((id, i) => id + ',' + ids.map((_, j) => d(i, j)).join(','))).join('\n');
  const upper = [',' + ids.join(',')].concat(ids.map((id, i) => id + ',' + ids.map((_, j) => j >= i ? d(i, j) : '').join(','))).join('\n');
  const noHeader = ids.map((id, i) => id + ',' + ids.slice(0, i + 1).map((_, j) => d(i, j)).join(',')).join('\n');
  for (const [name, text] of [['square', square], ['upper', upper], ['lower without header', noHeader]]) {
    const whole = parse(text);
    const chunked = parse(text, 700);
    assert.ok(text.length > 700 * 10, 'the text spans many chunks');
    assert.strictEqual(whole.nodes.length, n, name);
    assert.deepStrictEqual(chunked.nodes, whole.nodes, name);
    assert.deepStrictEqual(asObject(chunked), asObject(whole), name);
    assert.strictEqual(pairs(chunked).size, n * (n - 1) / 2, name);
    assert.strictEqual(pairs(chunked).get('seq10|seq3'), 0.07, name);
    assert.strictEqual(chunked.unparseable, 0, name);
  }
});

test('an empty file fails with a message instead of throwing', () => {
  assert.strictEqual(parse('').error, 'it has no rows');
  assert.strictEqual(parse('\n\n  \n').error, 'it has no rows');
  assert.ok(parse(',,\n,,\n').error);
});

// Duplicate IDs and cut-off files (#172). Each ID should name one node, once in the header
// and once per row, and a file cut off before a node's row is missing a row.
// The app keeps one node per ID, so a repeat would overwrite the other's distances.
test('a repeated ID in the header is refused, naming it', () => {
  assert.match(parse(',A,A,B\nA,0,1,5\nB,5,2,0\n').error, /"A".*more than once/);
});
test('a repeated row ID is refused, naming it', () => {
  assert.match(parse('A,0\nB,1,0\nB,5,2,0\n').error, /more than one row for "B"/);
});
test('a file cut off before a node\'s row is refused, naming the node', () => {
  assert.match(parse(',A,B,C\nA,0,1,5\nB,1,0,2\n').error, /no row for "C"/);
  assert.match(parse(',A,B,C\n').error, /no row for "A"/);
});
// A cut inside the last row keeps the cells it has. Here the lower half repeats the upper, so
// nothing is lost. In an upper triangle the cut would lose pairs, and nothing in the text shows it.
test('a file cut inside its last row keeps the cells it has, with no error', () => {
  const p = parse(',A,B,C\nA,0,1,5\nB,1,0,2\nC,5');
  assert.strictEqual(p.error, undefined);
  assert.deepStrictEqual(p.nodes, ['A', 'B', 'C']);
  assert.deepStrictEqual(asObject(p), FULL);
});
