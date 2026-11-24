import { requireData, nodeById } from '../core.js';
import { RO, MT_, MAX_ALL_EDGES, nodeOut, seqProps, adjacency, neighborsOf, neighborRows } from './helpers.js';

export default {
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
};
