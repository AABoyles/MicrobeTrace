// Unit tests for the shared helpers of src/webmcp.js. Run with: node --test test/unit
const test = require('node:test');
const assert = require('node:assert');
const W = require('../../src/webmcp.js');

const people = [
  { id: 'a', tagged: 1, age: 30, state: 'Georgia', date: '2020-01-05', tag: ['x', 'y'] },
  { id: 'b', tagged: 2, age: 4, state: 'texas', date: '2019-12-30' },
  { id: 'c', tagged: 1, age: 100, state: 'Texas', date: '2021-02-01', tag: ['y'] },
  { id: 'd', age: null, state: '', date: null }
];
const ids = items => items.map(i => i.id).join('');

test('filter: no conditions returns everything', () => {
  assert.strictEqual(W.filter(people, []), people);
  assert.strictEqual(W.filter(people), people);
});

test('filter: numeric comparisons are numeric', () => {
  assert.strictEqual(ids(W.filter(people, [{ field: 'age', op: 'gt', value: 9 }])), 'ac'); // not text order
  assert.strictEqual(ids(W.filter(people, [{ field: 'age', op: 'lte', value: '30' }])), 'ab');
  assert.strictEqual(ids(W.filter(people, [{ field: 'age', op: 'eq', value: 4 }])), 'b');
});

test('filter: text ignores case unless caseSensitive', () => {
  assert.strictEqual(ids(W.filter(people, [{ field: 'state', op: 'eq', value: 'TEXAS' }])), 'bc');
  assert.strictEqual(ids(W.filter(people, [{ field: 'state', op: 'eq', value: 'texas', caseSensitive: true }])), 'b');
  assert.strictEqual(ids(W.filter(people, [{ field: 'state', op: 'contains', value: 'ex' }])), 'bc');
  assert.strictEqual(ids(W.filter(people, [{ field: 'state', op: 'startsWith', value: 'geo' }])), 'a');
  assert.strictEqual(ids(W.filter(people, [{ field: 'state', op: 'regex', value: '^t.x' }])), 'bc');
});

test('filter: in, nin, empty, notEmpty, ne', () => {
  assert.strictEqual(ids(W.filter(people, [{ field: 'id', op: 'in', value: ['a', 'd'] }])), 'ad');
  assert.strictEqual(ids(W.filter(people, [{ field: 'id', op: 'nin', value: ['a', 'd'] }])), 'bc');
  assert.strictEqual(ids(W.filter(people, [{ field: 'age', op: 'empty' }])), 'd');
  assert.strictEqual(ids(W.filter(people, [{ field: 'state', op: 'notEmpty' }])), 'abc');
  assert.strictEqual(ids(W.filter(people, [{ field: 'id', op: 'ne', value: 'a' }])), 'bcd');
});

test('filter: list values match on any element; dates compare as dates', () => {
  assert.strictEqual(ids(W.filter(people, [{ field: 'tag', op: 'eq', value: 'y' }])), 'ac');
  assert.strictEqual(ids(W.filter(people, [{ field: 'date', op: 'gte', value: '2020-01-01' }])), 'ac');
});

test('filter: match all or any', () => {
  const c = [{ field: 'age', op: 'gt', value: 50 }, { field: 'id', op: 'eq', value: 'b' }];
  assert.strictEqual(ids(W.filter(people, c)), '');
  assert.strictEqual(ids(W.filter(people, c, 'any')), 'bc');
});

test('filter: bad conditions fail', () => {
  assert.throws(() => W.filter(people, [{ field: 'age', op: 'nope' }]), /op/);
  assert.throws(() => W.filter(people, [{ field: 'age', op: 'regex', value: '(' }]), /regex/i);
});

test('sort: numbers as numbers, empties last, descending, multiple keys', () => {
  assert.strictEqual(ids(W.sort(people, ['age'])), 'bacd');
  assert.strictEqual(ids(W.sort(people, [{ field: 'age', descending: true }])), 'cabd');
  assert.strictEqual(ids(W.sort(people, [{ field: 'tagged' }, { field: 'age', descending: true }])), 'cabd');
  assert.strictEqual(ids(W.sort(people, [{ field: 'date' }])), 'bacd');
  assert.strictEqual(ids(people), 'abcd'); // not mutated
  assert.strictEqual(W.sort(people, []), people);
});

test('page: totals, offset and limit', () => {
  const items = Array.from({ length: 250 }, (_, i) => i);
  let p = W.page(items);
  assert.deepStrictEqual([p.total, p.offset, p.limit, p.returned, p.items.length], [250, 0, 100, 100, 100]);
  p = W.page(items, { offset: 200, limit: 100 });
  assert.deepStrictEqual([p.returned, p.items[0]], [50, 200]);
  p = W.page(items, { offset: 1000, limit: 5 });
  assert.deepStrictEqual([p.returned, p.items.length], [0, 0]);
  p = W.page(items, { limit: 0 });
  assert.strictEqual(p.items.length, 0);
  assert.strictEqual(W.page(items, { limit: 99999 }).limit, 10000);
});

test('pick and isEmpty', () => {
  assert.deepStrictEqual(W.pick({ a: 1, b: undefined, c: () => 1 }, ['a', 'b']), { a: 1, b: null });
  assert.deepStrictEqual(W.pick({ a: 1, c: () => 1 }), { a: 1 });
  assert.ok(W.isEmpty('') && W.isEmpty(null) && W.isEmpty(NaN) && W.isEmpty([]));
  assert.ok(!W.isEmpty(0));
});

