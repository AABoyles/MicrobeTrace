import { sort, page, schemas } from '../core.js';
import { RO, P, nodeSelectProps, selectNodes, nodeOut, seqProps } from './helpers.js';

export default {
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
};
