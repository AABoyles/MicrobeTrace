import { fail, requireData, sort } from '../core.js';
import { RO, round, scopeSchema, adjacency } from './helpers.js';

export default {
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
};
