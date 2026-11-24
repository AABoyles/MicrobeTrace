import { fail, requireData, pick, filter, sort, schemas } from '../core.js';

export const W = self.MTWebMCP;

export const RO = { readOnlyHint: true };

export const MT_ = () => self.MT;

export const session_ = () => self.session;

export const settings = () => (session_() && session_().style && session_().style.widgets) || {};

export const graph = () => requireData().graph;

const IMPLICIT = 2 ** 31;

export const MAX_ALL_EDGES = 4e6;

// Field names MicrobeTrace keeps for itself, or that identify items
const INTERNAL = ['index', '_id', 'id', 'selected', 'visible', 'origin', 'seq', 'source', 'target', 'nn', 'directed', 'degree', 'cluster', 'x', 'y', 'fx', 'fy', 'vx', 'vy', 'fixed', 'preFixed'];

export const isInternal = f => INTERNAL.includes(f) || f[0] == '_';

export const isEmpty = W.isEmpty;

export const clip = (s, n) => typeof s === 'string' && n && s.length > n ? s.slice(0, n) + '…(' + s.length + ' long)' : s;

export const round = (x, d = 6) => typeof x === 'number' && isFinite(x) ? Math.round(x * 10 ** d) / 10 ** d : x;

const label = v => v === undefined || v === null || v === '' ? '(Empty)' : Array.isArray(v) ? v.join(', ') : v instanceof Date ? v.toISOString() : '' + v;

export const P = schemas.page;

export const nodeSelectProps = {
  filter: schemas.filter,
  match: schemas.match,
  visibleOnly: { type: 'boolean', description: 'Only nodes currently shown (not hidden by the cluster-size, link-threshold or timeline filters). Default false.' },
  selectedOnly: { type: 'boolean', description: 'Only nodes currently selected. Default false.' },
  ids: { type: 'array', items: { type: 'string' }, description: 'Only these node IDs' }
};

export const scopeSchema = { type: 'string', enum: ['visible', 'all'], description: '"visible" (default): the links currently shown under the link threshold and cluster filters. "all": every link, including ones above the threshold.' };

export function selectNodes(args) {
  const data = requireData();
  let nodes = data.nodes;
  if (args.ids && args.ids.length) {
    const wanted = new Set(args.ids.map(String));
    const missing = args.ids.filter(id => !(data.nodeIndex && data.nodeIndex.has('' + id)) && !nodes.some(n => n._id == id));
    if (missing.length) fail('No node has the ID ' + missing.slice(0, 5).map(m => JSON.stringify(m)).join(', ') + (missing.length > 5 ? ' (and ' + (missing.length - 5) + ' more)' : ''));
    nodes = nodes.filter(n => wanted.has('' + n._id));
  }
  if (args.visibleOnly) nodes = nodes.filter(n => n.visible);
  if (args.selectedOnly) nodes = nodes.filter(n => n.selected);
  return filter(nodes, args.filter, args.match);
}

// A plain, JSON-friendly copy of a node. sequences: 'none' (default: gives
// seq_length instead), 'truncated' or 'full'.
export function nodeOut(node, { fields, sequences = 'none', maxSequenceLength = 60 } = {}) {
  const names = fields && fields.length ? fields : Object.keys(node).filter(k => k != 'seq' && typeof node[k] != 'function');
  const out = {};
  names.forEach(f => {
    let v = node[f];
    if (f == 'seq') {
      if (sequences == 'none') return;
      v = sequences == 'truncated' ? clip(v, maxSequenceLength) : v;
    }
    out[f] = v === undefined ? null : v instanceof Date ? v.toISOString() : v;
  });
  if ((!fields || !fields.length || fields.includes('seq_length')) && sequences == 'none') out.seq_length = typeof node.seq === 'string' ? node.seq.length : 0;
  return out;
}

