import { requireData } from '../core.js';
import { obj, str } from '../schema.js';
import { quote, stashOf } from './helpers.js';

export default {
  name: 'stash_session',
  title: 'Stash the session',
  description: 'Saves the current session in this browser under a name (key stash-<time>-<name>), to recall later with recall_stash, as File > Stash does. Stashed data stays on this computer\'s disk, which may matter for PII. Returns the stash\'s key.',
  inputSchema: obj({ name: str('A name for the stash (may be empty)') }),
  confirm: args => 'Store a copy of the session, with all its data, in this browser' + (args.name ? ' as ' + quote(args.name) : '') + '.',
  execute: async (args) => {
    requireData();
    const key = 'stash-' + Date.now() + '-' + (args.name || '');
    if (self.MT.syncLayout) self.MT.syncLayout();
    await self.db.setItem(key, JSON.stringify(self.session));
    return stashOf(key);
  }
};
