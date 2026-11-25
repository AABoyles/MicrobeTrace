// Unit tests for src/charts.js: reading a field's values, sorting them into bins, and
// upgrading sessions saved when the Graph view's types were views of their own (#366).
// Run with: npm test
import test from 'node:test';
import assert from 'node:assert';
import * as d3 from 'd3';

globalThis.d3 = d3;
const { readColumn, binColumn, countGroups, upgradeGraphs, MAX_CATEGORIES, EMPTY } = await import('../../src/charts.js');

const items = values => values.map(v => ({ v }));
const bins = (values, options, read) => binColumn(readColumn(items(values), 'v', read), options);
const sizes = binned => binned.bins.map(b => b.items.length);

test('numbers are read as numbers, with no place for NaN, Infinity or missing ones', () => {
  const column = readColumn(items([0.1, NaN, Infinity, null, undefined, '', 2]), 'v');
  assert.strictEqual(column.kind, 'number');
  assert.deepStrictEqual(column.values, [0.1, null, null, null, null, null, 2]);
  assert.strictEqual(column.whole, false);
  assert.strictEqual(readColumn(items([1, 2, NaN]), 'v').whole, true);
});

test('anything else is read as text, missing values as (Empty)', () => {
  assert.deepStrictEqual(readColumn(items(['a', null, 3, 'null']), 'v'), { kind: 'text', values: ['a', EMPTY, '3', EMPTY] });
  assert.strictEqual(readColumn(items([null, undefined]), 'v').kind, 'text');
});

test('dates are read in their column’s order', () => {
  const { kind, values } = readColumn(items(['13/02/2020', '01/02/2020', 'never']), 'v', { date: true });
  assert.strictEqual(kind, 'date');
  assert.deepStrictEqual(values, [+new Date(2020, 1, 13), +new Date(2020, 1, 1), null]);
});

test('a few whole numbers have a bin each, and every item is in one', () => {
  const binned = bins([0, 0, 1, 3]);
  assert.deepStrictEqual(binned.bins.map(b => b.label), ['0', '1', '2', '3']);
  assert.deepStrictEqual(sizes(binned), [2, 1, 0, 1]);
});

test('other numbers have bins at round numbers, whose ends are all inside one', () => {
  const values = d3.range(500).map(i => i / 499 * 0.015);
  const binned = bins(values.concat([NaN, Infinity]));
  assert.strictEqual(d3.sum(sizes(binned)), 500);
  assert.strictEqual(binned.missing, 2);
  binned.bins.forEach((b, i) => { if (i) assert.strictEqual(b.x0, binned.bins[i - 1].x1); });
  binned.bins.forEach(b => b.items.forEach(i => assert.ok(values[i] >= b.x0 - 1e-12 && values[i] <= b.x1 + 1e-12)));
  assert.ok(binned.bins[0].x0 <= 0 && binned.bins[binned.bins.length - 1].x1 >= 0.015);
});

test('numbers that are all the same, negative, huge or tiny are binned too', () => {
  assert.deepStrictEqual(sizes(bins([0.01, 0.01])), [2]);
  assert.deepStrictEqual(sizes(bins([0, 0])), [2]);
  [[-1.5, 2.25, 0], [1e12, 3e12, 2.5e12], [1e-9, 3e-9, 2.2e-9], [-5, -100.5, -7]].forEach(values => {
    const binned = bins(values);
    assert.strictEqual(d3.sum(sizes(binned)), values.length);
    assert.ok(binned.bins.every(b => b.x1 > b.x0));
    assert.ok(binned.bins.length < 100);
  });
});

test('categories are in natural order, missing ones last, and only the most common of very many are kept', () => {
  assert.deepStrictEqual(bins(['b10', 'b2', null, 'a']).bins.map(b => b.label), ['a', 'b2', 'b10', EMPTY]);
  const many = d3.range(300).map(i => 'v' + i).concat(['v299', 'v299']);
  const binned = bins(many);
  assert.strictEqual(binned.bins.length, MAX_CATEGORIES);
  assert.strictEqual(binned.omitted, 100);
  assert.ok(binned.bins.some(b => b.label === 'v299'));
});

test('numbers are categories where asked for, if there are few', () => {
  assert.deepStrictEqual(bins([0.5, 10, 2, 2], { categories: true }).bins.map(b => b.label), ['0.5', '2', '10']);
  assert.strictEqual(bins(d3.range(100).map(i => i + 0.5), { categories: true }).scale, 'number');
});

