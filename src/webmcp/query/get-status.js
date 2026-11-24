import { RO, MT_, session_, settings, isInternal, linkFieldNames } from './helpers.js';

const hasData = () => !!(session_() && session_().data && session_().data.nodes.length);

export default {
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
};
