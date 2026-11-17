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

test('define validates and call runs', async () => {
  assert.throws(() => W.define({ name: 'bad name', description: 'x', execute() {} }));
  W.define({ name: 'unit_test_tool', description: 'x', execute: async a => a.n + 1 });
  assert.strictEqual(await W.call('unit_test_tool', { n: 1 }), 2);
  assert.throws(() => W.define({ name: 'unit_test_tool', description: 'x', execute() {} }), /twice/);
  const r = await W.callAsAgent('unit_test_tool', { n: 1 });
  assert.strictEqual(r.content[0].text, '2');
  W.undefine('unit_test_tool');
});