test('dates are counted by calendar period, empty ones too', () => {
  const dates = ['2020-01-15', '2020-01-20', '2020-04-01', ''];
  const monthly = bins(dates, { period: 'month' }, { date: true });
  assert.deepStrictEqual(sizes(monthly), [2, 0, 0, 1]);
  assert.strictEqual(monthly.bins[0].label, 'January 2020');
  assert.strictEqual(monthly.missing, 1);
  // Automatically, the shortest with fewer than about 60 bars
  assert.match(bins(dates, {}, { date: true }).bins[0].label, /^Week of /);
  // A day for each of a thousand years is too many
  assert.ok(bins(['1000-01-01', '2020-01-01'], { period: 'day' }, { date: true }).bins.length <= 5000);
  // A period a session file makes up is as if none were chosen
  assert.match(bins(dates, { period: 'constructor' }, { date: true }).bins[0].label, /^Week of /);
});

test('nothing to place makes no bins', () => {
  assert.deepStrictEqual(bins([]).bins, []);
  assert.deepStrictEqual(binColumn({ kind: 'number', values: [null, null] }).bins, []);
});

test('bins are counted by color, the smaller groups first, and cumulatively', () => {
  const binned = bins([0, 0, 0, 1, 1]), group = ['a', 'b', 'b', 'b', 'a'];
  assert.deepStrictEqual(countGroups(binned.bins, i => group[i]), { groups: ['a', 'b'], counts: [[1, 2], [1, 1]], totals: [3, 2] });
  assert.deepStrictEqual(countGroups(binned.bins, i => group[i], { cumulative: true }).counts, [[1, 2], [2, 3]]);
});

const old = extra => ({
  'histogram-axis-x': false, 'histogram-scale-log': true, 'histogram-variable': 'nodes-time-to-death',
  'scatterplot-xVar': 'a', 'scatterplot-yVar': 'b', 'scatterplot-logScale': false, 'scatterplot-showNodes': true,
  'timeline-bin': 'week', 'timeline-date-field': 'onset', 'timeline-noncumulative': false, 'flow-showNodes': 'selected',
  'node-color': '#123456', ...extra
});
const stack = (...types) => ({ type: 'stack', content: types.map(type => ({ type })) });

test('an old session’s histogram, scatterplot and epi curve become graphs, in the order they were open', () => {
  const widgets = old(), layout = { type: 'row', content: [stack('network', 'timeline'), stack('scatterplot')] };
  assert.strictEqual(upgradeGraphs(widgets, layout), true);
  assert.deepStrictEqual(layout, { type: 'row', content: [
    { type: 'stack', content: [{ type: 'network' }, { type: 'graph' }] },
    { type: 'stack', content: [{ type: 'graph', instance: 2 }] }
  ] });
  assert.deepStrictEqual(widgets, {
    'timeline-date-field': 'onset', 'node-color': '#123456', 'sankey-showNodes': true,
    'graph-type': 'histogram', 'graph-data': 'nodes', 'graph-x': 'onset', 'graph-bin': 'week', 'graph-cumulative': true,
    'graph-type@2': 'scatter', 'graph-data@2': 'nodes', 'graph-x@2': 'a', 'graph-y@2': 'b', 'graph-log@2': false
  });
});

test('with none of them open, the histogram’s settings are kept, a hyphen in its variable and all', () => {
  const widgets = old();
  upgradeGraphs(widgets, stack('network'));
  assert.strictEqual(widgets['graph-x'], 'time-to-death');
  assert.strictEqual(widgets['graph-horizontal'], true);
  assert.strictEqual(widgets['graph-log'], true);
});

test('a session saved since is left as it is, as are odd layouts', () => {
  const widgets = { 'graph-type': 'rose', 'timeline-date-field': 'None' }, layout = stack('graph');
  assert.strictEqual(upgradeGraphs(widgets, layout), false);
  assert.deepStrictEqual([widgets, layout], [{ 'graph-type': 'rose', 'timeline-date-field': 'None' }, stack('graph')]);
  assert.strictEqual(upgradeGraphs(null, null), false);
  assert.strictEqual(upgradeGraphs(undefined, 'x'), false);
  upgradeGraphs({}, { type: 'stack', content: [null, 3, { type: 'histogram' }] });
});
