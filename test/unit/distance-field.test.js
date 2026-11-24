// Regression test for #213: distances from matrix files are kept under the
// field the threshold filter reads. Run with: node --test test/unit
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Papa = require('papaparse');
const MTGraph = require('../../src/graph.js').MTGraph;

// Runs workers/parse-csv-matrix.js as the browser would
function parseMatrix(text) {
  let out;
  const ctx = {
    importScripts() {}, Papa, console, TextEncoder, JSON, Date, parseFloat,
    postMessage: msg => { out = JSON.parse(JSON.stringify(msg.data)); /* into this realm */ },
    close() {}
  };
  vm.createContext(ctx);
  const file = path.join(__dirname, '../../workers/parse-csv-matrix.js');
  vm.runInContext(fs.readFileSync(file, 'utf8'), ctx, { filename: file });  // a filename, so coverage counts it
  ctx.onmessage({ data: text });
  return out;
}

const matrix = ',A,B,C\nA,0,1,5\nB,1,0,2\nC,5,2,0\n';

test('matrix links, moved to the metric field, pass the threshold filter', () => {
  const field = 'tn93'; // the default link-sort-variable
  const parsed = parseMatrix(matrix);
  assert.strictEqual(parsed.nodes.length, 3);

  const raw = new MTGraph(), fixed = new MTGraph();
  parsed.links.forEach(l => {
    raw.addLink(Object.assign({}, l, { origin: ['m'] }));
    fixed.addLink(MTGraph.distanceLink(Object.assign({}, l, { origin: ['m'] }), field));
  });
  const visible = g => g.computeVisible(field, 2, false, () => true).length;
  assert.strictEqual(visible(raw), 0, 'unconverted links are invisible to the filter (the bug)');
  assert.ok(visible(fixed) > 0, 'links under the metric field are filtered on');
});

test('distanceLink renames only distance', () => {
  const l = { source: 'a', target: 'b', distance: 3 };
  assert.deepStrictEqual(MTGraph.distanceLink(l, 'snps'), { source: 'a', target: 'b', snps: 3 });
  assert.deepStrictEqual(l, { source: 'a', target: 'b', distance: 3 });
  assert.deepStrictEqual(MTGraph.distanceLink({ source: 'a', distance: 3 }, 'distance'), { source: 'a', distance: 3 });
});
