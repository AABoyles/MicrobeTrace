// workers/parse-links.js (#253): link-list CSV parsed off the main thread, run
// in Node as the browser runs it. Run with: npm test
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Papa = require('papaparse');

const source = fs.readFileSync(path.join(__dirname, '../../workers/parse-links.js'), 'utf8');

function parse(msg) {
  let out;
  const ctx = { importScripts() {}, Papa, postMessage: m => { out = m; }, close() {} };
  vm.createContext(ctx);
  vm.runInContext(source, ctx, { filename: path.join(__dirname, '../../workers/parse-links.js') });  // a filename, so coverage counts it
  ctx.onmessage({ data: msg });
  return out;
}

test('rows are typed except the ID columns, and the header is reported', () => {
  const out = parse({ text: 'a,b,distance,note\n007,1E3,1.5,x\nB,C,,y\n\n', field1: 'a', field2: 'b' });
  assert.deepStrictEqual(out.fields, ['a', 'b', 'distance', 'note']);
  assert.strictEqual(out.rows.length, 2);
  assert.strictEqual(out.rows[0].a, '007');
  assert.strictEqual(out.rows[0].b, '1E3');
  assert.strictEqual(out.rows[0].distance, 1.5);
  assert.strictEqual(out.rows[1].distance, null);
});

// A link list cut off (#172). Each whole row is a link; a row cut before its
// distance has none, and the app counts that as a missing distance, not a link.
test('a row cut before its distance comes back without one', () => {
  const out = parse({ text: 'a,b,distance\nx,y,1\nx,z', field1: 'a', field2: 'b' });
  assert.deepStrictEqual(out.rows, [{ a: 'x', b: 'y', distance: 1 }, { a: 'x', b: 'z' }]);
});
test('a file cut inside a quoted field reads the rest of the file as that field', () => {
  const out = parse({ text: 'a,b,distance\nx,y,1\nx,"z', field1: 'a', field2: 'b' });
  assert.deepStrictEqual(out.rows, [{ a: 'x', b: 'y', distance: 1 }, { a: 'x', b: 'z' }]);
});
test('a file cut inside its header has no rows', () => {
  const out = parse({ text: 'a,b,dist', field1: 'a', field2: 'b' });
  assert.deepStrictEqual(out.rows, []);
  assert.deepStrictEqual(out.fields, ['a', 'b', 'dist']);
});

// A pair listed twice is two links, as the file says; the parser keeps both rows, in order
test('a pair listed twice keeps both rows, in order, with their own distances', () => {
  const out = parse({ text: 'a,b,distance\nx,y,1\nx,y,2\n', field1: 'a', field2: 'b' });
  assert.deepStrictEqual(out.rows, [{ a: 'x', b: 'y', distance: 1 }, { a: 'x', b: 'y', distance: 2 }]);
});

test('a delimiter is honoured', () => {
  const out = parse({ text: 'a;b;d\nx;y;2\n', delimiter: ';', field1: 'a', field2: 'b' });
  assert.strictEqual(out.rows.length, 1);
  assert.strictEqual(out.rows[0].d, 2);
  assert.strictEqual(out.rows[0].a, 'x');
});
