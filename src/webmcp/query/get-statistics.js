import { requireData } from '../core.js';
import { RO, MT_, settings, round } from './helpers.js';

export default {
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
    const dated = s['timeline-date-field'] !== 'None';
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
      singletonNodes: vnodes.filter(x => x.degree === 0).length,
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
};