export const seqProps = {
  fields: { type: 'array', items: { type: 'string' }, description: 'Node fields to return (default: all except seq; use list_fields to see them). Include "seq" to get the sequence.' },
  sequences: { type: 'string', enum: ['none', 'truncated', 'full'], description: 'How to return the sequence: "none" (default; just seq_length), "truncated" (first maxSequenceLength characters) or "full". Applies when fields is omitted or includes "seq".' },
  maxSequenceLength: { type: 'integer', minimum: 1, description: 'Characters kept by sequences="truncated" (default 60)' }
};

export function visibleSet() {
  const g = graph();
  return new Set(g.visible.subarray(0, g.visibleCount));
}

// The value of a link field for edge e, without building the link object
export function linkReader() {
  const g = graph();
  let vis;
  return (e, field) => {
    switch (field) {
      case 'index': return e;
      case 'source': return g.ids[g.source(e)];
      case 'target': return g.ids[g.target(e)];
      case 'origin': return g.origins(e);
      case 'nn': return !!(g.getFlags(e) & 1);
      case 'directed': return !!(g.getFlags(e) & 2);
      case 'visible': return (vis || (vis = visibleSet())).has(e);
      case 'cluster': return g.nodeCluster ? g.nodeCluster[g.source(e)] : 1;
      default: return g.getValue(e, field);
    }
  };
}

export function edgeList(scope) {
  const g = graph();
  if (scope == 'all') {
    if (g.edgeCount > MAX_ALL_EDGES) fail('There are ' + g.edgeCount.toLocaleString() + ' links in all; use scope "visible" or restrict by nodes.');
    const out = [];
    g.forEachEdge(e => out.push(e));
    return out;
  }
  return Array.from(g.visible.subarray(0, g.visibleCount));
}

export const linkFieldNames = () => {
  const d = requireData();
  return Array.from(new Set(d.linkFields.concat(Array.from(d.graph.columns.keys()))));
};

// Applies filter and sort (reading only the fields they need), returning edges
export function filterSortEdges(edges, args) {
  const conditions = args.filter || [], by = args.sort ? [].concat(args.sort).map(s => typeof s === 'string' ? { field: s } : s) : [];
  if (!conditions.length && !by.length) return edges;
  const read = linkReader();
  const fields = Array.from(new Set(conditions.map(c => c.field).concat(by.map(s => s.field))));
  const known = new Set(linkFieldNames());
  fields.forEach(f => { if (!known.has(f)) fail('Unknown link field ' + JSON.stringify(f) + '. Link fields: ' + Array.from(known).join(', ')); });
  let light = edges.map(e => { const o = { _e: e }; fields.forEach(f => { o[f] = read(e, f); }); return o; });
  light = filter(light, conditions, args.match);
  light = sort(light, by);
  return light.map(o => o._e);
}

export function linkOut(e, fields, vis) {
  const MT = MT_();
  const link = MT.linkObject(e, vis ? vis.has(e) : undefined);
  return fields && fields.length ? pick(link, fields) : link;
}

// Adjacency over links: arrays of neighbors and edges per node index
export function adjacency(scope, weightField) {
  const g = graph();
  const edges = edgeList(scope == 'all' ? 'all' : 'visible');
  const nbr = new Array(g.nodeCount), eds = new Array(g.nodeCount);
  for (let i = 0; i < g.nodeCount; i++) { nbr[i] = []; eds[i] = []; }
  edges.forEach(e => {
    const s = g.source(e), t = g.target(e);
    nbr[s].push(t); eds[s].push(e);
    nbr[t].push(s); eds[t].push(e);
  });
  return { nbr, eds, count: edges.length, g };
}

class Stop {}

