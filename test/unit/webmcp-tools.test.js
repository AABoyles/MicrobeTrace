// Unit tests for the WebMCP tool modules (src/webmcp/session.js, query.js, style.js
// and views.js), run against a mocked MT and session, with no browser. The
// shared core (src/webmcp.js) is in webmcp.test.js. Run with: node --test test/unit
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');

// What the page's scripts see as `self`: the globals they use, mocked. The core
// and the tool files each run with it, as they do in the page (the core must
// share it, or its requireData would look at a different session).
const self = { MT: null, session: null, layout: { rootItem: null, contentItems: [] }, temp: {}, db: null };
const load = file => new Function('self', 'document', fs.readFileSync(path.join(ROOT, file), 'utf8'))(self, undefined);
load('src/webmcp.js');
const W = self.MTWebMCP;

function makeDb() {
  const store = new Map();
  return {
    store,
    getItem: async key => (store.has(key) ? store.get(key) : null),
    setItem: async (key, value) => { store.set(key, String(value)); },
    removeItem: async key => { store.delete(key); },
    keys: async () => Array.from(store.keys()),
    describeError: () => 'mock'
  };
}

// The MT functions the tools call, recording what they were asked to do
function makeMT() {
  const calls = [];
  const record = name => (...args) => { calls.push([name, ...args]); };
  return {
    calls,
    revealAll: record('revealAll'),
    setAutostash: record('setAutostash'),
    saveSession: async opts => { calls.push(['saveSession', opts]); return (opts.name || 'microbetrace') + '.' + (opts.format || 'microbetrace'); },
    sessionText: format => JSON.stringify({ format, nodes: self.session.data.nodes.length }),
    syncLayout: record('syncLayout'),
    exportHIVTRACE: () => '{}',
    saveAs: record('saveAs'),
    events: { on: () => () => {}, emit: record('emit') },
    settings: { get: () => undefined, set: record('settings.set') },
    setTimelinePlaying: null,
    exporterOf: () => null,
    reset: record('reset'),
    today: () => '2026-11-19',
    parseDate: v => (v == null || v === 'None' ? null : new Date(v)),
    maxGeneratedSequences: 250000,
    manifest: { version: 'test' }
  };
}

// A loaded session of n nodes, as the tools read it (no graph: links are not needed here)
function makeSession(n = 3) {
  const nodes = Array.from({ length: n }, (_, i) => ({
    _id: i, id: 'n' + i, state: i % 2 ? 'Georgia' : 'Texas', age: 20 + i, visible: true, selected: false, cluster: 1
  }));
  return {
    data: { nodes, nodeFields: ['id', 'state', 'age'], linkFields: [], clusters: [], nodeExclusions: [], nodeIndex: new Map(nodes.map(n => [n.id, n])), graph: null },
    style: { widgets: { 'node-timeline-variable': 'None' } },
    files: [], state: {}, meta: {}, network: { allPinned: false }
  };
}

self.db = makeDb();
self.MT = makeMT();
self.session = makeSession();

// (`document` is only used when a tool runs, and these tests run none that need it)
// schema.js first: the others take their schema helpers from it
for (const file of ['schema.js', 'session.js', 'query.js', 'style.js', 'views.js']) load('src/webmcp/' + file);

const tools = () => W.list();
const byName = name => tools().find(t => t.name == name);

// Runs a tool as an agent does, with WebMCP on for the test
async function agent(name, args) {
  return W.callAsAgent(name, args);
}
const errorOf = result => (result.isError ? result.content[0].text : null);

function withEnabled(fn) {
  return async (...args) => {
    W.setEnabled(true);
    try { return await fn(...args); } finally { W.setEnabled(false); }
  };
}

// Walks a schema, calling fn on each schema node with its path
function walkSchema(schema, fn, where = 'inputSchema') {
  if (!schema || typeof schema != 'object') return;
  fn(schema, where);
  for (const [key, child] of Object.entries(schema.properties || {})) walkSchema(child, fn, where + '.' + key);
  if (schema.items) walkSchema(schema.items, fn, where + '[]');
  if (schema.additionalProperties && typeof schema.additionalProperties == 'object') walkSchema(schema.additionalProperties, fn, where + '{}');
}

// ---------------------------------------------------------------------------------------------
// Definitions

