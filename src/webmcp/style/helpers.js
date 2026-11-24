import { fail } from '../core.js';
import { same } from '../schema.js';

export const T = self.MTWebMCP;

export const S = () => self.MT.settings;

export const W = () => self.session.style.widgets;

const events = () => self.MT.events;

export const readOnly = { readOnlyHint: true };

export const strList = description => ({ type: 'array', items: { type: 'string' }, description });

export const nodes = () => T.requireData().nodes;

const nodeFields = () => self.session.data.nodeFields.slice();

export const linkFields = () => self.session.data.linkFields.slice();

// A node (or link) field name, or None, as the variable menus offer them
export function checkVariable(kind, name, { allowNone = true, what = 'variable' } = {}) {
  T.requireData();
  if (name === 'None' || name === null || name === '') {
    if (!allowNone) fail(what + ' must be a field name, not None');
    return 'None';
  }
  const fields = kind == 'node' ? nodeFields() : linkFields();
  if (!fields.includes(name)) fail('Unknown ' + kind + ' field ' + JSON.stringify(name) + '. Available ' + kind + ' fields: ' + fields.join(', '));
  return name;
}

export const linkFieldNumeric = field => {
  const g = self.session.data.graph;
  if (self.MT.distanceMetrics[field]) return true;
  const col = g.columns.get(field);
  if (col && col.numeric) return true;
  return !!g.denseValues(field);
};