// The values of a field across nodes, links or clusters: { values, items, sampled }
export function fieldValues(entity, field, { visibleOnly = false, limit = 2e6 } = {}) {
  const data = requireData();
  if (entity == 'node') {
    let nodes = data.nodes;
    if (visibleOnly) nodes = nodes.filter(n => n.visible);
    return { values: nodes.map(n => n[field]), items: nodes.length, sampled: false };
  }
  if (entity == 'cluster') {
    let clusters = data.clusters;
    if (visibleOnly) clusters = clusters.filter(c => c.visible);
    return { values: clusters.map(c => c[field]), items: clusters.length, sampled: false };
  }
  const g = data.graph, read = linkReader();
  const values = [];
  let sampled = false;
  let items;
  const column = g.columns.has(field) || g.denseValues(field);
  if (visibleOnly) {
    items = g.visibleCount;
    for (let x = 0; x < g.visibleCount; x++) {
      if (values.length >= limit) { sampled = true; break; }
      values.push(read(g.visible[x], field));
    }
  } else if (column) {
    items = g.edgeCount;
    try {
      g.forEachValue(field, v => { if (values.length >= limit) throw new Stop(); values.push(v); });
    } catch (e) { if (e instanceof Stop) sampled = true; else throw e; }
    // forEachValue skips edges without a value
    if (!sampled) for (let i = values.length; i < items; i++) values.push(null);
  } else {
    items = g.edgeCount;
    try {
      let n = 0;
      g.forEachEdge(e => { if (n++ >= limit) throw new Stop(); values.push(read(e, field)); });
    } catch (e) { if (e instanceof Stop) sampled = true; else throw e; }
  }
  return { values, items, sampled };
}

export const entityFields = entity => {
  const d = requireData();
  return entity == 'node' ? d.nodeFields.slice() : entity == 'cluster' ? (d.clusterFields || Object.keys(d.clusters[0] || {})) : linkFieldNames();
};

