import { requireData, filter, sort, page, schemas } from '../core.js';
import { RO, P } from './helpers.js';

const clusterRow = (c, members) => {
  const out = Object.assign({}, c);
  if (members) out.members = members;
  return out;
};

export default {
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
};
