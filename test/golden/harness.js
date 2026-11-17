// Runs MicrobeTrace's own code in Node for the golden tests (#171): the Web
// Workers in workers/ (bx-distance-models' WebAssembly included) and
// src/common.js, each in a vm context standing in for the browser, as
// test/unit/distance-field.test.js does. Nothing here computes a result.

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '../..');
const quiet = { log() {}, warn() {}, error: (...a) => console.error(...a) };

// A Web Worker running script (a path from the app root, as the app names it)
// in its own context. Messages are structured-cloned both ways, as a browser does.
class Worker {
  constructor(script) {
    const file = path.join(root, script), dir = path.dirname(file);
    const ctx = this.ctx = {
      console: quiet, TextEncoder, TextDecoder, Response, URL, setTimeout,
      fetch: async url => new Response(fs.readFileSync(path.resolve(dir, String(url))), { headers: { 'content-type': 'application/wasm' } }),
      postMessage: data => setImmediate(() => this.onmessage && this.onmessage({ data: structuredClone(data) })),
      close() {},
      importScripts: (...files) => files.forEach(f => vm.runInContext(fs.readFileSync(path.resolve(dir, f), 'utf8'), ctx, { filename: f }))
    };
    ctx.self = ctx;
    vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(file, 'utf8'), ctx, { filename: script });
  }
  postMessage(data) {
    setImmediate(async () => {
      try {
        await this.ctx.onmessage({ data: structuredClone(data) });
      } catch (error) {
        if (this.onerror) this.onerror(error); else throw error;
      }
    });
  }
  terminate() {}
}

// Posts one message to a worker and resolves with its reply
const runWorker = (script, data) => new Promise((resolve, reject) => {
  const w = new Worker(script);
  w.onmessage = e => resolve(e.data);
  w.onerror = reject;
  w.postMessage(data);
});

// src/common.js loaded as the page loads it, with real workers, a fresh session
// and the default settings, overridden by widgets
function loadApp(widgets = {}) {
  const stub = () => new Proxy(function() {}, {
    get: (t, k) => k === Symbol.toPrimitive ? () => '' : stub(),
    apply: () => stub(),
    construct: () => stub()
  });
  const ctx = {
    console: quiet, TextDecoder, TextEncoder, Worker,
    navigator: { hardwareConcurrency: 4 },
    MTGraph: require('../../src/graph.js'),
    MTSettings: require('../../src/settings.js'),
    MTDates: require('../../src/dates.js'),
    MTEvents: require('../../src/events.js'),
    document: stub()
  };
  ctx.self = ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(root, 'src/common.js'), 'utf8'), ctx, { filename: 'src/common.js' });
  const MT = ctx.MT;
  ctx.temp = {};
  ctx.session = {
    style: { widgets: Object.assign(JSON.parse(JSON.stringify(MT.defaultWidgets)), widgets) },
    data: { nodes: [], nodeFields: [], linkFields: [], clusters: [], graph: new ctx.MTGraph() }
  };
  return { ctx, MT, session: ctx.session };
}

// The sequences of a golden FASTA file, as workers/parse-fasta.js reads them
async function parseFasta(file) {
  const text = fs.readFileSync(path.join(__dirname, file), 'utf8');
  const out = await runWorker('workers/parse-fasta.js', text);
  return JSON.parse(new TextDecoder().decode(out.nodes));
}

const expected = file => JSON.parse(fs.readFileSync(path.join(__dirname, file), 'utf8'));

module.exports = { Worker, runWorker, loadApp, parseFasta, expected, root };
