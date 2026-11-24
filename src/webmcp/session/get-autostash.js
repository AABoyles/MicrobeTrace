import { obj } from '../schema.js';

export default {
  name: 'get_autostash',
  title: 'Get autostash',
  description: 'Says whether autostash is on: when it is, a session is stashed automatically each minute (named "autostash") after it loads, so it can be recovered after a crash. This stores data on disk, which may matter for PII.',
  inputSchema: obj({}),
  annotations: { readOnlyHint: true },
  untrusted: false,
  execute: async () => ({ autostash: (await self.db.getItem('stash-auto')) == 'true', running: !!(self.temp && self.temp.autostash) })
};
