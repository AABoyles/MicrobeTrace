import { fail } from '../core.js';
import { obj } from '../schema.js';
import { timeoutSchema, quote, replacing, loading, summary, checkSession, findStash, stashRef } from './helpers.js';

export default {
  name: 'recall_stash',
  title: 'Recall a stashed session',
  description: 'Loads a stashed session (by key, or by name for the most recent with that name), replacing the current data. Waits for the network to load and returns the summary.',
  inputSchema: obj(Object.assign({ timeoutMs: timeoutSchema(300000) }, stashRef)),
  annotations: { consequentialHint: true },
  // A stash is another dataset than the one the user is sharing, and recalling it replaces that
  confirm: args => 'Recall the stashed session ' + quote(args.key || args.name) + replacing() + '.',
  execute: async (args) => {
    if (!args.key && !args.name && args.name !== '') fail('Give the stash\'s key or name (list_stashes shows them)');
    const stash = await findStash(args);
    const json = await self.db.getItem(stash.key);
    let data;
    try { data = JSON.parse(json); } catch (error) { fail('That stash could not be read: ' + error.message); }
    checkSession(data);
    await loading(() => self.MT.applySession(data), args.timeoutMs || 300000);
    return Object.assign({ recalled: stash }, summary());
  }
};
