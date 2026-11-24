import { requireData, nodeById } from '../core.js';
import { RO, MT_ } from './helpers.js';

export default {
  name: 'get_link',
  title: 'Get link',
  description: 'The link between two nodes (in either order), with all its distance values, origin files and flags, and whether it is currently visible. Returns {exists:false} if the two nodes have no link (a pair above the threshold with no stored distance has none either). Fails if a node ID does not exist.',
  inputSchema: { type: 'object', properties: { source: { type: 'string' }, target: { type: 'string' } }, required: ['source', 'target'] },
  annotations: RO,
  execute: async ({ source, target }) => {
    requireData();
    nodeById(source); nodeById(target);
    const link = MT_().getLink(source, target);
    return link ? { exists: true, link } : { exists: false };
  }
};
