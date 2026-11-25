// @ts-check
// What the Graph view draws, apart from the drawing (#366): a field's values read
// as numbers, dates or text, sorted into bins or categories, and counted by color.
// Nothing here touches the page. It also upgrades sessions saved when the histogram,
// the scatterplot and the epi curve were views of their own.
import { MTDates } from './dates.js';

// The most categories and colors of one chart; past these the least common are
// left out, and the chart says how many
export const MAX_CATEGORIES = 200;
// The most distinct numbers drawn as categories where a chart asks for them
const MAX_NUMBERS = 50;

export const EMPTY = '(Empty)';
const isEmpty = v => v === undefined || v === null || v === '' || v === 'null' || v === 'undefined';
export const labelOf = v => isEmpty(v) ? EMPTY : String(v);

// Values in natural order (2 before 10), missing ones last
export const natural = (a, b) => Number(a === EMPTY) - Number(b === EMPTY) || a.localeCompare(b, undefined, { numeric: true });

// Reads a field of some items: its kind (number, date or text), and a value for
// each item, which for numbers and dates (as times) is null where there's none to
// place. A number may be missing, NaN (no comparable sites) or Infinity (saturated).
export function readColumn(items, field, { date = false } = {}) {
  const raw = items.map(d => d[field]);
  if (date) {
    const { order } = MTDates.dateOrderOf(raw);
    return { kind: 'date', values: raw.map(v => { const time = MTDates.parseDate(v, order); return time ? +time : null; }) };
  }
  const present = raw.filter(v => !isEmpty(v));
  if (present.length && present.every(v => typeof v === 'number')) {
    const values = raw.map(v => typeof v === 'number' && isFinite(v) ? v : null);
    return { kind: 'number', values, whole: values.every(v => v === null || Number.isInteger(v)) };
  }
  return { kind: 'text', values: raw.map(labelOf) };
}

// The calendar periods bars can count, each with how its dates read
const day = '%Y-%m-%d';
export const periods = () => ({
  day: { interval: d3.timeDay, format: day, name: d3.timeFormat(day) },
  week: { interval: d3.timeMonday, format: day, name: d => 'Week of ' + d3.timeFormat(day)(d) },
  month: { interval: d3.timeMonth, format: '%Y-%m', name: d3.timeFormat('%B %Y') },
  year: { interval: d3.timeYear, format: '%Y', name: d3.timeFormat('%Y') }
});
// The one chosen, or else the shortest that makes no more than about 60 bars
export function periodOf(chosen, [first, last]) {
  const all = periods();
  if (Object.hasOwn(all, chosen)) return all[chosen];
  return Object.values(all).find(p => p.interval.count(new Date(first), new Date(last)) < 60) || all.year;
}

const round = v => +v.toPrecision(6);

// Where numbers' bins start and end: one for each whole number where those are
// few, or else round numbers
function edges(values) {
  const [min, max] = d3.extent(values);
  if (min === max) {
    const half = Math.abs(min) * 0.05 || 0.5;
    return [min - half, max + half];
  }
  if (max - min <= MAX_NUMBERS && values.every(Number.isInteger)) return d3.range(min - 0.5, max + 1);
  const count = Math.max(10, Math.min(40, Math.ceil(Math.sqrt(values.length))));
  const step = d3.tickIncrement(min, max, count);
  // (A negative increment is one over the step)
  const at = i => step < 0 ? i / -step : i * step;
  const from = Math.floor(step < 0 ? min * -step : min / step), to = Math.ceil(step < 0 ? max * -step : max / step);
  // The last bin holds the greatest value too
  return d3.range(from, Math.max(to, from + 1) + 1).map(at);
}

