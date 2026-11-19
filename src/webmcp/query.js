(function(self){
  'use strict';

  // WebMCP tools for reading and analysing the loaded network. Everything here is
  // read-only: it never changes the data, the settings or the views.
  //
  // Nodes are session.data.nodes (plain objects). Links live in the graph
  // (session.data.graph, src/graph.js) and are only turned into objects for the
  // links a tool returns; filtering and sorting read the graph's columns.

  const W = self.MTWebMCP;
  if (!W) return;
  const { fail, requireData, nodeById, pick, filter, sort, page, schemas } = W;
  const RO = { readOnlyHint: true };

  const MT_ = () => self.MT;
  const session_ = () => self.session;
  const settings = () => (session_() && session_().style && session_().style.widgets) || {};

  const hasData = () => !!(session_() && session_().data && session_().data.nodes.length);
  const graph = () => requireData().graph;
  const IMPLICIT = 2 ** 31;
  const MAX_ALL_EDGES = 4e6;

  // Field names MicrobeTrace keeps for itself, or that identify items
  const INTERNAL = ['index', '_id', 'id', 'selected', 'visible', 'origin', 'seq', 'source', 'target', 'nn', 'directed', 'degree', 'cluster', 'x', 'y', 'fx', 'fy', 'vx', 'vy', 'fixed', 'preFixed'];
  const isInternal = f => INTERNAL.includes(f) || f[0] == '_';

  const isEmpty = W.isEmpty;
  const clip = (s, n) => typeof s === 'string' && n && s.length > n ? s.slice(0, n) + '…(' + s.length + ' long)' : s;
  const round = (x, d = 6) => typeof x === 'number' && isFinite(x) ? Math.round(x * 10 ** d) / 10 ** d : x;
  const label = v => v === undefined || v === null || v === '' ? '(Empty)' : Array.isArray(v) ? v.join(', ') : v instanceof Date ? v.toISOString() : '' + v;

  // Shared schema pieces ----------------------------------------------------

  const P = schemas.page;
  const nodeSelectProps = {
    filter: schemas.filter,
    match: schemas.match,
    visibleOnly: { type: 'boolean', description: 'Only nodes currently shown (not hidden by the cluster-size, link-threshold or timeline filters). Default false.' },
    selectedOnly: { type: 'boolean', description: 'Only nodes currently selected. Default false.' },
    ids: { type: 'array', items: { type: 'string' }, description: 'Only these node IDs' }
  };
  const scopeSchema = { type: 'string', enum: ['visible', 'all'], description: '"visible" (default): the links currently shown under the link threshold and cluster filters. "all": every link, including ones above the threshold.' };

  // Nodes ------------------------------------------------------------------

  function selectNodes(args) {
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
  function nodeOut(node, { fields, sequences = 'none', maxSequenceLength = 60 } = {}) {
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

  const seqProps = {
    fields: { type: 'array', items: { type: 'string' }, description: 'Node fields to return (default: all except seq; use list_fields to see them). Include "seq" to get the sequence.' },
    sequences: { type: 'string', enum: ['none', 'truncated', 'full'], description: 'How to return the sequence: "none" (default; just seq_length), "truncated" (first maxSequenceLength characters) or "full". Applies when fields is omitted or includes "seq".' },
    maxSequenceLength: { type: 'integer', minimum: 1, description: 'Characters kept by sequences="truncated" (default 60)' }
  };

  // Links -----------------------------------------------------------------

  function visibleSet() {
    const g = graph();
    return new Set(g.visible.subarray(0, g.visibleCount));
  }

  // The value of a link field for edge e, without building the link object
  function linkReader() {
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

  function edgeList(scope) {
    const g = graph();
    if (scope == 'all') {
      if (g.edgeCount > MAX_ALL_EDGES) fail('There are ' + g.edgeCount.toLocaleString() + ' links in all; use scope "visible" or restrict by nodes.');
      const out = [];
      g.forEachEdge(e => out.push(e));
      return out;
    }
    return Array.from(g.visible.subarray(0, g.visibleCount));
  }

  const linkFieldNames = () => {
    const d = requireData();
    return Array.from(new Set(d.linkFields.concat(Array.from(d.graph.columns.keys()))));
  };

  function nodeIndexSet(ids, what) {
    const g = graph();
    const out = new Set();
    [].concat(ids).forEach(id => {
      const x = g.index.get('' + id);
      if (x === undefined) fail('No node has the ID ' + JSON.stringify(id) + (what ? ' (' + what + ')' : ''));
      out.add(x);
    });
    return out;
  }

  // Edges (as a list) matching: scope, touching nodes, between node sets, filter
  function selectEdges(args) {
    const g = graph();
    let edges = edgeList(args.scope == 'all' ? 'all' : 'visible');
    if (args.nodes && args.nodes.length) {
      const set = nodeIndexSet(args.nodes);
      edges = edges.filter(e => set.has(g.source(e)) || set.has(g.target(e)));
    }
    if (args.between) {
      const a = nodeIndexSet(args.between.a || [], 'between.a'), b = nodeIndexSet(args.between.b || [], 'between.b');
      edges = edges.filter(e => { const s = g.source(e), t = g.target(e); return (a.has(s) && b.has(t)) || (a.has(t) && b.has(s)); });
    }
    return edges;
  }

  const linkQueryProps = {
    scope: scopeSchema,
    nodes: { type: 'array', items: { type: 'string' }, description: 'Only links touching any of these node IDs' },
    between: { type: 'object', description: 'Only links with one end in set a and the other in set b (node IDs)', properties: { a: { type: 'array', items: { type: 'string' } }, b: { type: 'array', items: { type: 'string' } } }, required: ['a', 'b'] },
    filter: schemas.filter,
    match: schemas.match
  };

  // Applies filter and sort (reading only the fields they need), returning edges
  function filterSortEdges(edges, args) {
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

  function linkOut(e, fields, vis) {
    const MT = MT_();
    const link = MT.linkObject(e, vis ? vis.has(e) : undefined);
    return fields && fields.length ? pick(link, fields) : link;
  }

  // Adjacency over links: arrays of neighbors and edges per node index
  function adjacency(scope, weightField) {
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

  // Field value scans ---------------------------------------------------------

  class Stop {}

  // The values of a field across nodes, links or clusters: { values, items, sampled }
  function fieldValues(entity, field, { visibleOnly = false, limit = 2e6 } = {}) {
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

  const entityFields = entity => {
    const d = requireData();
    return entity == 'node' ? d.nodeFields.slice() : entity == 'cluster' ? (d.clusterFields || Object.keys(d.clusters[0] || {})) : linkFieldNames();
  };

  const quantile = (sorted, p) => {
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
  function inferType(values, field) {
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

  function summarizeValues(values, { field, top = 20, bins = 10 } = {}) {
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

  // Examples of a field's values: a few distinct ones
  function examples(values, n = 3) {
    const seen = new Set(), out = [];
    for (const v of values) {
      if (isEmpty(v)) continue;
      const k = JSON.stringify(v);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(typeof v === 'string' ? clip(v, 40) : v instanceof Date ? v.toISOString() : v);
      if (out.length >= n) break;
    }
    return out;
  }

  // Tools ---------------------------------------------------------------------

  W.define({
    name: 'get_status',
    title: 'Get status',
    description: 'Summarises the state of MicrobeTrace: whether any data is loaded, how many nodes, links and clusters there are (total and currently visible), how many nodes are selected, the current filter settings (link distance metric and threshold, minimum cluster size, nearest-neighbor-only links, timeline field), the files/sources loaded and which views (panels) are open. ' +
      'Works with no data loaded (then loaded is false). Call this first to learn what you are working with. Returns {loaded, nodes:{total,visible,selected,withSequences}, links:{total,visible}, clusters:{total,visible,singletons}, filters, views, files, fields}.',
    inputSchema: { type: 'object', properties: {} },
    annotations: RO,
    execute: async () => {
      const MT = MT_(), s = settings();
      const lay = self.layout;
      const views = lay && lay.contentItems ? lay.contentItems.map(i => i.componentType).filter(Boolean) : [];
      const out = { loaded: hasData(), views };
      const sess = session_();
      if (sess && sess.files) out.files = sess.files.map(f => ({ name: f.name, format: f.format, kind: f.kind || undefined, field1: f.field1, field2: f.field2 }));
      if (!out.loaded) return out;
      const d = sess.data, g = d.graph;
      const visibleNodes = d.nodes.filter(n => n.visible);
      out.nodes = { total: d.nodes.length, visible: visibleNodes.length, selected: d.nodes.filter(n => n.selected).length, withSequences: d.nodes.filter(n => n.seq).length };
      out.links = { total: g.edgeCount, explicit: g.m, computedDistances: g.edgeCount - g.m, visible: g.visibleCount };
      out.clusters = { total: d.clusters.length, visible: d.clusters.filter(c => c.visible).length, withMultipleNodes: d.clusters.filter(c => c.nodes > 1).length, singletons: d.clusters.filter(c => c.nodes == 1).length };
      out.filters = {
        linkMetric: s['link-sort-variable'], linkThreshold: s['link-threshold'], clusterMinimumSize: s['cluster-minimum-size'],
        linkPruning: s['link-prune'], timelineDateField: s['timeline-date-field'],
        timelineEnd: s['timeline-date-field'] != 'None' && sess.state ? sess.state.timeEnd : undefined
      };
      out.defaultDistanceMetric = s['default-distance-metric'];
      out.nodeFields = d.nodeFields.filter(f => !isInternal(f));
      out.linkFields = linkFieldNames().filter(f => !isInternal(f));
      out.distanceMetricsComputed = g.dense ? Array.from(g.dense.tris.keys()) : [];
      out.availableMetrics = Object.keys(MT.distanceMetrics || {});
      return out;
    }
  });

  W.define({
    name: 'get_statistics',
    title: 'Get network statistics',
    description: 'The network statistics shown in the statistics panel, computed from the current visibility filters: visible nodes, selected nodes, visible links, singleton nodes (visible nodes with no visible links) and disjoint clusters (components of more than one node). Also gives mean degree, density, the largest cluster and the mean link value. ' +
      'Takes no arguments. Needs data. When a timeline date field is set, links and clusters are counted among the nodes shown by the timeline, as the panel does.',
    inputSchema: { type: 'object', properties: {} },
    annotations: RO,
    execute: async () => {
      const MT = MT_(), s = settings();
      const d = requireData();
      const vnodes = MT.getVisibleNodes(), g = d.graph;
      const dated = s['timeline-date-field'] != 'None';
      let links = 0;
      const counts = new Map();
      if (!dated) {
        links = g.visibleCount;
      } else {
        const ids = new Set(vnodes.map(n => '' + n._id));
        for (let x = 0; x < g.visibleCount; x++) {
          const e = g.visible[x];
          if (ids.has(g.ids[g.source(e)]) && ids.has(g.ids[g.target(e)])) links++;
        }
      }
      vnodes.forEach(n => counts.set(n.cluster, (counts.get(n.cluster) || 0) + 1));
      const clusterCount = d.clusters.filter(c => c.visible && c.nodes > 1 && (!dated || counts.get(c.id) > 2)).length;
      const n = vnodes.length;
      const metric = s['link-sort-variable'];
      let sum = 0, k = 0;
      for (let x = 0; x < g.visibleCount; x++) { const v = parseFloat(g.getValue(g.visible[x], metric)); if (!isNaN(v)) { sum += v; k++; } }
      const largest = d.clusters.filter(c => c.visible).sort((a, b) => b.nodes - a.nodes)[0];
      return {
        nodes: n,
        selectedNodes: vnodes.filter(x => x.selected).length,
        visibleLinks: links,
        singletonNodes: vnodes.filter(x => x.degree == 0).length,
        disjointClusters: clusterCount,
        meanDegree: n ? round(2 * links / n, 4) : null,
        density: n > 1 ? round(2 * links / (n * (n - 1)), 6) : null,
        largestCluster: largest ? { id: largest.id, nodes: largest.nodes, links: largest.links } : null,
        linkMetric: metric,
        meanLinkValue: k ? round(sum / k) : null,
        linkThreshold: s['link-threshold'],
        totalNodes: d.nodes.length,
        totalLinks: g.edgeCount
      };
    }
  });

  W.define({
    name: 'list_fields',
    title: 'List fields',
    description: 'Lists the fields (columns) of the loaded nodes, links or clusters, each with an inferred type (numeric, categorical, text, date, boolean, list, sequence, numeric-text), how many values are non-empty, how many distinct values there are, and a few example values. Internal fields MicrobeTrace maintains (index, _id, selected, visible, cluster, degree, origin, seq, ...) are flagged internal: true. ' +
      'Use this to learn the field names that the filter, sort, color and view tools accept. entity "link" scans up to sampleLimit links.',
    inputSchema: {
      type: 'object',
      properties: {
        entity: { type: 'string', enum: ['node', 'link', 'cluster'], description: 'What to list the fields of (default "node")' },
        visibleOnly: { type: 'boolean', description: 'Only count visible items (default false)' },
        includeInternal: { type: 'boolean', description: 'Include internal fields (default true; each flagged)' },
        sampleLimit: { type: 'integer', minimum: 1000, description: 'Most links read per field for entity "link" (default 200000)' }
      }
    },
    annotations: RO,
    execute: async ({ entity = 'node', visibleOnly = false, includeInternal = true, sampleLimit = 200000 }) => {
      requireData();
      const fields = entityFields(entity).filter(f => includeInternal || !isInternal(f));
      const rows = fields.map(field => {
        const { values, items, sampled } = fieldValues(entity, field, { visibleOnly, limit: sampleLimit });
        const present = values.filter(v => !isEmpty(v));
        const distinct = field == 'seq' ? present.length : new Set(present.map(v => typeof v === 'object' ? JSON.stringify(v) : v)).size;
        const row = { field, type: inferType(present, field), nonEmpty: present.length, distinct, internal: isInternal(field), examples: field == 'seq' ? [] : examples(present) };
        if (sampled) row.sampled = true;
        return row;
      });
      return { entity, items: entity == 'node' ? (visibleOnly ? requireData().nodes.filter(n => n.visible).length : requireData().nodes.length) : entity == 'cluster' ? requireData().clusters.length : (visibleOnly ? graph().visibleCount : graph().edgeCount), fields: rows };
    }
  });

  W.define({
    name: 'describe_field',
    title: 'Describe a field',
    description: 'Describes one node, link or cluster field. Categorical/text fields: the distinct values with counts and fractions (top N). Numeric fields: min, max, mean, median, stdev, quantiles and a histogram with bins. Date fields: earliest, latest, median and a histogram over time. Sequence fields: length range. List-valued fields (such as a link origin) count each element. ' +
      'Use before filtering or coloring to see what values exist.',
    inputSchema: {
      type: 'object',
      properties: {
        entity: { type: 'string', enum: ['node', 'link', 'cluster'], description: 'Default "node"' },
        field: { type: 'string', description: 'The field name (see list_fields)' },
        visibleOnly: { type: 'boolean', description: 'Only visible items (default false)' },
        top: { type: 'integer', minimum: 1, maximum: 1000, description: 'Most distinct values listed for categorical fields (default 20)' },
        bins: { type: 'integer', minimum: 1, maximum: 200, description: 'Histogram bins for numeric and date fields (default 10)' },
        filter: schemas.filter,
        match: schemas.match
      },
      required: ['field']
    },
    annotations: RO,
    execute: async ({ entity = 'node', field, visibleOnly = false, top = 20, bins = 10, filter: conditions, match }) => {
      requireData();
      if (!entityFields(entity).includes(field)) fail('Unknown ' + entity + ' field ' + JSON.stringify(field) + '. Fields: ' + entityFields(entity).join(', '));
      let values, sampled = false, items;
      if (conditions && conditions.length) {
        if (entity == 'link') {
          const edges = filterSortEdges(edgeList(visibleOnly ? 'visible' : 'all'), { filter: conditions, match });
          const read = linkReader();
          values = edges.map(e => read(e, field)); items = edges.length;
        } else {
          const list = entity == 'node' ? requireData().nodes.filter(n => !visibleOnly || n.visible) : requireData().clusters.filter(c => !visibleOnly || c.visible);
          values = filter(list, conditions, match).map(x => x[field]); items = values.length;
        }
      } else {
        ({ values, items, sampled } = fieldValues(entity, field, { visibleOnly }));
      }
      return Object.assign({ entity, field, items }, sampled ? { sampled: true } : {}, summarizeValues(values, { field, top, bins }));
    }
  });

  W.define({
    name: 'query_nodes',
    title: 'Query nodes',
    description: 'Finds nodes: filter by field conditions (e.g. [{field:"state",op:"eq",value:"Georgia"},{field:"degree",op:"gte",value:3}]), restrict to visible or selected nodes or to given IDs, sort, and page. Returns the matching nodes with the requested fields. ' +
      'Sequences are left out unless asked for, as they are long (seq_length is given instead). Every node has _id, cluster (cluster number), degree (visible links), visible and selected. ' +
      'Returns {total, offset, limit, returned, items}. Use total to know how many matched beyond the page. With count:true only the total is returned.',
    inputSchema: {
      type: 'object',
      properties: Object.assign({}, nodeSelectProps, seqProps, { sort: schemas.sort, count: { type: 'boolean', description: 'Only return the number of matches, not the nodes' } }, P)
    },
    annotations: RO,
    execute: async args => {
      let nodes = selectNodes(args);
      if (args.count) return { total: nodes.length };
      nodes = sort(nodes, args.sort);
      const result = page(nodes, args);
      result.items = result.items.map(n => nodeOut(n, args));
      return result;
    }
  });

  function neighborsOf(ids, depth, scope, link) {
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

  function neighborRows(rows, { scope, includeNode, nodeFields, linkFields, limit }) {
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

  W.define({
    name: 'get_neighbors',
    title: 'Get neighbors',
    description: 'The neighbors of one or more nodes through links, breadth-first up to a number of hops. Each neighbor gives its node ID, its depth (1 = directly linked), and the link that reached it (with its distance and other link fields). Use depth 1 for direct neighbors, 2+ for the neighborhood. ' +
      'scope "visible" (default) follows the links currently shown; "all" follows every link (above-threshold ones too). Returns one entry per requested node: {id, total, returned, neighbors:[{id, depth, via?, link, node?}]}.',
    inputSchema: {
      type: 'object',
      properties: {
        ids: { type: 'array', items: { type: 'string' }, minItems: 1, description: 'Node IDs to find the neighbors of' },
        depth: { type: 'integer', minimum: 1, maximum: 20, description: 'Hops to follow (default 1)' },
        scope: scopeSchema,
        includeNode: { type: 'boolean', description: 'Also return each neighbor node\'s fields (default false)' },
        nodeFields: { type: 'array', items: { type: 'string' }, description: 'Node fields to return when includeNode (default all but seq)' },
        linkFields: { type: 'array', items: { type: 'string' }, description: 'Link fields to return (default all)' },
        limit: { type: 'integer', minimum: 1, maximum: 10000, description: 'Most neighbors returned per node (default 200); total says how many there were' }
      },
      required: ['ids']
    },
    annotations: RO,
    execute: async ({ ids, depth = 1, scope = 'visible', includeNode = false, nodeFields, linkFields, limit = 200 }) => {
      requireData();
      return { scope, depth, nodes: neighborRows(neighborsOf(ids, depth, scope), { scope, includeNode, nodeFields, linkFields, limit }) };
    }
  });

  W.define({
    name: 'get_node',
    title: 'Get node',
    description: 'Everything about one node by ID: all its fields (sequence optional), its cluster (with the cluster\'s size), its degree among visible links and among all links, whether it is visible/selected, and optionally where each field value came from when several files describe the node (provenance: each file\'s value and the one used) and its direct neighbors. ' +
      'Fails if the ID does not exist (use query_nodes to find IDs).',
    inputSchema: {
      type: 'object',
      properties: Object.assign({ id: { type: 'string', description: 'The node ID (its _id)' },
        provenance: { type: 'boolean', description: 'Include per-field provenance, where more than one file gave the node a value (default true)' },
        neighbors: { type: 'boolean', description: 'Include direct neighbors through visible links (default false; see get_neighbors for more)' } }, seqProps),
      required: ['id']
    },
    annotations: RO,
    execute: async args => {
      const MT = MT_(), data = requireData();
      const node = nodeById(args.id), g = data.graph, x = g.index.get('' + node._id);
      const out = { id: node._id, node: nodeOut(node, args) };
      const cluster = data.clusters[node.cluster];
      if (cluster) out.cluster = { id: cluster.id, nodes: cluster.nodes, links: cluster.links, visible: cluster.visible };
      let all = 0, vis = 0;
      if (x !== undefined) {
        const adj = adjacency('visible');
        vis = adj.nbr[x].length;
        all = g.edgeCount > MAX_ALL_EDGES ? null : adjacency('all').nbr[x].length;
      }
      out.degree = { visible: vis, all };
      if (args.provenance !== false) {
        const prov = {};
        data.nodeFields.forEach(f => {
          if (f == 'seq') return;
          const p = MT.provenance(node._id, f);
          if (p.length > 1) prov[f] = p;
        });
        out.provenance = prov;
      }
      if (args.neighbors) out.neighbors = neighborRows(neighborsOf([node._id], 1, 'visible'), { includeNode: false, limit: 200 })[0].neighbors;
      return out;
    }
  });

  W.define({
    name: 'query_links',
    title: 'Query links',
    description: 'Finds links (edges between nodes): filter by link fields (source, target, the distance metrics such as tn93/snps/distance, origin, nn, cluster, visible, and any column from a links file), restrict to links touching given node IDs or running between two sets of nodes, sort (e.g. by tn93 ascending for the closest pairs), and page. ' +
      'scope "visible" (default) searches the links currently shown; "all" searches every link, including computed distances above the threshold (refused above 4 million links). Each link has index, source, target, origin (files it came from), nn, directed, visible, cluster and its distance fields. ' +
      'Returns {total, offset, limit, returned, items}. With count:true only the total.',
    inputSchema: {
      type: 'object',
      properties: Object.assign({}, linkQueryProps, {
        sort: schemas.sort,
        fields: { type: 'array', items: { type: 'string' }, description: 'Link fields to return (default all)' },
        count: { type: 'boolean', description: 'Only return the number of matches' }
      }, P)
    },
    annotations: RO,
    execute: async args => {
      requireData();
      let edges = filterSortEdges(selectEdges(args), args);
      if (args.count) return { total: edges.length };
      const result = page(edges, args), vis = visibleSet();
      result.items = result.items.map(e => linkOut(e, args.fields, vis));
      return result;
    }
  });

  W.define({
    name: 'get_link',
    title: 'Get link',
    description: 'The link between two nodes (in either order), with all its distance values, origin files and flags, and whether it is currently visible. Returns {exists:false} if the two nodes have no link (a pair above the threshold with no stored distance has none either). Fails if a node ID does not exist.',
    inputSchema: { type: 'object', properties: { source: { type: 'string' }, target: { type: 'string' } }, required: ['source', 'target'] },
    annotations: RO,
    execute: async ({ source, target }) => {
      requireData();
      nodeById(source); nodeById(target);
      const link = MT_().getLink(source, target);
      return link ? { exists: true, link } : { exists: false };
    }
  });

  const clusterRow = (c, members) => {
    const out = Object.assign({}, c);
    if (members) out.members = members;
    return out;
  };

  W.define({
    name: 'list_clusters',
    title: 'List clusters',
    description: 'Lists clusters (connected groups of nodes under the current link threshold) with their statistics: id, nodes (size), links, sum_distances, links_per_node, mean_genetic_distance, visible. Filter (e.g. nodes >= 5), sort (e.g. nodes descending for the biggest), page. ' +
      'Optionally include member node IDs. Cluster IDs are the numbers in each node\'s cluster field. Returns {total, offset, limit, returned, items}.',
    inputSchema: {
      type: 'object',
      properties: Object.assign({
        filter: schemas.filter, match: schemas.match, sort: schemas.sort,
        visibleOnly: { type: 'boolean', description: 'Only clusters that pass the minimum-size filter (default false)' },
        minSize: { type: 'integer', minimum: 1, description: 'Only clusters with at least this many nodes' },
        includeMembers: { type: 'boolean', description: 'Include member node IDs (default false)' },
        maxMembers: { type: 'integer', minimum: 1, description: 'Most member IDs per cluster (default 50)' }
      }, P)
    },
    annotations: RO,
    execute: async args => {
      const d = requireData();
      let clusters = d.clusters.filter(c => (!args.visibleOnly || c.visible) && (!args.minSize || c.nodes >= args.minSize));
      clusters = sort(filter(clusters, args.filter, args.match), args.sort);
      const result = page(clusters, args);
      let byCluster;
      if (args.includeMembers) {
        byCluster = new Map();
        d.nodes.forEach(n => { if (!byCluster.has(n.cluster)) byCluster.set(n.cluster, []); byCluster.get(n.cluster).push(n._id); });
      }
      const max = args.maxMembers || 50;
      result.items = result.items.map(c => clusterRow(c, byCluster ? (byCluster.get(c.id) || []).slice(0, max) : null));
      return result;
    }
  });

  W.define({
    name: 'get_cluster',
    title: 'Get cluster',
    description: 'One cluster in detail: its statistics, all member node IDs (paged), the links inside it, and optionally breakdowns of member nodes by chosen fields (e.g. summarize:["state","group"] gives counts per value). Cluster IDs come from list_clusters or a node\'s cluster field. ' +
      'Links are the visible ones unless scope "all". Returns {cluster, members:{total,items}, links:{total,items}, summaries}.',
    inputSchema: {
      type: 'object',
      properties: Object.assign({
        id: { type: 'integer', minimum: 0, description: 'The cluster ID' },
        scope: scopeSchema,
        includeNodes: { type: 'boolean', description: 'Return members as node objects rather than just IDs (default false)' },
        nodeFields: { type: 'array', items: { type: 'string' }, description: 'Fields of node objects when includeNodes' },
        includeLinks: { type: 'boolean', description: 'Include the links among members (default true)' },
        linkFields: { type: 'array', items: { type: 'string' } },
        summarize: { type: 'array', items: { type: 'string' }, description: 'Node fields to count values of among the members' },
        offset: P.offset, limit: { type: 'integer', minimum: 0, maximum: 10000, description: 'Most members and most links returned (default 100 each)' }
      }),
      required: ['id']
    },
    annotations: RO,
    execute: async args => {
      const d = requireData(), g = d.graph;
      const cluster = d.clusters[args.id];
      if (!cluster) fail('No cluster has the ID ' + args.id + ' (there are ' + d.clusters.length + ')');
      const members = d.nodes.filter(n => n.cluster === cluster.id);
      const out = { cluster };
      const mem = page(members, args);
      mem.items = args.includeNodes ? mem.items.map(n => nodeOut(n, { fields: args.nodeFields })) : mem.items.map(n => n._id);
      out.members = mem;
      if (args.includeLinks !== false) {
        const set = new Set(members.map(n => g.index.get('' + n._id)));
        const vis = visibleSet();
        const edges = edgeList(args.scope == 'all' ? 'all' : 'visible').filter(e => set.has(g.source(e)) && set.has(g.target(e)));
        const lp = page(edges, args);
        lp.items = lp.items.map(e => linkOut(e, args.linkFields, vis));
        out.links = lp;
      }
      if (args.summarize && args.summarize.length) {
        out.summaries = {};
        args.summarize.forEach(f => { out.summaries[f] = summarizeValues(members.map(n => n[f]), { field: f }); });
      }
      return out;
    }
  });

  const groupKey = (node, fields) => fields.map(f => label(node[f]));

  W.define({
    name: 'crosstab',
    title: 'Crosstab',
    description: 'Counts nodes by the combinations of two node fields, like the Crosstab view: rows are values of fieldA, columns values of fieldB, cells are counts. Also gives row and column totals. Empty values are shown as "(Empty)". Use for questions like "how many cases per state and group". ' +
      'Returns {rows, columns, matrix[row][col], rowTotals, columnTotals, total}.',
    inputSchema: {
      type: 'object',
      properties: Object.assign({
        fieldA: { type: 'string', description: 'Node field for the rows' },
        fieldB: { type: 'string', description: 'Node field for the columns' },
        orderBy: { type: 'string', enum: ['label', 'count'], description: 'Order of rows and columns: by value (default) or descending count' },
        includeEmpty: { type: 'boolean', description: 'Count nodes with an empty value as "(Empty)" (default true)' }
      }, { filter: schemas.filter, match: schemas.match, visibleOnly: nodeSelectProps.visibleOnly, selectedOnly: nodeSelectProps.selectedOnly }),
      required: ['fieldA', 'fieldB']
    },
    annotations: RO,
    execute: async args => {
      const { fieldA, fieldB, orderBy = 'label', includeEmpty = true } = args;
      const d = requireData();
      [fieldA, fieldB].forEach(f => { if (!d.nodeFields.includes(f)) fail('Unknown node field ' + JSON.stringify(f)); });
      const counts = new Map(), rowT = new Map(), colT = new Map();
      let total = 0;
      selectNodes(args).forEach(n => {
        if (!includeEmpty && (isEmpty(n[fieldA]) || isEmpty(n[fieldB]))) return;
        const [a, b] = groupKey(n, [fieldA, fieldB]);
        counts.set(a + '\u0000' + b, (counts.get(a + '\u0000' + b) || 0) + 1);
        rowT.set(a, (rowT.get(a) || 0) + 1); colT.set(b, (colT.get(b) || 0) + 1); total++;
      });
      const order = totals => Array.from(totals.keys()).sort((a, b) => orderBy == 'count' ? totals.get(b) - totals.get(a) || W.compare(a, b) : W.compare(a, b));
      const rows = order(rowT), columns = order(colT);
      return {
        fieldA, fieldB, rows, columns,
        matrix: rows.map(a => columns.map(b => counts.get(a + '\u0000' + b) || 0)),
        rowTotals: rows.map(a => rowT.get(a)), columnTotals: columns.map(b => colT.get(b)), total
      };
    }
  });

  const OPS_AGG = ['count', 'sum', 'mean', 'min', 'max', 'median', 'distinct'];

  W.define({
    name: 'aggregate',
    title: 'Aggregate nodes',
    description: 'Groups nodes by one or more fields and computes statistics per group, like a pivot table / SQL GROUP BY. Always gives count per group; metrics add numeric aggregations of other fields: sum, mean, min, max, median or distinct (count of distinct values). With no groupBy, aggregates all (filtered) nodes together. ' +
      'Example: groupBy:["state"], metrics:[{field:"degree",op:"mean"}]. Rows can be filtered with having (on count and metric columns, e.g. field "count"), sorted and paged. Metric columns are named op_field (mean_degree). Returns {total, items:[{<groupBy fields>, count, op_field...}]}.',
    inputSchema: {
      type: 'object',
      properties: Object.assign({
        groupBy: { type: 'array', items: { type: 'string' }, description: 'Node fields to group by (can be empty)' },
        metrics: { type: 'array', items: { type: 'object', properties: { field: { type: 'string' }, op: { type: 'string', enum: OPS_AGG } }, required: ['field', 'op'] }, description: 'Aggregations of numeric (or any, for distinct) fields' },
        having: Object.assign({}, schemas.filter, { description: 'Conditions on the resulting rows, e.g. [{field:"count",op:"gte",value:5}]' }),
        sort: schemas.sort
      }, nodeSelectProps, P)
    },
    annotations: RO,
    execute: async args => {
      const d = requireData();
      const groupBy = args.groupBy || [], metrics = args.metrics || [];
      groupBy.concat(metrics.map(m => m.field)).forEach(f => { if (!d.nodeFields.includes(f)) fail('Unknown node field ' + JSON.stringify(f)); });
      metrics.forEach(m => { if (!OPS_AGG.includes(m.op)) fail('Unknown metric op ' + m.op + '; use one of ' + OPS_AGG.join(', ')); });
      const groups = new Map();
      selectNodes(args).forEach(n => {
        const key = JSON.stringify(groupKey(n, groupBy));
        let g = groups.get(key);
        if (!g) { g = { nodes: [], key: groupBy.map(f => isEmpty(n[f]) ? null : n[f] instanceof Date ? n[f].toISOString() : n[f]) }; groups.set(key, g); }
        g.nodes.push(n);
      });
      let rows = Array.from(groups.values()).map(g => {
        const row = {};
        groupBy.forEach((f, i) => { row[f] = g.key[i]; });
        row.count = g.nodes.length;
        metrics.forEach(m => {
          const vals = g.nodes.map(n => n[m.field]).filter(v => !isEmpty(v));
          const nums = vals.map(Number).filter(v => !isNaN(v)).sort((a, b) => a - b);
          let v = null;
          switch (m.op) {
            case 'count': v = vals.length; break;
            case 'distinct': v = new Set(vals.map(String)).size; break;
            case 'sum': v = nums.reduce((a, b) => a + b, 0); break;
            case 'mean': v = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null; break;
            case 'min': v = nums.length ? nums[0] : null; break;
            case 'max': v = nums.length ? nums[nums.length - 1] : null; break;
            case 'median': v = quantile(nums, 0.5); break;
          }
          row[m.op + '_' + m.field] = round(v);
        });
        return row;
      });
      rows = filter(rows, args.having);
      rows = sort(rows, args.sort && args.sort.length ? args.sort : [{ field: 'count', descending: true }]);
      return page(rows, args);
    }
  });

  W.define({
    name: 'get_distance_matrix',
    title: 'Get distance matrix',
    description: 'A matrix of pairwise link values (genetic distances) between nodes for a chosen metric (default: the current link metric): labels (node IDs) plus a square matrix, with 0 on the diagonal and null where two nodes have no stored value. Choose the nodes by ids, or visible nodes, or by filter; capped by maxNodes (default 200, as the output is n squared). ' +
      'format "pairs" returns just the pairs that have a value, which is more compact for sparse links. Metrics are link fields such as tn93, snps, hamming (see list_fields entity "link").',
    inputSchema: {
      type: 'object',
      properties: Object.assign({
        metric: { type: 'string', description: 'The link field to use (default: the current link-sort-variable, e.g. tn93)' },
        format: { type: 'string', enum: ['matrix', 'pairs'], description: '"matrix" (default) or "pairs" ([{source, target, value}])' },
        maxNodes: { type: 'integer', minimum: 2, maximum: 2000, description: 'Refuse more nodes than this (default 200)' },
        decimals: { type: 'integer', minimum: 0, maximum: 12, description: 'Round values to this many decimals (default 6)' }
      }, nodeSelectProps),
      required: []
    },
    annotations: RO,
    execute: async args => {
      const MT = MT_(), g = graph();
      const metric = args.metric || settings()['link-sort-variable'];
      if (!g.columns.has(metric) && !g.denseValues(metric)) fail('No link field named ' + JSON.stringify(metric) + '. Link fields: ' + linkFieldNames().filter(f => !isInternal(f)).join(', '));
      const a = Object.assign({}, args);
      if (!a.ids && !a.filter && !a.selectedOnly && a.visibleOnly === undefined) a.visibleOnly = true;
      const nodes = selectNodes(a), max = args.maxNodes || 200;
      if (nodes.length > max) fail(nodes.length + ' nodes is more than maxNodes (' + max + '). Pass fewer ids, filter further, or raise maxNodes (output grows with the square).');
      const labels = nodes.map(n => '' + n._id);
      const { tri } = MT.getCondensedDM(metric, labels);
      const n = labels.length, dec = args.decimals == null ? 6 : args.decimals;
      if (args.format == 'pairs') {
        const pairs = [];
        let k = 0;
        for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++, k++) if (isFinite(tri[k])) pairs.push({ source: labels[i], target: labels[j], value: round(tri[k], dec) });
        return { metric, labels, pairs };
      }
      const matrix = Array.from({ length: n }, (_, i) => { const r = new Array(n).fill(null); r[i] = 0; return r; });
      let k = 0;
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++, k++) { const v = tri[k]; if (isFinite(v)) matrix[i][j] = matrix[j][i] = round(v, dec); }
      return { metric, labels, matrix };
    }
  });

  W.define({
    name: 'get_tree',
    title: 'Get phylogenetic tree',
    description: 'The neighbor-joining phylogenetic tree of the nodes as a Newick string (branch lengths are distances). The tree is the one the Phylogenetic Tree view shows; if it has not been computed yet it is built from the distance matrix (compute "if-missing", the default), which can take a while for thousands of nodes and requires distances between nodes. ' +
      'Returns {newick, leaves, computed}. compute "never" returns {newick:null} instead of computing. A tree loaded from a Newick file is returned as loaded.',
    inputSchema: {
      type: 'object',
      properties: { compute: { type: 'string', enum: ['if-missing', 'always', 'never'], description: 'Whether to compute the tree: only if there is none (default), always (recompute from current distances), or never' } }
    },
    annotations: RO,
    execute: async ({ compute = 'if-missing' }) => {
      requireData();
      const t = self.temp;
      let computed = false;
      if (compute == 'always' || (compute == 'if-missing' && !(t && t.tree))) {
        await MT_().computeTree();
        computed = true;
      }
      if (!t || !t.tree) return { newick: null, leaves: 0, computed, note: 'No tree has been computed.' };
      const newick = typeof t.tree.toNewick === 'function' ? t.tree.toNewick() : String(t.tree);
      return { newick, leaves: (newick.match(/[,]/g) || []).length + 1, computed };
    }
  });

  const fasta = (nodes, wrap) => nodes.map(n => '>' + n._id + '\n' + (wrap ? String(n.seq).replace(new RegExp('(.{' + wrap + '})', 'g'), '$1\n').trim() : n.seq)).join('\n') + '\n';

  W.define({
    name: 'get_sequences',
    title: 'Get sequences',
    description: 'The sequences of nodes (those that have one): by IDs, or by filter / visible / selected, paged. format "json" (default) gives [{id, length, seq}]; format "fasta" gives FASTA text in one string. Sequences can be long and numerous, so the default limit is 25 and maxLength can truncate each. ' +
      'Returns {total, offset, limit, returned, items} (json) or the same with fasta text.',
    inputSchema: {
      type: 'object',
      properties: Object.assign({}, nodeSelectProps, {
        format: { type: 'string', enum: ['json', 'fasta'], description: 'Default "json"' },
        maxLength: { type: 'integer', minimum: 1, description: 'Truncate each sequence to this many characters' },
        wrap: { type: 'integer', minimum: 10, description: 'FASTA line width (default: one line per sequence)' }
      }, { offset: P.offset, limit: { type: 'integer', minimum: 0, maximum: 10000, description: 'Most sequences (default 25)' } })
    },
    annotations: RO,
    execute: async args => {
      const nodes = selectNodes(args).filter(n => typeof n.seq === 'string' && n.seq);
      const result = page(nodes, { offset: args.offset, limit: args.limit == null ? 25 : args.limit });
      const items = result.items.map(n => ({ _id: n._id, seq: args.maxLength ? n.seq.slice(0, args.maxLength) : n.seq }));
      if (args.format == 'fasta') {
        result.fasta = fasta(items.map(n => ({ _id: n._id, seq: n.seq })), args.wrap);
        delete result.items;
      } else {
        result.items = result.items.map(n => ({ id: n._id, length: n.seq.length, seq: args.maxLength ? clip(n.seq, args.maxLength) : n.seq }));
      }
      return result;
    }
  });

  W.define({
    name: 'get_consensus',
    title: 'Get consensus sequence',
    description: 'The consensus sequence (most common base at each position) of the chosen nodes\' sequences: by IDs, filter, visible or selected nodes (default all nodes with sequences). Sequences should be aligned (as MicrobeTrace\'s alignment gives). Returns {consensus, length, nodes}.',
    inputSchema: { type: 'object', properties: nodeSelectProps },
    annotations: RO,
    execute: async args => {
      const nodes = selectNodes(args).filter(n => typeof n.seq === 'string' && n.seq);
      if (!nodes.length) fail('None of the chosen nodes has a sequence');
      const consensus = await MT_().computeConsensus(nodes.map(n => ({ _id: n._id, seq: n.seq })));
      return { consensus, length: consensus.length, nodes: nodes.length };
    }
  });

  W.define({
    name: 'get_conflicts',
    title: 'Get conflicts between files',
    description: 'Where files that describe the same nodes disagree: for each field, the IDs of the nodes whose files give different values (what the Conflicts view lists). Empty when only one file gave node data or the files agree. Use get_provenance to see each file\'s value for a node. ' +
      'Returns {total, fields:[{field, nodes:[ids], count}]}.',
    inputSchema: { type: 'object', properties: { field: { type: 'string', description: 'Only this field' }, maxNodes: { type: 'integer', minimum: 1, description: 'Most node IDs listed per field (default 100)' } } },
    annotations: RO,
    execute: async ({ field, maxNodes = 100 }) => {
      requireData();
      const fields = [];
      MT_().nodeConflicts().forEach((keys, f) => { if (!field || f == field) fields.push({ field: f, count: keys.length, nodes: Array.from(keys).slice(0, maxNodes) }); });
      return { total: fields.length, fields };
    }
  });

  W.define({
    name: 'get_provenance',
    title: 'Get provenance',
    description: 'Where a node\'s values came from when several files describe it: for each field (or one), each file\'s value, the row it came from, and which one is used (used: true). Fields given by only one file are omitted unless includeSingle. Fails for an unknown node ID.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'Node ID' }, field: { type: 'string', description: 'Only this field' }, includeSingle: { type: 'boolean', description: 'Also fields only one file gave (default false)' } },
      required: ['id']
    },
    annotations: RO,
    execute: async ({ id, field, includeSingle = false }) => {
      const MT = MT_(), d = requireData();
      const node = nodeById(id);
      const out = {};
      (field ? [field] : d.nodeFields).forEach(f => {
        if (f == 'seq' && !field) return;
        const p = MT.provenance(node._id, f).map(x => Object.assign({}, x, { value: clip(x.value, 100) }));
        if (p.length > (includeSingle || field ? 0 : 1)) out[f] = p;
      });
      return { id: node._id, provenance: out };
    }
  });

  // Binary min-heap
  class Heap {
    constructor() { this.a = []; }
    push(k, v) { const a = this.a; a.push([k, v]); let i = a.length - 1; while (i) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } }
    pop() {
      const a = this.a, top = a[0], last = a.pop();
      if (a.length) { a[0] = last; let i = 0; for (;;) { let l = 2 * i + 1, r = l + 1, m = i; if (l < a.length && a[l][0] < a[m][0]) m = l; if (r < a.length && a[r][0] < a[m][0]) m = r; if (m == i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } }
      return top;
    }
    get size() { return this.a.length; }
  }

  W.define({
    name: 'shortest_path',
    title: 'Shortest path',
    description: 'The shortest path between two nodes through links. By default it minimises the number of hops; give weight (a link field such as tn93 or distance) to minimise the total of that field instead (links with no value for it are not used). scope "visible" (default) uses the links currently shown, "all" every link. ' +
      'Returns {found, hops, totalWeight, path:[node IDs], links:[the link between each pair]}; found is false if the nodes are not connected. Fails for unknown IDs.',
    inputSchema: {
      type: 'object',
      properties: {
        source: { type: 'string' }, target: { type: 'string' },
        weight: { type: 'string', description: 'Link field to minimise the sum of (default: hop count)' },
        scope: scopeSchema,
        linkFields: { type: 'array', items: { type: 'string' }, description: 'Link fields to return for the path links (default all)' }
      },
      required: ['source', 'target']
    },
    annotations: RO,
    execute: async ({ source, target, weight, scope = 'visible', linkFields }) => {
      requireData();
      nodeById(source); nodeById(target);
      const { nbr, eds, g } = adjacency(scope);
      const s = g.index.get('' + source), t = g.index.get('' + target);
      if (weight && !linkFieldNames().includes(weight)) fail('Unknown link field ' + JSON.stringify(weight));
      const dist = new Map([[s, 0]]), prev = new Map(), heap = new Heap();
      heap.push(0, s);
      const done = new Set();
      while (heap.size) {
        const [d, x] = heap.pop();
        if (done.has(x)) continue;
        done.add(x);
        if (x == t) break;
        nbr[x].forEach((y, i) => {
          let w = 1;
          if (weight) { w = parseFloat(g.getValue(eds[x][i], weight)); if (isNaN(w)) return; if (w < 0) w = 0; }
          const nd = d + w;
          if (!dist.has(y) || nd < dist.get(y)) { dist.set(y, nd); prev.set(y, [x, eds[x][i]]); heap.push(nd, y); }
        });
      }
      if (!dist.has(t)) return { found: false, source, target, scope };
      const path = [t], es = [];
      for (let x = t; x != s;) { const [p, e] = prev.get(x); es.unshift(e); path.unshift(p); x = p; }
      const vis = visibleSet();
      return { found: true, hops: es.length, totalWeight: round(dist.get(t)), weight: weight || 'hops', path: path.map(x => g.ids[x]), links: es.map(e => linkOut(e, linkFields, vis)) };
    }
  });

  W.define({
    name: 'get_degree_distribution',
    title: 'Degree distribution',
    description: 'How many links each node has: a histogram of degree (the number of nodes with 0, 1, 2, ... links), summary statistics (mean, median, max, singletons), and the highest-degree nodes (hubs). Uses visible links by default, among visible nodes; scope "all" counts every link. ' +
      'Returns {nodes, mean, median, max, singletons, distribution:[{degree,count}], hubs:[{id, degree, cluster}]}.',
    inputSchema: {
      type: 'object',
      properties: { scope: scopeSchema, topHubs: { type: 'integer', minimum: 0, maximum: 1000, description: 'Highest-degree nodes listed (default 10)' }, visibleOnly: { type: 'boolean', description: 'Count only visible nodes (default true)' } }
    },
    annotations: RO,
    execute: async ({ scope = 'visible', topHubs = 10, visibleOnly = true }) => {
      const d = requireData();
      const { nbr, g } = adjacency(scope);
      const nodes = d.nodes.filter(n => !visibleOnly || n.visible);
      const deg = nodes.map(n => ({ n, k: nbr[g.index.get('' + n._id)].length }));
      const ks = deg.map(x => x.k).sort((a, b) => a - b);
      const hist = new Map();
      ks.forEach(k => hist.set(k, (hist.get(k) || 0) + 1));
      return {
        scope, nodes: nodes.length,
        mean: ks.length ? round(ks.reduce((a, b) => a + b, 0) / ks.length, 4) : null, median: quantile(ks, 0.5), max: ks.length ? ks[ks.length - 1] : null,
        singletons: ks.filter(k => k == 0).length,
        distribution: Array.from(hist, ([degree, count]) => ({ degree, count })).sort((a, b) => a.degree - b.degree),
        hubs: deg.sort((a, b) => b.k - a.k).slice(0, topHubs).map(x => ({ id: x.n._id, degree: x.k, cluster: x.n.cluster }))
      };
    }
  });

  W.define({
    name: 'get_centrality',
    title: 'Node centrality',
    description: 'Centrality measures for nodes in the network of links: degree (links), betweenness (how often a node lies on shortest paths between others; unweighted, normalized 0..1) and closeness (inverse mean hop distance to the nodes it can reach, scaled by the fraction reachable). Returns the top nodes by the chosen measure, or specific nodes by ids. ' +
      'Uses visible links by default. Betweenness and closeness cost time proportional to nodes x links and are refused above maxNodes (default 3000 connected nodes).',
    inputSchema: {
      type: 'object',
      properties: {
        measures: { type: 'array', items: { type: 'string', enum: ['degree', 'betweenness', 'closeness'] }, description: 'Measures to compute (default all three)' },
        sortBy: { type: 'string', enum: ['degree', 'betweenness', 'closeness'], description: 'Measure to rank by (default betweenness)' },
        scope: scopeSchema,
        ids: { type: 'array', items: { type: 'string' }, description: 'Report only these nodes (default: the top ones)' },
        top: { type: 'integer', minimum: 1, maximum: 1000, description: 'How many top nodes to return (default 20)' },
        maxNodes: { type: 'integer', minimum: 10, description: 'Refuse betweenness/closeness above this many connected nodes (default 3000)' }
      }
    },
    annotations: RO,
    execute: async ({ measures = ['degree', 'betweenness', 'closeness'], sortBy = 'betweenness', scope = 'visible', ids, top = 20, maxNodes = 3000 }) => {
      const d = requireData();
      const { nbr, g } = adjacency(scope);
      const n = g.nodeCount;
      const connected = [];
      for (let i = 0; i < n; i++) if (nbr[i].length) connected.push(i);
      const heavy = measures.includes('betweenness') || measures.includes('closeness');
      if (heavy && connected.length > maxNodes) fail(connected.length + ' connected nodes is more than maxNodes (' + maxNodes + '); use measures:["degree"] or raise maxNodes.');
      const bet = new Float64Array(n), close = new Float64Array(n);
      if (heavy) {
        connected.forEach(s => {
          const stack = [], pred = Array.from({ length: n }, () => null), sigma = new Float64Array(n), dist = new Int32Array(n).fill(-1), delta = new Float64Array(n);
          sigma[s] = 1; dist[s] = 0;
          const queue = [s];
          let sum = 0, reached = 0;
          for (let h = 0; h < queue.length; h++) {
            const v = queue[h];
            stack.push(v);
            nbr[v].forEach(w => {
              if (dist[w] < 0) { dist[w] = dist[v] + 1; queue.push(w); sum += dist[w]; reached++; }
              if (dist[w] == dist[v] + 1) { sigma[w] += sigma[v]; (pred[w] || (pred[w] = [])).push(v); }
            });
          }
          while (stack.length) {
            const w = stack.pop();
            (pred[w] || []).forEach(v => { delta[v] += sigma[v] / sigma[w] * (1 + delta[w]); });
            if (w != s) bet[w] += delta[w];
          }
          close[s] = reached ? (reached / sum) * (reached / (connected.length - 1 || 1)) : 0;
        });
      }
      const norm = connected.length > 2 ? 1 / ((connected.length - 1) * (connected.length - 2)) : 0; // undirected: halve the pair counts, then normalize
      const nodeById_ = id => d.nodeIndex && d.nodeIndex.get('' + id);
      let rows = d.nodes.filter(nd => g.index.has('' + nd._id)).map(nd => {
        const x = g.index.get('' + nd._id), r = { id: nd._id, cluster: nd.cluster };
        if (measures.includes('degree')) r.degree = nbr[x].length;
        if (measures.includes('betweenness')) r.betweenness = round(bet[x] * norm, 6);
        if (measures.includes('closeness')) r.closeness = round(close[x], 6);
        return r;
      });
      if (ids && ids.length) { ids.forEach(id => { if (!nodeById_(id)) fail('No node has the ID ' + JSON.stringify(id)); }); const want = new Set(ids.map(String)); rows = rows.filter(r => want.has('' + r.id)); }
      else { if (!measures.includes(sortBy)) fail('sortBy ' + sortBy + ' is not among measures'); rows = sort(rows, [{ field: sortBy, descending: true }]).slice(0, top); }
      return { scope, connectedNodes: connected.length, items: rows };
    }
  });

})(typeof self !== 'undefined' ? self : this);
