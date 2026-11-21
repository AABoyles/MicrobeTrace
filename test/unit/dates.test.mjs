// Unit tests for src/dates.js (issue #216: missing dates stay missing; issue
// #231: numeric dates are read explicitly, in the order their column is in).
// Run with: node --test test/unit
import test from 'node:test';
import assert from 'node:assert';
import { MTDates } from '../../src/dates.js';

const { parseDate, dateOrderOf, isUndated, countUndated, shownAt } = MTDates;

const day = (y, m, d, h = 0, min = 0) => new Date(y, m - 1, d, h, min).getTime();
const time = (value, order) => { const d = parseDate(value, order); return d && d.getTime(); };

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

test('a column with a first part over 12 is day-first, and is read so', () => {
  const values = ['13/04/2020', '03/04/2020', '05-06-2021', '20.11.2019'];
  assert.deepStrictEqual(dateOrderOf(values), { order: 'dmy', status: 'day-first' });
  assert.strictEqual(time('03/04/2020', 'dmy'), day(2020, 4, 3));
  assert.strictEqual(time('13/04/2020', 'dmy'), day(2020, 4, 13));
  assert.strictEqual(time('05-06-2021', 'dmy'), day(2021, 6, 5));
  assert.strictEqual(time('20.11.2019', 'dmy'), day(2019, 11, 20));
});

test('a column with a second part over 12 is month-first', () => {
  const values = ['03/13/2020', '04/02/2020', '2020-05-01'];
  assert.deepStrictEqual(dateOrderOf(values), { order: 'mdy', status: 'month-first' });
  assert.strictEqual(time('03/04/2020', 'mdy'), day(2020, 3, 4));
  assert.strictEqual(time('03/13/2020', 'mdy'), day(2020, 3, 13));
});

test('a column with both day-first and month-first dates is inconsistent, and read month-first', () => {
  const values = ['13/04/2020', '03/13/2020'];
  assert.deepStrictEqual(dateOrderOf(values), { order: 'mdy', status: 'inconsistent' });
  assert.strictEqual(time('13/04/2020', 'mdy'), null); // month 13 doesn't exist
  assert.strictEqual(time('03/13/2020', 'mdy'), day(2020, 3, 13));
});

test('a column whose dates could go either way is ambiguous, and read month-first as before', () => {
  const values = ['03/04/2020', '05/06/2020', '2020-01-01'];
  assert.deepStrictEqual(dateOrderOf(values), { order: 'mdy', status: 'ambiguous' });
  assert.strictEqual(time('03/04/2020', 'mdy'), day(2020, 3, 4));
  assert.strictEqual(time('03/04/2020'), day(2020, 3, 4)); // the default
});

test('dates with the same number in both places, or no slashed dates, are not ambiguous', () => {
  assert.deepStrictEqual(dateOrderOf(['03/03/2020', '2020-03-14', 'unknown']), { order: 'mdy', status: 'none' });
  assert.deepStrictEqual(dateOrderOf(['2020/03/04', '2020/05/06']), { order: 'mdy', status: 'none' });
});

test('two-digit years are 00-69 as 2000s and 70-99 as 1900s, four-digit years as written', () => {
  assert.strictEqual(time('4/3/20', 'dmy'), day(2020, 3, 4));
  assert.strictEqual(time('01/01/69'), day(2069, 1, 1));
  assert.strictEqual(time('01/01/70'), day(1970, 1, 1));
  assert.strictEqual(time('01/01/99'), day(1999, 1, 1));
  assert.strictEqual(time('01/01/1969'), day(1969, 1, 1));
  assert.strictEqual(time('01/01/202'), null); // a three-digit year is neither form
});

test('numeric dates with separators read as written, and impossible ones are unreadable', () => {
  assert.strictEqual(time('2020/3/4'), day(2020, 3, 4));
  assert.strictEqual(time('13-04-2020', 'dmy'), day(2020, 4, 13));
  assert.strictEqual(time('03/04/2020 14:30'), day(2020, 3, 4, 14, 30));
  assert.strictEqual(time('31/04/2020', 'dmy'), null);
  assert.strictEqual(time('02/30/2020'), null);
  assert.strictEqual(time('29/02/2021', 'dmy'), null);
  assert.strictEqual(time('1/2/3'), null); // not left to the engine to guess
});

test('existing forms and month names still read', () => {
  assert.strictEqual(time('2020-03'), day(2020, 3, 1));
  assert.notStrictEqual(time('2020-03-14T10:00:00Z'), null);
  assert.strictEqual(time('January 4, 2020'), day(2020, 1, 4));
});

test('countUndated counts with the column order', () => {
  const nodes = [{ d: '13/04/2020' }, { d: '03/13/2020' }, { d: 'unknown' }];
  assert.strictEqual(countUndated(nodes, 'd', 'dmy'), 2); // 03/13 isn't a day-first date
  assert.strictEqual(countUndated(nodes, 'd', 'mdy'), 2);
  assert.strictEqual(countUndated([{ d: '13/04/2020' }], 'd', 'dmy'), 0);
});
