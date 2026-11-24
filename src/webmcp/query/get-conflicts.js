import { requireData } from '../core.js';
import { RO, MT_ } from './helpers.js';

export default {
  name: 'get_conflicts',
  title: 'Get conflicts between files',
  description: 'Where files that describe the same nodes disagree: for each field, the IDs of the nodes whose files give different values (what the Conflicts view lists). Empty when only one file gave node data or the files agree. Use get_provenance to see each file\'s value for a node. ' +
    'Returns {total, fields:[{field, nodes:[ids], count}]}.',
  inputSchema: { type: 'object', properties: { field: { type: 'string', description: 'Only this field' }, maxNodes: { type: 'integer', minimum: 1, description: 'Most node IDs listed per field (default 100)' } } },
  annotations: RO,
  execute: async ({ field, maxNodes = 100 }) => {
    requireData();
    const fields = [];
    MT_().nodeConflicts().forEach((keys, f) => { if (!field || f === field) fields.push({ field: f, count: keys.length, nodes: Array.from(keys).slice(0, maxNodes) }); });
    return { total: fields.length, fields };
  }
};
