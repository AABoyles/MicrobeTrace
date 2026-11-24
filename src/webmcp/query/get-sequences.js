import { page } from '../core.js';
import { RO, clip, P, nodeSelectProps, selectNodes } from './helpers.js';

const fasta = (nodes, wrap) => nodes.map(n => '>' + n._id + '\n' + (wrap ? String(n.seq).replace(new RegExp('(.{' + wrap + '})', 'g'), '$1\n').trim() : n.seq)).join('\n') + '\n';

export default {
  name: 'get_sequences',
  title: 'Get sequences',
  description: 'The sequences of nodes (those that have one): by IDs, or by filter / visible / selected, paged. format "json" (default) gives [{id, length, seq}]; format "fasta" gives FASTA text in one string. Sequences can be long and numerous, so the default limit is 25 and maxLength can truncate each. ' +
    'Returns {total, offset, limit, returned, items} (json) or the same with fasta text.',
  inputSchema: {
    type: 'object',
    properties: Object.assign({}, nodeSelectProps, {
      format: { type: 'string', enum: ['json', 'fasta'], description: 'Default "json"' },
      maxLength: { type: 'integer', minimum: 1, description: 'Truncate each sequence to this many characters' },
      wrap: { type: 'integer', minimum: 10, description: 'FASTA line width (default: one line per sequence)' }
    }, { offset: P.offset, limit: { type: 'integer', minimum: 0, maximum: 10000, description: 'Most sequences (default 25)' } })
  },
  annotations: RO,
  execute: async args => {
    const nodes = selectNodes(args).filter(n => typeof n.seq === 'string' && n.seq);
    const result = page(nodes, { offset: args.offset, limit: args.limit == null ? 25 : args.limit });
    const items = result.items.map(n => ({ _id: n._id, seq: args.maxLength ? n.seq.slice(0, args.maxLength) : n.seq }));
    if (args.format == 'fasta') {
      result.fasta = fasta(items.map(n => ({ _id: n._id, seq: n.seq })), args.wrap);
      delete result.items;
    } else {
      result.items = result.items.map(n => ({ id: n._id, length: n.seq.length, seq: args.maxLength ? clip(n.seq, args.maxLength) : n.seq }));
    }
    return result;
  }
};
