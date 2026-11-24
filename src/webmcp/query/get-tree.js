import { requireData } from '../core.js';
import { RO, MT_ } from './helpers.js';

export default {
  name: 'get_tree',
  title: 'Get phylogenetic tree',
  description: 'The neighbor-joining phylogenetic tree of the nodes as a Newick string (branch lengths are distances). The tree is the one the Phylogenetic Tree view shows; if it has not been computed yet it is built from the distance matrix (compute "if-missing", the default), which can take a while for thousands of nodes and requires distances between nodes. ' +
    'Returns {newick, leaves, computed}. compute "never" returns {newick:null} instead of computing. A tree loaded from a Newick file is returned as loaded.',
  inputSchema: {
    type: 'object',
    properties: { compute: { type: 'string', enum: ['if-missing', 'always', 'never'], description: 'Whether to compute the tree: only if there is none (default), always (recompute from current distances), or never' } }
  },
  annotations: RO,
  execute: async ({ compute = 'if-missing' }) => {
    requireData();
    const t = self.temp;
    let computed = false;
    if (compute == 'always' || (compute == 'if-missing' && !(t && t.tree))) {
      await MT_().computeTree();
      computed = true;
    }
    if (!t || !t.tree) return { newick: null, leaves: 0, computed, note: 'No tree has been computed.' };
    const newick = typeof t.tree.toNewick === 'function' ? t.tree.toNewick() : String(t.tree);
    return { newick, leaves: (newick.match(/[,]/g) || []).length + 1, computed };
  }
};
