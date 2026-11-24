import { fail } from '../core.js';
import { obj } from '../schema.js';
import { filesView, pending } from './helpers.js';

export default {
  name: 'reorder_pending_files',
  title: 'Reorder pending files',
  description: 'Sets the order of the pending files: those named come first, in the order given, and the rest follow as they were. Where files disagree about a node\'s value, the file nearest the top wins. Returns the pending files in their new order.',
  inputSchema: obj({ order: { type: 'array', items: { type: 'string' }, description: 'File names, highest priority first' } }, ['order']),
  execute: async (args) => {
    const view = await filesView();
    const names = args.order.map(n => self.MT.escape(n));
    const missing = names.filter(n => !view.list().some(f => f.name == n));
    if (missing.length) fail('No pending file is named ' + missing.join(', ') + '. Pending: ' + JSON.stringify(view.list().map(f => f.name)));
    view.reorder(names);
    return pending(view);
  }
};
