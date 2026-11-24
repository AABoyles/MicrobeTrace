import { fail } from '../core.js';
import { RO, MT_, nodeSelectProps, selectNodes } from './helpers.js';

export default {
  name: 'get_consensus',
  title: 'Get consensus sequence',
  description: 'The consensus sequence (most common base at each position) of the chosen nodes\' sequences: by IDs, filter, visible or selected nodes (default all nodes with sequences). Sequences should be aligned (as MicrobeTrace\'s alignment gives). Returns {consensus, length, nodes}.',
  inputSchema: { type: 'object', properties: nodeSelectProps },
  annotations: RO,
  execute: async args => {
    const nodes = selectNodes(args).filter(n => typeof n.seq === 'string' && n.seq);
    if (!nodes.length) fail('None of the chosen nodes has a sequence');
    const consensus = await MT_().computeConsensus(nodes.map(n => ({ _id: n._id, seq: n.seq })));
    return { consensus, length: consensus.length, nodes: nodes.length };
  }
};