// Sorts a column's values into the bars of a chart. Numbers and dates go into bins
// along a scale, and text into categories; with `categories`, so do numbers, if
// there are few. Each bin has a label, the indices of its items, and if it's a span
// of a scale, its ends x0 and x1. `missing` items have no value to place, and
// `omitted` values are past the most categories drawn.
export function binColumn({ kind, values }, { categories = false, period = 'auto' } = {}) {
  const placed = [];
  values.forEach((v, i) => { if (v !== null) placed.push(i); });
  const missing = values.length - placed.length;
  const empty = { kind, scale: kind === 'text' ? 'band' : kind, bins: [], missing, omitted: 0, period: null };
  if (!placed.length) return empty;

  const distinct = kind === 'number' && categories ? new Set(placed.map(i => values[i])).size : 0;
  if (kind === 'text' || (distinct && distinct <= MAX_NUMBERS)) {
    const byValue = new Map();
    placed.forEach(i => {
      const label = labelOf(values[i]);
      if (!byValue.has(label)) byValue.set(label, []);
      byValue.get(label).push(i);
    });
    let labels = Array.from(byValue.keys());
    const omitted = Math.max(0, labels.length - MAX_CATEGORIES);
    if (omitted) labels = labels.sort((a, b) => byValue.get(b).length - byValue.get(a).length).slice(0, MAX_CATEGORIES);
    return { ...empty, scale: 'band', omitted, bins: labels.sort(natural).map(label => ({ label, items: byValue.get(label) })) };
  }

  let ends, name, chosen = null;
  if (kind === 'date') {
    const [first, last] = d3.extent(placed, i => values[i]);
    chosen = periodOf(period, [first, last]);
    const start = chosen.interval.floor(new Date(first)), stop = chosen.interval.offset(chosen.interval.floor(new Date(last)), 1);
    // A period much too short for the dates is drawn in longer ones
    if (chosen.interval.count(start, stop) > 5000) return binColumn({ kind, values }, { period: 'auto' });
    ends = chosen.interval.range(start, stop).concat(stop).map(Number);
    name = (x0) => chosen.name(new Date(x0));
  } else {
    ends = edges(placed.map(i => values[i]));
    const whole = ends[1] - ends[0] === 1 && !Number.isInteger(ends[0]);
    name = (x0, x1) => whole ? String(x0 + 0.5) : `${round(x0)} to ${round(x1)}`;
  }
  const bins = d3.range(ends.length - 1).map(b => ({ label: name(ends[b], ends[b + 1]), x0: ends[b], x1: ends[b + 1], items: [] }));
  // Each bin holds its lower end, and the last its upper end too
  placed.forEach(i => bins[Math.min(bins.length - 1, Math.max(0, d3.bisectRight(ends, values[i]) - 1))].items.push(i));
  return { ...empty, bins, period: chosen };
}

// Counts each bin's items by color group: the groups, smallest first (so they stack
// at the bottom, #242), and for each bin its count of each group. Cumulative counts
// include the bins before.
export function countGroups(bins, groupOf, { cumulative = false } = {}) {
  const totals = new Map();
  const counts = bins.map(bin => {
    const of = new Map();
    bin.items.forEach(i => {
      const group = groupOf(i);
      of.set(group, (of.get(group) || 0) + 1);
      totals.set(group, (totals.get(group) || 0) + 1);
    });
    return of;
  });
  const groups = Array.from(totals.keys()).sort((a, b) => totals.get(a) - totals.get(b) || natural(a, b));
  const running = groups.map(() => 0);
  const table = counts.map(of => groups.map((group, g) => {
    const n = of.get(group) || 0;
    running[g] += n;
    return cumulative ? running[g] : n;
  }));
  return { groups, counts: table, totals: table.map(row => d3.sum(row)) };
}

// Upgrading saved sessions --------------------------------------------------------

const OLD_VIEWS = ['histogram', 'scatterplot', 'timeline'];
const RETIRED = /^(histogram|scatterplot)-|^timeline-(bin|noncumulative)$|^flow-/;

// The Graph settings that draw what an old view drew with its settings
const converted = {
  histogram(w) {
    const [source, ...rest] = String(w['histogram-variable'] || '').split('-');
    return { type: 'histogram', data: source === 'nodes' ? 'nodes' : 'links', x: rest.join('-') || null,
      horizontal: w['histogram-axis-x'] === false, log: w['histogram-scale-log'] === true };
  },
  scatterplot: w => ({ type: 'scatter', data: w['scatterplot-showNodes'] ? 'nodes' : 'links',
    x: w['scatterplot-xVar'] || null, y: w['scatterplot-yVar'] || null, log: w['scatterplot-logScale'] === true }),
  timeline(w) {
    const field = w['timeline-date-field'];
    return { type: 'histogram', data: 'nodes', x: field && field !== 'None' ? field : null,
      bin: w['timeline-bin'] || 'auto', cumulative: w['timeline-noncumulative'] === false };
  }
};

// Upgrades, in place, a session saved when the histogram, the scatterplot and the epi
// curve were views of their own, and the Sankey diagram was the flow diagram: its
// layout (as saved by MT.cacheLayout) opens a Graph for each, and its settings
// (session.style.widgets) become those Graphs'. Run before anything subscribes.
/* eslint-disable no-restricted-syntax -- session upgrade (#366) */
export function upgradeGraphs(widgets, layout) {
  const open = [];
  const visit = item => {
    if (!item || typeof item !== 'object') return;
    if (Array.isArray(item.content)) return item.content.forEach(visit);
    if (!OLD_VIEWS.includes(item.type) || open.includes(item.type)) return;
    open.push(item.type);
    item.type = 'graph';
    if (open.length > 1) item.instance = open.length;
  };
  visit(layout);
  if (!widgets || !Object.keys(widgets).some(key => RETIRED.test(key))) return false;
  // With none of them open, the histogram's settings are kept for the next Graph
  (open.length ? open : ['histogram']).forEach((view, i) => {
    Object.entries(converted[view](widgets)).forEach(([key, value]) => {
      widgets['graph-' + key + (i ? '@' + (i + 1) : '')] = value;
    });
  });
  if (widgets['flow-showNodes'] !== undefined) widgets['sankey-showNodes'] = !!widgets['flow-showNodes'];
  Object.keys(widgets).filter(key => RETIRED.test(key)).forEach(key => delete widgets[key]);
  return true;
}
/* eslint-enable no-restricted-syntax */
