import { obj } from '../schema.js';
import { quote, listStashes, findStash, stashRef } from './helpers.js';

export default {
  name: 'delete_stash',
  title: 'Delete a stash',
  description: 'Permanently deletes a stashed session (by key, or by name: the most recent with that name). It cannot be undone.',
  inputSchema: obj(stashRef),
  annotations: { consequentialHint: true },
  confirm: args => 'Permanently delete the stashed session ' + quote(args.key || args.name) + '.',
  execute: async (args) => {
    const stash = await findStash(args);
    await self.db.removeItem(stash.key);
    return { deleted: stash, remaining: (await listStashes()).length };
  }
};
