// Unit tests for src/dates.js (issue #216: missing dates stay missing).
// Run with: node --test test/unit
const test = require('node:test');
const assert = require('node:assert');
const { parseDate, isUndated, countUndated, shownAt } = require('../../src/dates.js');

test('parseDate reads dates and returns null for anything else', () => {
  assert.strictEqual(parseDate('2020-03-14').getTime(), new Date(2020, 2, 14).getTime());
  assert.strictEqual(parseDate('2020').getTime(), new Date(2020, 0, 1).getTime());
  assert.strictEqual(parseDate('20200314').getTime(), new Date(2020, 2, 14).getTime());
  assert.strictEqual(parseDate('2020-02-31'), null);
  for (const v of [null, undefined, '', 'unknown', 'N/A', new Date('x')]) assert.strictEqual(parseDate(v), null);
});

test('isUndated is true for empty, absent and unreadable values', () => {
  for (const v of [null, undefined, '', 'unknown']) assert.strictEqual(isUndated(v), true);
  assert.strictEqual(isUndated('2020-01-01'), false);
});

test('countUndated counts without changing the nodes', () => {
  const nodes = [{ d: '2020-01-01' }, { d: null }, { d: '' }, {}, { d: 'n/a' }];
  const before = JSON.stringify(nodes);
  assert.strictEqual(countUndated(nodes, 'd'), 4);
  assert.strictEqual(JSON.stringify(nodes), before);
  assert.strictEqual(nodes[1].d, null); // not filled with the earliest date
});

test('shownAt hides only nodes dated after the end; undated ones stay', () => {
  const end = new Date(2020, 5, 1);
  assert.strictEqual(shownAt('2020-01-01', end), true);
  assert.strictEqual(shownAt('2020-06-01', end), true);
  assert.strictEqual(shownAt('2020-07-01', end), false);
  for (const v of [null, undefined, '', 'unknown']) assert.strictEqual(shownAt(v, end), true);
  assert.strictEqual(shownAt('2021-01-01', null), true); // no end: nothing hidden
});
