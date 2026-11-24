import { requireData, nodeById } from '../core.js';
import { RO, MT_, clip } from './helpers.js';

export default {
  name: 'get_provenance',
  title: 'Get provenance',
  description: 'Where a node\'s values came from when several files describe it: for each field (or one), each file\'s value, the row it came from, and which one is used (used: true). Fields given by only one file are omitted unless includeSingle. Fails for an unknown node ID.',
  inputSchema: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Node ID' }, field: { type: 'string', description: 'Only this field' }, includeSingle: { type: 'boolean', description: 'Also fields only one file gave (default false)' } },
    required: ['id']
  },
  annotations: RO,
  execute: async ({ id, field, includeSingle = false }) => {
    const MT = MT_(), d = requireData();
    const node = nodeById(id);
    const out = {};
    (field ? [field] : d.nodeFields).forEach(f => {
      if (f === 'seq' && !field) return;
      const p = MT.provenance(node._id, f).map(x => Object.assign({}, x, { value: clip(x.value, 100) }));
      if (p.length > (includeSingle || field ? 0 : 1)) out[f] = p;
    });
    return { id: node._id, provenance: out };
  }
};
