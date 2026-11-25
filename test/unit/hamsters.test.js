// Unit tests for the order of MT.runHamsters in src/links-clusters.js (#233).
// Run with: npm test
const test = require('node:test');
const { createMT } = require('../../src/common.js');
const assert = require('node:assert');
const patristic = require('patristic');

// A stand-in for the page's document, which the installers touch as MT is built
const stub = () => new Proxy(function() {}, {
  get: (t, k) => k === Symbol.toPrimitive ? () => '' : stub(),
  apply: () => stub(),
  construct: () => stub()
});

// Loads common.js afresh, with the compute steps replaced by ones that log
// when they start and finish, each finishing on a later tick.
function load({ directionality = true, tree = null, failTree = false } = {}) {
  globalThis.document = stub();
  const ctx = { session: { style: { widgets: { 'infer-directionality-false': !directionality } } }, temp: { tree } };
  const MT = createMT(ctx), log = [], warnings = [];
  const later = (name, fn) => async () => {
    log.push(name + ' start');
    await new Promise(r => setTimeout(r, 5));
    if (fn) fn();
    log.push(name + ' end');
  };
  MT.computeTree = later('tree', () => {
    if (failTree) throw new Error('Maximum call stack size exceeded');
    ctx.temp.tree = { id: 'root' };
  });
  MT.computeDirectionality = later('directionality', () => {
    assert.ok(ctx.temp.tree, 'directionality ran without a tree');
  });
  MT.finishUp = later('finishUp');
  MT.toast = { warning: message => warnings.push(message) };
  return { MT, ctx, log, warnings };
}

test('with directionality on, the tree is built, then directions inferred, then the load finished', async () => {
  const { MT, log } = load();
  await MT.runHamsters();
  assert.deepStrictEqual(log, [
    'tree start', 'tree end',
    'directionality start', 'directionality end',
    'finishUp start', 'finishUp end'
  ]);
});

test('a tree there already (from a Newick file) is used, not rebuilt', async () => {
  const { MT, log } = load({ tree: { id: 'newick' } });
  await MT.runHamsters();
  assert.deepStrictEqual(log, ['directionality start', 'directionality end', 'finishUp start', 'finishUp end']);
});

test('with directionality off, no tree is built', async () => {
  const { MT, log, ctx } = load({ directionality: false });
  await MT.runHamsters();
  assert.deepStrictEqual(log, ['finishUp start', 'finishUp end']);
  assert.strictEqual(ctx.temp.tree, null);
});

test('a tree that fails to build warns and still finishes the load', async () => {
  const { MT, log, warnings } = load({ failTree: true });
  await MT.runHamsters();
  assert.deepStrictEqual(log, ['tree start', 'finishUp start', 'finishUp end']);
  assert.strictEqual(warnings.length, 1);
});

// Loads common.js with nothing replaced, for the compute steps themselves
function bare() {
  globalThis.document = stub();
  const ctx = { session: { style: { widgets: {} } }, temp: {} };
  ctx.MT = createMT(ctx);
  return ctx;
}

// A tree worker that answers with a tree, and notes when it's terminated
function treeWorker(ctx) {
  const worker = { terminated: false };
  globalThis.Worker = class {
    postMessage() {
      const tree = { id: 'root' };
      setTimeout(() => this.onmessage({ data: { tree, start: Date.now() } }), 1);
    }
    terminate() { worker.terminated = true; }
  };
  ctx.MT.loadLibrary = async () => {}; // the tree bundle, which brings patristic (#324)
  ctx.MT.getDMLabels = () => ['a', 'b'];
  ctx.MT.getDM = async () => new Float64Array([0, 1, 1, 0]);
  return worker;
}

test('computeTree rejects, rather than hanging, when the tree cannot be parsed', async () => {
  const ctx = bare(), worker = treeWorker(ctx);
  globalThis.patristic = { parseJSON: () => { throw new RangeError('Maximum call stack size exceeded'); } };
  await assert.rejects(ctx.MT.computeTree(), /Maximum call stack/);
  assert.ok(worker.terminated);
  assert.strictEqual(ctx.temp.tree, undefined);
});

test('computeTree rejects when the distance matrix fails', async () => {
  const ctx = bare();
  treeWorker(ctx);
  ctx.MT.getDM = async () => { throw new Error('no matrix'); };
  // (no worker is started without a matrix)
  await assert.rejects(ctx.MT.computeTree(), /no matrix/);
});

test('computeTree sets the tree and terminates its worker', async () => {
  const ctx = bare(), worker = treeWorker(ctx);
  globalThis.patristic = { parseJSON: tree => tree };
  await ctx.MT.computeTree();
  assert.strictEqual(ctx.temp.tree.id, 'root');
  assert.ok(worker.terminated);
});

test('computeDirectionality rejects, rather than hanging, when its worker throws', async () => {
  const ctx = bare();
  let terminated = false;
  globalThis.Worker = class {
    postMessage() { setTimeout(() => this.onerror(new Error('too deep')), 1); }
    terminate() { terminated = true; }
  };
  ctx.temp = { tree: patristic.parseNewick('(a:1,b:2);') };
  ctx.session = { data: { graph: {
    edgeCount: 1, ids: ['a', 'b'],
    forEachEdge: fn => fn(0, 0, 1)
  } } };
  await assert.rejects(ctx.MT.computeDirectionality(), /too deep/);
  assert.ok(terminated);
});

// A Branch has no properties of its own to copy, so posting one gives the worker an
// empty tree, and no link is ever turned (#360)
test('computeDirectionality sends its worker a tree that survives being posted', async () => {
  const ctx = bare();
  let sent;
  globalThis.Worker = class {
    postMessage(message) {
      sent = structuredClone(message);
      setTimeout(() => this.onmessage({ data: { output: new Uint8Array(1).buffer, start: Date.now() } }), 1);
    }
    terminate() {}
  };
  ctx.temp = { tree: patristic.parseNewick('((a:1,b:3)x:2,c:4)r;') };
  ctx.session = { data: { graph: {
    edgeCount: 1, ids: ['a', 'b'],
    forEachEdge: fn => fn(0, 0, 1)
  } } };
  await ctx.MT.computeDirectionality();
  assert.strictEqual(patristic.parseJSON(sent.tree).toNewick(), '((a:1,b:3)x:2,c:4)r;');
});
