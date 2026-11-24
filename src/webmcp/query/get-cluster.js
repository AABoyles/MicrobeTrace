import { fail, requireData, page } from '../core.js';
import { RO, P, scopeSchema, nodeOut, visibleSet, edgeList, linkOut, summarizeValues } from './helpers.js';

export default {
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
      const edges = edgeList(args.scope === 'all' ? 'all' : 'visible').filter(e => set.has(g.source(e)) && set.has(g.target(e)));
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
};