// A color as #rrggbb, from hex or any CSS color name or function
export function toHex(color) {
  if (typeof color != 'string') fail('A color must be text like "#ff8300" or "orange"');
  const c = color.trim();
  if (/^#[0-9a-f]{6}$/i.test(c)) return c.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(c)) return ('#' + c[1] + c[1] + c[2] + c[2] + c[3] + c[3]).toLowerCase();
  const ctx = document.createElement('canvas').getContext('2d');
  ctx.fillStyle = '#010203';
  ctx.fillStyle = c;
  const a = ctx.fillStyle;
  ctx.fillStyle = '#040506';
  ctx.fillStyle = c;
  const b = ctx.fillStyle;
  if (a !== b) fail('Not a color: ' + JSON.stringify(color) + '. Use #rrggbb or a CSS color name.');
  if (!/^#[0-9a-f]{6}$/i.test(a)) fail('Use an opaque color (#rrggbb): ' + JSON.stringify(color) + '. Transparency is set separately.');
  return a.toLowerCase();
}

export function counts() {
  const d = self.session.data, g = d.graph;
  const all = d.nodes;
  return {
    nodes: { total: all.length, visible: all.filter(n => n.visible).length, selected: all.filter(n => n.selected).length },
    links: { total: g ? g.edgeCount : 0, visible: g ? g.visibleCount : 0 },
    clusters: { total: d.clusters.length, visible: d.clusters.filter(c => c.visible).length }
  };
}

const typeOf = v => v === null || v === undefined ? 'null' : Array.isArray(v) ? 'array' : typeof v;

function labelFor(el) {
  const row = el.closest('.form-group, .row');
  let text = '';
  if (row) {
    const label = row.querySelector('label[for]:not(.btn), label:not(.btn)');
    const col = row.querySelector('.col-4');
    text = (label || col || {}).textContent || '';
  }
  text = text.replace(/\s+/g, ' ').trim();
  return text || (row && row.getAttribute('title')) || el.getAttribute('aria-label') || el.getAttribute('title') || '';
}

function viewOf(el) {
  if (el.closest('#global-settings-modal')) return 'global settings';
  if (el.closest('#search-form')) return 'search';
  for (let p = el.parentElement; p; p = p.parentElement) {
    const c = Array.from(p.classList || []).find(c => /-view$/.test(c));
    if (c) return c.replace(/-view$/, '');
  }
  return null;
}

// What the page's controls say about each setting: one entry per key
export function controls() {
  const out = new Map();
  document.querySelectorAll('[data-setting]').forEach(el => {
    const key = el.dataset.setting;
    let info = out.get(key);
    if (!info) {
      info = { control: null, label: labelFor(el), view: viewOf(el) };
      out.set(key, info);
    }
    if (el.tagName === 'SELECT') {
      info.control = el.multiple ? 'multiselect' : 'select';
      info.options = Array.from(el.options).map(o => ({ value: o.value, label: o.textContent.replace(/\s+/g, ' ').trim() }));
    } else if (el.type == 'radio') {
      info.control = 'radio';
      info.options = (info.options || []).concat([{ value: el.value, label: (el.closest('label') ? el.closest('label').textContent : el.value).replace(/\s+/g, ' ').trim() }]);
    } else {
      info.control = el.type || el.tagName.toLowerCase();
      ['min', 'max', 'step'].forEach(a => { if (el.getAttribute(a) !== null && el.getAttribute(a) !== '') info[a] = +el.getAttribute(a); });
    }
  });
  return out;
}

export const allKeys = () => Array.from(new Set(Object.keys(self.MT.defaultWidgets).concat(Object.keys(W())))).sort();

export function describeSetting(key, ctl) {
  const def = self.MT.defaultWidgets[key], value = W()[key];
  const entry = { key, value: value === undefined ? null : value, default: def === undefined ? null : def, type: typeOf(def === null || def === undefined ? value : def), modified: !same(value, def) };
  const c = ctl.get(key);
  if (c) {
    entry.control = c.control;
    if (c.label) entry.label = c.label;
    if (c.view) entry.view = c.view;
    if (c.options) entry.options = c.options;
    ['min', 'max', 'step'].forEach(a => { if (c[a] !== undefined) entry[a] = c[a]; });
  } else if (!(key in self.MT.defaultWidgets)) {
    entry.note = 'Not a standard setting';
  }
  return entry;
}

// The value, checked and coerced to what the setting holds. Returns {value, warnings}.
export function coerce(key, value, ctl) {
  const warnings = [];
  const ref = self.MT.defaultWidgets[key] !== undefined ? self.MT.defaultWidgets[key] : W()[key];
  const c = ctl.get(key);
  const bad = msg => fail(key + ': ' + msg);
  if (ref === null || ref === undefined) return { value, warnings };
  if (typeof ref === 'boolean') {
    if (value === 'true') value = true;
    else if (value === 'false') value = false;
    if (typeof value != 'boolean') bad('expected true or false, got ' + JSON.stringify(value));
  } else if (typeof ref === 'number') {
    if (typeof value === 'string' && value.trim() !== '' && !isNaN(+value)) value = +value;
    if (typeof value != 'number' || !isFinite(value)) bad('expected a number, got ' + JSON.stringify(value));
    if (c && c.min !== undefined && value < c.min) warnings.push(key + ' ' + value + ' is below the control\'s minimum of ' + c.min);
    if (c && c.max !== undefined && value > c.max) warnings.push(key + ' ' + value + ' is above the control\'s maximum of ' + c.max);
  } else if (typeof ref === 'string') {
    if (/tooltip-variable$/.test(key) && Array.isArray(value) && value.every(v => typeof v === 'string')) {
      // (multi-field tooltips)
    } else {
      if (typeof value != 'string') bad('expected text, got ' + JSON.stringify(value));
      if (/^#[0-9a-f]{6}$/i.test(ref)) value = toHex(value);
      else if (c && c.options && c.options.length && (c.control == 'select' || c.control == 'radio') && !c.options.some(o => o.value === value || (o.value === '' && o.label === value))) {
        bad('must be one of ' + c.options.map(o => JSON.stringify(o.value)).join(', '));
      }
    }
  } else if (Array.isArray(ref)) {
    if (!Array.isArray(value)) bad('expected a list');
  } else if (typeof ref === 'object') {
    if (typeof value != 'object' || value === null || Array.isArray(value)) bad('expected an object');
  }
  return { value, warnings };
}

// Settings that drive the network filter: setting them reruns clustering and
// visibility, which finishes a moment later
const FILTER_KEYS = ['link-prune', 'filtering-epsilon', 'link-sort-variable', 'link-threshold', 'cluster-minimum-size'];

function visibilityWaiter(timeout = 120000) {
  let off, timer;
  const promise = new Promise((resolve, reject) => {
    off = events().on('node-visibility', () => { clearTimeout(timer); off(); resolve(); });
    timer = setTimeout(() => { off(); reject(new T.ToolError('Timed out waiting for the network to finish updating')); }, timeout);
  });
  promise.cancel = () => { clearTimeout(timer); off(); };
  promise.catch(() => {});
  return promise;
}

// Sets a setting, and for filter settings waits for the network to update
export async function applySetting(key, value) {
  const old = W()[key];
  if (old === value) return { old, new: value, changed: false };
  if (FILTER_KEYS.includes(key)) {
    const waiter = visibilityWaiter();
    try { S().set(key, value); } catch (e) { waiter.cancel(); throw e; }
    await waiter;
  } else {
    S().set(key, value);
  }
  return { old, new: W()[key], changed: true };
}

// Applies {key: value} in order, returning what changed
export async function applyAll(map) {
  const ctl = controls();
  const changes = {}, warnings = [];
  const prepared = Object.entries(map).filter(([, v]) => v !== undefined).map(([k, v]) => {
    const r = coerce(k, v, ctl);
    warnings.push(...r.warnings);
    return [k, r.value];
  });
  for (const [k, v] of prepared) {
    const r = await applySetting(k, v);
    if (r.changed) changes[k] = { old: r.old, new: r.new };
  }
  return { changes, warnings };
}

const PRIORITY = ['link-prune', 'filtering-epsilon', 'link-sort-variable', 'link-threshold', 'cluster-minimum-size', 'node-timeline-variable'];

export const rank = key => PRIORITY.includes(key) ? PRIORITY.indexOf(key) : /-variable$/.test(key) ? 10 : 20;

function linkValueRange(variable, bins) {
  const g = self.session.data.graph;
  let min = Infinity, max = -Infinity, n = 0, infinite = 0;
  // Saturated distances are Infinity (#281): counted, but not part of the range
  g.forEachValue(variable, v => { v = +v; if (isNaN(v)) return; if (!isFinite(v)) { infinite++; return; } n++; if (v < min) min = v; if (v > max) max = v; });
  if (!n) return infinite ? { count: 0, infinite } : { count: 0 };
  const out = { count: n, min, max };
  if (infinite) out.infinite = infinite;
  if (bins > 0 && max > min) {
    const counts = new Array(bins).fill(0), width = (max - min) / bins;
    g.forEachValue(variable, v => { v = +v; if (isFinite(v)) counts[Math.min(bins - 1, Math.floor((v - min) / width))]++; });
    out.histogram = counts.map((count, i) => ({ from: min + i * width, to: min + (i + 1) * width, count }));
  }
  return out;
}

export function filterState(bins) {
  const w = W(), data = self.session.data;
  const state = {
    linkVariable: w['link-sort-variable'],
    linkThreshold: w['link-threshold'],
    thresholdsByVariable: w['link-thresholds'] || {},
    pruning: w['link-prune'],
    epsilonExponent: w['filtering-epsilon'],
    epsilon: Math.pow(10, w['filtering-epsilon']),
    clusterMinimumSize: w['cluster-minimum-size'],
    timelineVariable: w['node-timeline-variable'],
    counts: counts()
  };
  if (data.nodes.length) {
    state.numericLinkFields = linkFields().filter(linkFieldNumeric).map(f => {
      const metric = self.MT.distanceMetrics[f];
      return metric ? { field: f, label: metric.label, defaultThreshold: metric.threshold, countsSites: !!metric.count } : { field: f };
    });
    state.linkValueRange = data.graph && linkFields().includes(state.linkVariable) ? linkValueRange(state.linkVariable, bins) : null;
    state.largestClusters = data.clusters.slice().sort((a, b) => b.nodes - a.nodes).slice(0, 10)
      .map(c => ({ id: c.id, nodes: c.nodes, links: c.links, visible: c.visible }));
    state.singletons = data.clusters.filter(c => c.nodes == 1).length;
  }
  return state;
}

const iso = v => { const d = self.MT.parseDate(v); return d ? d.toISOString() : null; };

export function timelineState() {
  const variable = W()['node-timeline-variable'];
  const state = { variable, active: variable != 'None' };
  if (state.active) {
    state.start = iso(self.session.state.timeStart);
    state.end = iso(self.session.state.timeEnd);
    state.target = iso(self.session.state.timeTarget);
    state.playing = (document.getElementById('timeline-play-button') || {}).textContent == 'Pause';
    state.barVisible = document.getElementById('global-timeline-wrapper').style.display != 'none';
  }
  state.counts = counts();
  return state;
}

// Node fields with at least two values that read as dates (not plain numbers)
export const dateFields = () => nodeFields().filter(f => {
  let n = 0;
  for (const d of nodes()) {
    const v = d[f];
    if (typeof v === 'string' && isNaN(+v) && self.MT.parseDate(v) && ++n >= 2) return true;
  }
  return false;
});

const MODES = ['replace', 'add', 'remove', 'toggle'];

// Applies a mode to the set of node objects, returning how many nodes changed
export function applySelection(set, mode) {
  let changed = 0;
  nodes().forEach(d => {
    const was = !!d.selected;
    let now = was;
    if (mode == 'replace') now = set.has(d);
    else if (mode == 'add') now = was || set.has(d);
    else if (mode == 'remove') now = was && !set.has(d);
    else if (mode == 'toggle') now = set.has(d) ? !was : was;
    if (now !== was) { d.selected = now; changed++; }
  });
  events().emit('node-selected');
  return changed;
}

export function selectionSummary(limit = 100) {
  const selected = nodes().filter(d => d.selected);
  return {
    selectedCount: selected.length,
    selectedIds: selected.slice(0, limit).map(d => d._id),
    truncated: selected.length > limit,
    counts: counts()
  };
}

export const modeSchema = { type: 'string', enum: MODES, description: 'How the result combines with the current selection: replace (default), add, remove or toggle' };

export const KINDS = {
  node: { variable: 'node-color-variable', fields: nodeFields, table: 'nodeColorsTable', keys: 'nodeColorsTableKeys', alphas: 'nodeAlphas', names: 'nodeValueNames',
    colorMap: 'nodeColorMap', alphaMap: 'nodeAlphaMap', palette: 'nodeColors', create: () => self.MT.createNodeColorMap(), single: 'node-color' },
  link: { variable: 'link-color-variable', fields: linkFields, table: 'linkColorsTable', keys: 'linkColorsTableKeys', alphas: 'linkAlphas', names: 'linkValueNames',
    colorMap: 'linkColorMap', alphaMap: 'linkAlphaMap', palette: 'linkColors', create: () => self.MT.createLinkColorMap(), single: 'link-color' }
};

export function legend(kind) {
  const cfg = KINDS[kind], w = W();
  const variable = w[cfg.variable];
  if (variable == 'None') {
    return {
      kind, variable, singleColor: w[cfg.single],
      opacity: kind == 'link' ? 1 - w['link-opacity'] : 1,
      values: []
    };
  }
  const aggregates = cfg.create();
  const names = self.session.style[cfg.names] || {};
  const total = Object.values(aggregates).reduce((a, b) => a + b, 0);
  const values = Object.keys(aggregates).map(value => ({
    value,
    label: self.MT.valueLabel(value),
    name: names[value] !== undefined ? names[value] : null,
    count: aggregates[value],
    frequency: total ? aggregates[value] / total : 0,
    color: self.temp.style[cfg.colorMap](value),
    opacity: self.temp.style[cfg.alphaMap](value)
  }));
  return { kind, variable, total, valueCount: values.length, values };
}

export function refreshTable(kind) {
  if (typeof self.MT.showColorTable === 'function') self.MT.showColorTable(kind);
  else events().emit(kind + '-color-change');
}

export function result(changes, warnings, extra) {
  return Object.assign({ changes: changes.changes, warnings: changes.warnings.concat(warnings || []) }, extra);
}

export const STYLE_KEYS = {
  nodes: ['node-color-variable', 'node-color', 'node-color-border', 'node-border-width', 'node-radius-variable', 'node-radius', 'node-radius-min', 'node-radius-max',
    'node-symbol-variable', 'node-symbol', 'node-label-variable', 'node-label-size', 'node-label-orientation', 'node-tooltip-variable', 'node-highlight',
    'node-color-table-show', 'node-color-table-counts', 'node-color-table-frequencies', 'node-color-table-name-sort', 'node-color-table-counts-sort',
    'node-symbol-table-show', 'node-symbol-table-counts', 'node-symbol-table-frequencies'],
  links: ['link-color-variable', 'link-color', 'link-opacity', 'link-width-variable', 'link-width', 'link-width-min', 'link-width-max', 'link-label-variable',
    'link-tooltip-variable', 'link-directed', 'link-color-table-show', 'link-color-table-counts', 'link-color-table-frequencies', 'link-color-table-name-sort', 'link-color-table-counts-sort'],
  page: ['selected-color', 'background-color']
};
