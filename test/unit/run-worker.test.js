// MT.runWorker (src/common.js): every way a worker can fail settles the promise
// with an Error and ends the worker, and it settles once (#222).
const test = require('node:test');
const assert = require('node:assert');
const { loadApp, Worker } = require('../golden/harness.js');

// A worker that does whatever the test scripts it to
class Fake {
  constructor(act) { this.act = act; this.terminated = 0; }
  postMessage(data) { setImmediate(() => this.act(this, data)); }
  terminate() { this.terminated++; }
}
const run = (act, options) => {
  const { MT } = loadApp();
  const worker = new Fake(act);
  return { worker, promise: MT.runWorker('x.js', 'in', Object.assign({ worker, name: 'The thing' }, options)) };
};

test('resolves with the reply and terminates the worker', async () => {
  const { worker, promise } = run((w, d) => w.onmessage({ data: { ok: d } }));
  assert.deepStrictEqual(JSON.parse(JSON.stringify(await promise)), { ok: 'in' });
  assert.strictEqual(worker.terminated, 1);
});

test('rejects when the worker throws, with its message, and terminates it', async () => {
  const { worker, promise } = run(w => w.onerror({ message: 'boom', preventDefault() {} }));
  await assert.rejects(promise, /boom/);
  assert.strictEqual(worker.terminated, 1);
});

test('rejects with a name when the error has no message', async () => {
  await assert.rejects(run(w => w.onerror({})).promise, /The thing failed/);
});

test('rejects when the reply cannot be read (onmessageerror)', async () => {
  await assert.rejects(run(w => w.onmessageerror({})).promise, /could not be read/);
});

test('rejects on an error reply, as an object or the string "Error"', async () => {
  await assert.rejects(run(w => w.onmessage({ data: { error: 'bad input' } })).promise, /bad input/);
  await assert.rejects(run(w => w.onmessage({ data: 'Error' })).promise, /The thing failed/);
});

test('rejects when posting throws', async () => {
  const { MT } = loadApp();
  const worker = new Fake();
  worker.postMessage = () => { throw new Error('not cloneable'); };
  await assert.rejects(MT.runWorker('x.js', 'in', { worker }), /not cloneable/);
  assert.strictEqual(worker.terminated, 1);
});

test('settles once: a later error or reply is ignored', async () => {
  const { worker, promise } = run(w => { w.onmessage({ data: { n: 1 } }); w.onerror({ message: 'late' }); w.onmessage({ data: { n: 2 } }); });
  assert.strictEqual((await promise).n, 1);
  assert.strictEqual(worker.terminated, 1);
});

test('runs a real worker, and rejects when one throws', async () => {
  const { MT } = loadApp();
  globalThis.Worker = Worker;
  const out = await MT.runWorker('workers/parse-fasta.js', '');
  assert.deepStrictEqual(out.nodes, []);
  // compute-nn reads e.data.matrix; a null message makes it throw
  await assert.rejects(MT.runWorker('workers/compute-nn.js', null, { name: 'NN' }));
});

test('computeNNFlags rejects, rather than resolving, when its worker fails', async () => {
  const { MT, session } = loadApp();
  globalThis.Worker = class extends Fake { constructor() { super(w => w.onerror({ message: 'out of memory' })); } };
  MT.getCondensedDM = () => ({ tri: new Float32Array(0) });
  session.data.graph = { ids: [] };
  await assert.rejects(MT.computeNNFlags('workers/compute-nn.js', 'NN'), /out of memory/);
});

// A view's computations run in a scope (#293): its Cancel stops that scope's
// workers and no others, and Launch's cancel doesn't stop a scope's workers
test('a scope cancel terminates its workers, rejects them as cancelled, and leaves others running', async () => {
  const { MT } = loadApp();
  const scope = MT.workScope();
  const inScope = new Fake(() => {});
  const outside = new Fake(() => {});
  const a = MT.runWorker('x.js', 'in', { worker: inScope, scope });
  const b = MT.runWorker('x.js', 'in', { worker: outside });
  scope.cancel();
  await assert.rejects(a, error => error.cancelled === true);
  assert.strictEqual(inScope.terminated, 1);
  assert.strictEqual(outside.terminated, 0);
  assert.strictEqual(MT.workCancelled(), false);
  // A worker outside the scope still settles normally
  const c = MT.runWorker('x.js', 'in', { worker: new Fake(w => w.onmessage({ data: { ok: 'done' } })) });
  assert.strictEqual((await c).ok, 'done');
  MT.cancelWork();
  await assert.rejects(b, error => error.cancelled === true);
  assert.strictEqual(outside.terminated, 1);
});

test('Launch cancel (MT.cancelWork) does not stop a scope, and a cancelled scope refuses new workers', async () => {
  const { MT } = loadApp();
  const scope = MT.workScope();
  const worker = new Fake(() => {});
  const pending = MT.runWorker('x.js', 'in', { worker, scope });
  MT.cancelWork();
  assert.strictEqual(worker.terminated, 0);
  scope.cancel();
  await assert.rejects(pending, error => error.cancelled === true);
  const late = new Fake(() => {});
  await assert.rejects(MT.runWorker('x.js', 'in', { worker: late, scope }), error => error.cancelled === true);
  assert.strictEqual(late.terminated, 0, 'no worker is started for a cancelled scope');
  MT.startWork();
});

test('a scope cancel after its worker has replied does nothing', async () => {
  const { MT } = loadApp();
  const scope = MT.workScope();
  const worker = new Fake(w => w.onmessage({ data: { n: 1 } }));
  assert.strictEqual((await MT.runWorker('x.js', 'in', { worker, scope })).n, 1);
  scope.cancel();
  assert.strictEqual(worker.terminated, 1);
  assert.strictEqual(scope.stops.size, 0);
});
