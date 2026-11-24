import { requireData } from '../core.js';
import { RO, round, scopeSchema, adjacency, quantile } from './helpers.js';

export default {
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
      singletons: ks.filter(k => k === 0).length,
      distribution: Array.from(hist, ([degree, count]) => ({ degree, count })).sort((a, b) => a.degree - b.degree),
      hubs: deg.sort((a, b) => b.k - a.k).slice(0, topHubs).map(x => ({ id: x.n._id, degree: x.k, cluster: x.n.cluster }))
    };
  }
};
