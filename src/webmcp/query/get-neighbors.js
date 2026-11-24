import { requireData } from '../core.js';
import { RO, scopeSchema, neighborsOf, neighborRows } from './helpers.js';

export default {
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
};
