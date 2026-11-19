// Unit tests for the export helpers in src/export.js (#230): CSV cells that
// look like formulae are escaped, columns are the union of every row's keys,
// and a null image Blob is reported rather than thrown.
// Run with: npm test
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');

const src = fs.readFileSync(path.join(__dirname, '../../src/export.js'), 'utf8');
const start = src.indexOf('MT.toCSV = ');
const end = src.indexOf('// Loads an image, crossOrigin');
assert.ok(start > 0 && end > start);

function load() {
  const MT = { toast: { error: msg => errors.push(msg) }, saveAs: (b, f) => saved.push([b, f]) };
  const errors = [], saved = [];
  new Function('MT', 'Papa', src.slice(start, end))(MT, Papa);
  return { MT, errors, saved };
}

test('toCSV escapes cells that would be read as formulae', () => {
  const { MT } = load();
  const out = Papa.parse(MT.toCSV([{ id: '=HYPERLINK("x")', n: -5, a: '@x', b: '+1' }]), { header: true }).data[0];
  assert.strictEqual(out.id, `'=HYPERLINK("x")`);
  assert.strictEqual(out.a, "'@x");
  assert.strictEqual(out.b, "'+1");
  assert.strictEqual(out.n, '-5');
});

test('toCSV takes columns from every row, in first-seen order', () => {
  const { MT } = load();
  const csv = MT.toCSV([{ a: 1 }, { a: 2, b: 3 }, { c: 4, a: 5 }]);
  assert.strictEqual(csv.split('\r\n')[0], 'a,b,c');
  assert.strictEqual(csv.split('\r\n')[3], '5,,4');
});

test('toCSV leaves arrays of arrays and {fields, data} alone, and honours columns', () => {
  const { MT } = load();
  assert.strictEqual(MT.toCSV([['', 'x'], ['x', 1]]), ',x\r\nx,1');
  assert.strictEqual(MT.toCSV({ fields: ['p', 'q'], data: [[1, '=2']] }), `p,q\r\n1,"'=2"`);
  assert.strictEqual(MT.toCSV([{ a: 1, b: 2 }], { columns: ['b'] }), 'b\r\n2');
});

test('saveImage reports a null Blob instead of throwing', () => {
  const { MT, errors, saved } = load();
  assert.strictEqual(MT.saveImage(null, 'x.png'), false);
  assert.match(errors[0], /smaller scale/);
  assert.strictEqual(saved.length, 0);
  assert.strictEqual(MT.saveImage('blob', 'x.png'), true);
  assert.deepStrictEqual(saved, [['blob', 'x.png']]);
});
