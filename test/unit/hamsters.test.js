// Unit tests for the order of MT.runHamsters in src/common.js (#233).
// Run with: npm test
const test = require('node:test');
const assert = require('node:assert');
const vm = require('vm');
const fs = require('fs');
const path = require('path');

// A stand-in for anything common.js touches in the page as it loads
const stub = () => new Proxy(function() {}, {
  get: (t, k) => k === Symbol.toPrimitive ? () => '' : stub(),
  apply: () => stub(),
  construct: () => stub()
});

// Loads common.js afresh, with the compute steps replaced by ones that log
// when they start and finish, each finishing on a later tick.
function load({ directionality = true, tree = null, failTree = false } = {}) {
  const ctx = {
    console: { log() {}, error() {}, warn() {} },
    TextDecoder, TextEncoder,
    MTSettings: require('../../src/settings.js'),
    MTEvents: require('../../src/events.js'),
    document: stub()
  };
  ctx.self = ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../../src/common.js'), 'utf8'), ctx);
  const MT = ctx.MT, log = [], warnings = [];
  ctx.session = { style: { widgets: { 'infer-directionality-false': !directionality } } };
  ctx.temp = { tree };
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

test('computeDirectionality rejects, rather than hanging, when its worker throws', async () => {
  const ctx = {
    console: { log() {}, error() {} },
    TextDecoder, TextEncoder,
    MTSettings: require('../../src/settings.js'),
    MTEvents: require('../../src/events.js'),
    document: stub()
  };
  ctx.self = ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../../src/common.js'), 'utf8'), ctx);
  let terminated = false;
  ctx.Worker = class {
    postMessage() { setTimeout(() => this.onerror(new Error('too deep')), 1); }
    terminate() { terminated = true; }
  };
  ctx.temp = { tree: { id: 'root' } };
  ctx.session = { data: { graph: {
    edgeCount: 1, ids: ['a', 'b'],
    forEachEdge: fn => fn(0, 0, 1)
  } } };
  await assert.rejects(ctx.MT.computeDirectionality(), /too deep/);
  assert.ok(terminated);
});
