import { fail } from '../core.js';
import { obj, str } from '../schema.js';
import { filesView, pending } from './helpers.js';

export default {
  name: 'remove_pending_file',
  title: 'Remove a pending file',
  description: 'Removes a file from the Files view\'s pending list (it will not be read at launch). Returns the remaining pending files.',
  inputSchema: obj({ name: str('The pending file\'s name') }, ['name']),
  annotations: { consequentialHint: true },
  execute: async (args) => {
    const view = await filesView();
    if (!view.remove(self.MT.escape(args.name))) fail('No pending file is named ' + args.name + '. Pending: ' + JSON.stringify(view.list().map(f => f.name)));
    return pending(view);
  }
};