export const quantile = (sorted, p) => {
  if (!sorted.length) return null;
  const i = (sorted.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
};

const asTime = v => {
  const MT = MT_();
  const d = MT.parseDate(v);
  return d ? d.getTime() : NaN;
};

// The kind of data in a list of values (empties excluded)
export function inferType(values, field) {
  if (field == 'seq') return 'sequence';
  if (!values.length) return 'empty';
  if (values.every(v => typeof v === 'boolean')) return 'boolean';
  if (values.some(v => Array.isArray(v))) return 'list';
  if (values.every(v => typeof v === 'number' && isFinite(v))) return 'numeric';
  if (values.every(v => MT_().isDate(v))) return 'date';
  if (values.every(v => typeof v === 'string' && v.trim() !== '' && isFinite(+v)) && values.length > 1) return 'numeric-text';
  const distinct = new Set(values).size;
  return distinct <= 20 ? 'categorical' : 'text';
}

export function summarizeValues(values, { field, top = 20, bins = 10 } = {}) {
  let present = values.filter(v => !isEmpty(v) && !(typeof v === 'string' && v === 'null'));
  // Saturated distances are Infinity (#281): they'd make the field non-numeric
  // and the histogram infinitely wide, so they're counted apart
  const infinite = present.filter(v => typeof v === 'number' && (v === Infinity || v === -Infinity)).length;
  if (infinite) present = present.filter(v => !(typeof v === 'number' && (v === Infinity || v === -Infinity)));
  const type = inferType(present, field);
  const out = { type, count: present.length, empty: values.length - present.length - infinite };
  if (infinite) out.infinite = infinite;
  if (type == 'sequence') {
    const lengths = present.map(s => String(s).length).sort((a, b) => a - b);
    out.length = { min: lengths[0] ?? null, max: lengths[lengths.length - 1] ?? null, median: quantile(lengths, 0.5) };
    return out;
  }
  if (type == 'numeric' || type == 'numeric-text') {
    const nums = Float64Array.from(present, Number).sort();
    const n = nums.length;
    let sum = 0;
    for (let i = 0; i < n; i++) sum += nums[i];
    const mean = sum / n;
    let ss = 0;
    for (let i = 0; i < n; i++) ss += (nums[i] - mean) ** 2;
    out.distinct = new Set(nums).size;
    out.min = nums[0]; out.max = nums[n - 1]; out.sum = round(sum); out.mean = round(mean);
    out.median = quantile(nums, 0.5);
    out.stdev = n > 1 ? round(Math.sqrt(ss / (n - 1))) : 0;
    out.quantiles = { p5: quantile(nums, 0.05), p25: quantile(nums, 0.25), p50: quantile(nums, 0.5), p75: quantile(nums, 0.75), p95: quantile(nums, 0.95) };
    const lo = nums[0], hi = nums[n - 1], b = Math.max(1, Math.min(bins | 0 || 10, 200));
    const width = (hi - lo) / b || 1;
    const hist = Array.from({ length: b }, (_, i) => ({ from: round(lo + i * width), to: round(lo + (i + 1) * width), count: 0 }));
    for (let i = 0; i < n; i++) hist[Math.min(b - 1, Math.floor((nums[i] - lo) / width))].count++;
    out.histogram = hist;
    return out;
  }
  if (type == 'date') {
    const times = present.map(asTime).filter(t => !isNaN(t)).sort((a, b) => a - b);
    const iso = t => new Date(t).toISOString().slice(0, 10);
    out.distinct = new Set(present.map(v => v instanceof Date ? v.getTime() : String(v))).size;
    out.min = times.length ? iso(times[0]) : null;
    out.max = times.length ? iso(times[times.length - 1]) : null;
    out.median = times.length ? iso(quantile(times, 0.5)) : null;
    if (times.length) {
      const b = Math.max(1, Math.min(bins | 0 || 10, 200)), lo = times[0], width = (times[times.length - 1] - lo) / b || 1;
      const hist = Array.from({ length: b }, (_, i) => ({ from: iso(lo + i * width), to: iso(lo + (i + 1) * width), count: 0 }));
      times.forEach(t => { hist[Math.min(b - 1, Math.floor((t - lo) / width))].count++; });
      out.histogram = hist;
    }
    return out;
  }
  // categorical, text, boolean, list: counts of each value
  const counts = new Map();
  present.forEach(v => (Array.isArray(v) ? v : [v]).forEach(x => { const k = label(x); counts.set(k, (counts.get(k) || 0) + 1); }));
  out.distinct = counts.size;
  const rows = Array.from(counts, ([value, count]) => ({ value, count, fraction: round(count / present.length, 4) })).sort((a, b) => b.count - a.count || String(a.value).localeCompare(String(b.value)));
  out.values = rows.slice(0, top);
  if (rows.length > top) out.otherValues = rows.length - top;
  return out;
}

export function neighborsOf(ids, depth, scope, link) {
  const { nbr, eds, g, count } = adjacency(scope);
  const out = [];
  ids.forEach(id => {
    const start = g.index.get('' + id);
    if (start === undefined) fail('No node has the ID ' + JSON.stringify(id));
    const seen = new Map([[start, { depth: 0, via: null, edge: null }]]);
    let frontier = [start];
    for (let d = 1; d <= depth && frontier.length; d++) {
      const next = [];
      frontier.forEach(x => nbr[x].forEach((y, i) => {
        if (seen.has(y)) return;
        seen.set(y, { depth: d, via: x, edge: eds[x][i] });
        next.push(y);
      }));
      frontier = next;
    }
    seen.delete(start);
    out.push({ id: '' + id, neighbors: Array.from(seen, ([y, r]) => ({ id: g.ids[y], depth: r.depth, via: g.ids[r.via], edge: r.edge })) });
  });
  return out;
}

export function neighborRows(rows, { scope, includeNode, nodeFields, linkFields, limit }) {
  const MT = MT_(), data = requireData(), vis = visibleSet();
  return rows.map(r => {
    const total = r.neighbors.length;
    const list = r.neighbors.slice(0, limit).map(n => {
      const o = { id: n.id, depth: n.depth };
      if (n.depth > 1) o.via = n.via;
      o.link = linkFieldsOf(n.edge, linkFields, vis);
      if (includeNode) o.node = nodeOut(data.nodeIndex.get(n.id) || data.nodes.find(x => x._id == n.id), { fields: nodeFields });
      return o;
    });
    return { id: r.id, total, returned: list.length, neighbors: list };
  });
}

function linkFieldsOf(e, fields, vis) { return linkOut(e, fields, vis); }

export const groupKey = (node, fields) => fields.map(f => label(node[f]));