test('the four tool modules define tools, each with a valid name, title, description and schema', () => {
  const list = tools();
  assert.ok(list.length >= 90, 'only ' + list.length + ' tools');
  const names = new Set();
  const TYPES = ['object', 'string', 'number', 'integer', 'boolean', 'array'];
  for (const t of list) {
    assert.match(t.name, /^[A-Za-z0-9_.-]{1,128}$/, t.name);
    assert.ok(!names.has(t.name), 'duplicate ' + t.name);
    names.add(t.name);
    assert.ok(typeof t.title == 'string' && t.title.length > 0, t.name + ' has no title');
    assert.ok(typeof t.description == 'string' && t.description.length > 40, t.name + ' needs a fuller description');
    assert.strictEqual(t.inputSchema.type, 'object', t.name + ' input must be an object');
    assert.ok(t.inputSchema.properties && typeof t.inputSchema.properties == 'object', t.name + ' needs properties');
    for (const r of t.inputSchema.required || []) assert.ok(r in t.inputSchema.properties, t.name + ' requires undeclared ' + r);
    walkSchema(t.inputSchema, (node, where) => {
      if (node.type !== undefined) assert.ok(TYPES.includes(node.type), where + ' has type ' + node.type + ' in ' + t.name);
      if (node.enum !== undefined) assert.ok(Array.isArray(node.enum) && node.enum.length > 0, where + ' has a bad enum in ' + t.name);
      if (node.type == 'array') assert.ok(node.items, where + ' is an array with no items in ' + t.name);
      if (node.minimum !== undefined) assert.strictEqual(typeof node.minimum, 'number', where + ' in ' + t.name);
      if (node.maximum !== undefined) assert.strictEqual(typeof node.maximum, 'number', where + ' in ' + t.name);
      if (node.description !== undefined) assert.strictEqual(typeof node.description, 'string', where + ' in ' + t.name);
    });
  }
});

test('annotations agree with the tool: read-only tools never ask, and tools that ask are consequential', () => {
  for (const t of tools()) {
    const a = t.annotations || {};
    if (a.readOnlyHint) {
      assert.ok(!a.consequentialHint, t.name + ' is read-only and consequential');
      assert.ok(!t.asksUser, t.name + ' is read-only but asks the user');
    }
    if (t.asksUser) assert.strictEqual(a.consequentialHint, true, t.name + ' asks the user but is not consequential');
    if (a.consequentialHint) assert.ok(!a.readOnlyHint, t.name);
    if (t.asksUser) assert.match(t.description, /The user must allow this/, t.name);
  }
});

test('every tool warns that its result is untrusted, except those whose results hold no text from the data', () => {
  const noNote = tools().filter(t => !/Untrusted data:/.test(t.description)).map(t => t.name).sort();
  assert.deepStrictEqual(noNote, ['get_autostash', 'list_palettes', 'set_autostash']);
});

test('registration: with WebMCP on, every tool goes to navigator.modelContext and is unregistered when it is off', async () => {
  const registered = new Map();
  const context = {
    registerTool(tool, { signal }) {
      registered.set(tool.name, { tool, signal });
    }
  };
  const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', { value: { modelContext: context }, configurable: true, writable: true });
  try {
    W.setEnabled(true);
    assert.strictEqual(registered.size, tools().length);
    for (const t of tools()) {
      const entry = registered.get(t.name);
      assert.ok(entry, t.name + ' was not registered');
      assert.strictEqual(entry.tool.description, t.description);
      assert.deepStrictEqual(entry.tool.inputSchema, t.inputSchema);
      assert.deepStrictEqual(entry.tool.annotations, t.annotations);
      assert.strictEqual(entry.signal.aborted, false);
    }
    W.setEnabled(false);
    for (const { signal } of registered.values()) assert.strictEqual(signal.aborted, true);
  } finally {
    W.setEnabled(false);
    if (original) Object.defineProperty(globalThis, 'navigator', original);
    else delete globalThis.navigator;
  }
});

// ---------------------------------------------------------------------------------------------
// Invalid arguments: every tool refuses bad input with a clear error, before it acts

// A valid value for a field, so that a bad case fails only for its own reason
function placeholder(def) {
  if (def.enum) return def.enum[0];
  switch (def.type) {
    case 'string': return 'x';
    case 'integer': case 'number': return def.minimum !== undefined ? Math.max(def.minimum, 1) : 1;
    case 'boolean': return true;
    case 'array': return def.items && def.items.type == 'string' ? ['x'] : def.items ? [placeholder(def.items)] : [];
    default: {
      const value = {};
      for (const r of def.required || []) value[r] = placeholder(def.properties[r]);
      return value;
    }
  }
}

