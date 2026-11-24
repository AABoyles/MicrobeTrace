import { fail } from '../core.js';
import { RO, MT_, settings, graph, isInternal, round, nodeSelectProps, selectNodes, linkFieldNames } from './helpers.js';

export default {
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
    if (args.format === 'pairs') {
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
};
