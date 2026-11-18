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
  const { MT, ctx } = loadApp();
  ctx.Worker = Worker;
  const out = await MT.runWorker('workers/parse-fasta.js', '');
  assert.deepStrictEqual(JSON.parse(new TextDecoder().decode(out.nodes)), []);
  // compute-nn reads e.data.matrix; a null message makes it throw
  await assert.rejects(MT.runWorker('workers/compute-nn.js', null, { name: 'NN' }));
});

test('computeNNFlags rejects, rather than resolving, when its worker fails', async () => {
  const { MT, session, ctx } = loadApp();
  ctx.Worker = class extends Fake { constructor() { super(w => w.onerror({ message: 'out of memory' })); } };
  MT.getCondensedDM = () => ({ tri: new Float32Array(0) });
  session.data.graph = { ids: [] };
  await assert.rejects(MT.computeNNFlags('workers/compute-nn.js', 'NN'), /out of memory/);
});