// Bad argument sets derived from one tool's schema, each on top of valid
// required fields: [label, args, message pattern]
function badArgumentCases(schema) {
  const cases = [];
  const props = schema.properties || {};
  const required = schema.required || [];
  const base = {};
  for (const r of required) base[r] = placeholder(props[r]);
  const bad = (label, field, value, pattern) => cases.push([label, Object.assign({}, base, { [field]: value }), pattern]);
  if (schema.additionalProperties !== true) bad('unknown field', 'zz_not_a_field', 1, /There is no field "zz_not_a_field"/);
  if (required.length) cases.push(['missing required', {}, new RegExp(required[0] + ' is required')]);
  for (const [name, def] of Object.entries(props)) {
    if (def.enum) bad(name + ' not an option', name, 'zz-not-an-option', /must be one of/);
    switch (def.type) {
      case 'string': if (!def.enum) bad(name + ' not text', name, 42, /must be a string/); break;
      case 'number': bad(name + ' not a number', name, 'nope', /must be a number/); break;
      case 'integer':
        bad(name + ' not a number', name, 'nope', /must be a number/);
        bad(name + ' not whole', name, 1.5, /must be a whole number/);
        break;
      case 'boolean': bad(name + ' not true/false', name, 'yes', /must be true or false/); break;
      case 'array': bad(name + ' not a list', name, 'x', /must be a list/); break;
      case 'object': if (def.properties || def.additionalProperties === undefined) bad(name + ' not an object', name, 'x', /must be an object/); break;
      default: break;
    }
    if (typeof def.minimum == 'number' && !def.enum) bad(name + ' below ' + def.minimum, name, def.minimum - 1, /must be at least/);
    if (typeof def.maximum == 'number' && !def.enum) bad(name + ' above ' + def.maximum, name, def.maximum + 1, /must be at most/);
    if (def.type == 'array' && def.minItems) bad(name + ' too short', name, [], /must have at least/);
    if (def.type == 'array' && def.items && def.items.type == 'string' && !def.items.enum) bad(name + ' item not text', name, [42], /must be a string/);
    if (def.type == 'array' && def.items && def.items.enum) bad(name + ' item not an option', name, ['zz-not-an-option'], /must be one of/);
  }
  return cases;
}

test('every tool refuses bad arguments with an error naming the problem, and does not run', withEnabled(async () => {
  const failures = [];
  for (const t of tools()) {
    for (const [label, args, pattern] of badArgumentCases(t.inputSchema)) {
      const result = await agent(t.name, args);
      const text = errorOf(result);
      if (!result.isError || !pattern.test(text || '') || !new RegExp('Invalid arguments for ' + t.name + ':').test(text)) {
        failures.push(t.name + ' / ' + label + ': ' + (text || 'no error'));
      }
      if (/TypeError|undefined|null/.test(text || '')) failures.push(t.name + ' / ' + label + ' reads like a crash: ' + text);
    }
  }
  assert.deepStrictEqual(failures, []);
}));