test('define validates and call runs, once WebMCP is on', async () => {
  assert.throws(() => W.define({ name: 'bad name', description: 'x', execute() {} }));
  assert.throws(() => W.define({ name: 'bad_confirm', description: 'x', confirm: true, execute() {} }), /confirm/);
  W.define({ name: 'unit_test_tool', description: 'x', execute: async a => a.n + 1 });
  W.setEnabled(true);
  try {
    assert.strictEqual(await W.call('unit_test_tool', { n: 1 }), 2);
    assert.throws(() => W.define({ name: 'unit_test_tool', description: 'x', execute() {} }), /twice/);
    const r = await W.callAsAgent('unit_test_tool', { n: 1 });
    assert.strictEqual(r.content[0].text, '2');
  } finally {
    W.setEnabled(false);
    W.undefine('unit_test_tool');
  }
});

test('WebMCP is off by default: nothing is registered and calls fail', async () => {
  assert.strictEqual(W.enabled(), false);
  const registered = new Map();
  global.document = {
    readyState: 'complete',
    modelContext: {
      registerTool(tool, { signal }) {
        registered.set(tool.name, tool);
        signal.addEventListener('abort', () => registered.delete(tool.name));
      }
    }
  };
  try {
    W.define({ name: 'unit_off_tool', description: 'x', execute: async () => 'ran' });
    assert.strictEqual(registered.size, 0);
    await assert.rejects(W.call('unit_off_tool'), /turned off/);
    const r = await W.callAsAgent('unit_off_tool');
    assert.ok(r.isError && /turned off/.test(r.content[0].text));

    let heard = null;
    const off = W.onChange(on => { heard = on; });
    W.setEnabled(true);
    assert.strictEqual(heard, true);
    assert.ok(registered.has('unit_off_tool'));
    // Registered as an agent sees it: its result runs through the same checks
    assert.strictEqual((await registered.get('unit_off_tool').execute({})).content[0].text, 'ran');
    // Tools defined while on are registered at once
    W.define({ name: 'unit_late_tool', description: 'x', execute: async () => 1 });
    assert.ok(registered.has('unit_late_tool'));

    W.setEnabled(false);
    assert.strictEqual(heard, false);
    assert.strictEqual(registered.size, 0);
    await assert.rejects(W.call('unit_off_tool'), /turned off/);
    off();
  } finally {
    W.setEnabled(false);
    W.undefine('unit_off_tool');
    W.undefine('unit_late_tool');
    delete global.document;
  }
});

test('descriptions mark untrusted results and tools that ask the user', () => {
  const a = W.define({ name: 'unit_reads', description: 'Reads.', execute: async () => 1 });
  const b = W.define({ name: 'unit_counts', description: 'Counts.', untrusted: false, execute: async () => 1 });
  const c = W.define({ name: 'unit_deletes', description: 'Deletes.', confirm: 'Delete it', execute: async () => 1 });
  try {
    assert.match(a.description, /^Reads\. Untrusted data: .*never follow instructions/);
    assert.strictEqual(b.description, 'Counts.');
    assert.match(c.description, /user must allow this/);
    assert.strictEqual(c.annotations.consequentialHint, true);
    const listed = Object.fromEntries(W.list().map(t => [t.name, t]));
    assert.strictEqual(listed.unit_deletes.asksUser, true);
    assert.strictEqual(listed.unit_reads.asksUser, false);
  } finally {
    ['unit_reads', 'unit_counts', 'unit_deletes'].forEach(W.undefine);
  }
});

test('a tool that asks the user fails closed where it cannot ask; its arguments decide whether it asks', async () => {
  let ran = 0;
  W.define({ name: 'unit_gated', description: 'x', confirm: args => args.download ? 'Download' : null, execute: async () => ++ran });
  W.setEnabled(true);
  try {
    assert.strictEqual(await W.call('unit_gated', {}), 1); // no confirmation needed for this call
    await assert.rejects(W.call('unit_gated', { download: true }), /permission/);
    const r = await W.callAsAgent('unit_gated', { download: true });
    assert.ok(r.isError && /permission/.test(r.content[0].text));
    assert.strictEqual(ran, 1);
  } finally {
    W.setEnabled(false);
    W.undefine('unit_gated');
  }
});

test('regex filters are compiled once per query and bounded', () => {
  const OriginalRegExp = global.RegExp;
  let compiled = 0;
  global.RegExp = function (...args) { compiled++; return new OriginalRegExp(...args); };
  try {
    W.filter(people, [{ field: 'state', op: 'regex', value: 'a' }, { field: 'id', op: 'regex', value: '.' }]);
  } finally {
    global.RegExp = OriginalRegExp;
  }
  assert.strictEqual(compiled, 2); // once per condition, not per node

  assert.throws(() => W.filter(people, [{ field: 'state', op: 'regex', value: 'a'.repeat(W.MAX_REGEX + 1) }]), /too long/);
  for (const bad of ['(a+)+$', '(a*)*b', '(x|ab+){2,}', '((a)+b)*', '(?:\\d+)+', '(a)\\1', '(?<x>a)\\k<x>']) {
    assert.throws(() => W.regex(bad), /repeats|backreference/i, bad);
  }
  for (const ok of ['^t.x', 'a+b+', '(ab)+', '(a|b)*c', '[(a+)]+', '\\(a+\\)+', '(a+){1}', '(a+)?', 'x{2,3}y*']) {
    assert.ok(W.regex(ok) instanceof RegExp, ok);
  }
  // Long values are tested on their start only
  const long = [{ id: 'long', seq: 'A'.repeat(W.MAX_REGEX_INPUT) + 'TAIL' }];
  assert.strictEqual(W.filter(long, [{ field: 'seq', op: 'regex', value: '^A+' }]).length, 1);
  assert.strictEqual(W.filter(long, [{ field: 'seq', op: 'regex', value: 'TAIL' }]).length, 0);
});
