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
  vm.runInContext(source, ctx);
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

test('a delimiter is honoured', () => {
  const out = parse({ text: 'a;b;d\nx;y;2\n', delimiter: ';', field1: 'a', field2: 'b' });
  assert.strictEqual(out.rows.length, 1);
  assert.strictEqual(out.rows[0].d, 2);
  assert.strictEqual(out.rows[0].a, 'x');
});