test('a tool that asks the user is refused for bad arguments before anyone is asked', withEnabled(async () => {
  // With no page to ask on, a valid consequential call fails closed; a bad one says what is wrong instead
  const bad = await agent('save_session', { download: 'yes' });
  assert.match(errorOf(bad), /Invalid arguments for save_session: "download" must be true or false/);
  const good = await agent('save_session', { format: 'hivtrace', download: true, returnContents: false });
  assert.match(errorOf(good), /needs the user's permission/);
}));

test('null means an optional field was left out; unknown formats and out-of-range values say so', withEnabled(async () => {
  const r = await agent('query_nodes', { filter: null, limit: null });
  assert.ok(!r.isError, errorOf(r));
  assert.match(errorOf(await agent('query_nodes', { limit: 100000 })), /"limit" must be at most 10000/);
  assert.match(errorOf(await agent('control_timeline_playback', { action: 'stop' })), /"action" must be one of "play", "pause"/);
  assert.match(errorOf(await agent('set_settings', { values: 'x' })), /"values" must be an object/);
  assert.match(errorOf(await agent('list_views', { extra: true })), /There is no field "extra"/);
  // A layout's content items declare no fields, so any field passes the check (the tool itself then needs data)
  const layout = await agent('set_layout', { layout: { type: 'row', content: [{ type: 'network', anything: 1 }] } });
  assert.doesNotMatch(errorOf(layout) || '', /Invalid arguments/);
}));

test('the filter language is checked inside its conditions, with the path to the bad one', withEnabled(async () => {
  const r = await agent('query_nodes', { filter: [{ field: 'age', op: 'gt', value: 3 }, { field: 'age', op: 'gt', valu: 3 }] });
  assert.match(errorOf(r), /There is no field "valu"/);
  const s = await agent('query_nodes', { filter: [{ op: 'gt', value: 3 }] });
  assert.match(errorOf(s), /filter\[0\]\.field is required/);
}));

// ---------------------------------------------------------------------------------------------
// Query logic (query.js), over a mocked session

test('query_nodes filters, sorts and pages the nodes of the session', withEnabled(async () => {
  self.session = makeSession(6); // ages 20..25; states alternate Texas, Georgia
  const eq = await agent('query_nodes', { filter: [{ field: 'state', op: 'eq', value: 'georgia' }] });
  const got = JSON.parse(eq.content[0].text);
  assert.strictEqual(got.total, 3);
  assert.deepStrictEqual(got.items.map(n => n._id), [1, 3, 5]);

  const older = JSON.parse((await agent('query_nodes', { filter: [{ field: 'age', op: 'gte', value: 23 }], sort: [{ field: 'age', descending: true }], limit: 2 })).content[0].text);
  assert.strictEqual(older.total, 3);
  assert.strictEqual(older.returned, 2);
  assert.deepStrictEqual(older.items.map(n => n.age), [25, 24]);

  const count = JSON.parse((await agent('query_nodes', { filter: [{ field: 'age', op: 'gt', value: 100 }], count: true })).content[0].text);
  assert.deepStrictEqual(count, { total: 0 });
}));

test('query_nodes fails clearly for IDs that are not in the network, and when no data is loaded', withEnabled(async () => {
  self.session = makeSession(3);
  assert.match(errorOf(await agent('query_nodes', { ids: ['n9'] })), /No node has the ID "n9"/);
  self.session = makeSession(0);
  assert.match(errorOf(await agent('query_nodes', {})), /No data is loaded/);
  self.session = makeSession(3);
}));

test('a regular expression that is too long is refused by the filter, as an error', withEnabled(async () => {
  const r = await agent('query_nodes', { filter: [{ field: 'id', op: 'regex', value: 'a'.repeat(400) }] });
  assert.match(errorOf(r), /too long/);
}));

// ---------------------------------------------------------------------------------------------
// Session tools (session.js): the autostash and save paths, through the MT functions

test('set_autostash turning it off calls MT.setAutostash; turning it on needs the user first', withEnabled(async () => {
  self.MT.calls.length = 0;
  const off = await agent('set_autostash', { enabled: false });
  assert.deepStrictEqual(off.content[0].text, JSON.stringify({ autostash: false }));
  assert.deepStrictEqual(self.MT.calls, [['setAutostash', false]]);
  const on = await agent('set_autostash', { enabled: true });
  assert.match(errorOf(on), /needs the user's permission/);
  assert.strictEqual(self.MT.calls.length, 1, 'turning it on must not run without the user');
}));

test('save_session with download saves through MT.saveSession, with the name given (or the dialog\'s)', withEnabled(async () => {
  self.MT.calls.length = 0;
  const r = JSON.parse((await agent('save_session', { download: false, returnContents: false, format: 'microbetracestyle' })).content[0].text);
  assert.deepStrictEqual(r, { format: 'microbetracestyle', characters: JSON.stringify(self.session.style).length });
  assert.deepStrictEqual(self.MT.calls, [], 'a read does not save');
  // Downloading needs the user's permission, which this page cannot give, so nothing is saved
  assert.match(errorOf(await agent('save_session', { download: true, filename: 'x' })), /needs the user's permission/);
  assert.deepStrictEqual(self.MT.calls, []);
}));

test('reveal_all needs data, and then calls MT.revealAll once', withEnabled(async () => {
  self.session = makeSession(0);
  assert.match(errorOf(await agent('reveal_all', {})), /No data is loaded/);
  self.session = makeSession(3);
  self.MT.calls.length = 0;
  const r = await agent('reveal_all', {});
  assert.ok(!r.isError, errorOf(r));
  assert.deepStrictEqual(self.MT.calls, [['revealAll']]);
}));

test('control_timeline_playback refuses when the timeline is off or not drawn, and otherwise calls MT.setTimelinePlaying', withEnabled(async () => {
  assert.match(errorOf(await agent('control_timeline_playback', { action: 'play' })), /The timeline is not on/);
  self.session.style.widgets['node-timeline-variable'] = 'age';
  assert.match(errorOf(await agent('control_timeline_playback', { action: 'play' })), /not drawn yet/);
  const played = [];
  self.MT.setTimelinePlaying = play => played.push(play);
  try {
    await agent('control_timeline_playback', { action: 'play' });
    await agent('control_timeline_playback', { action: 'pause' });
    assert.deepStrictEqual(played, [true, false]);
  } finally {
    self.MT.setTimelinePlaying = null;
    self.session.style.widgets['node-timeline-variable'] = 'None';
  }
}));
