import { obj } from '../schema.js';
import { listStashes } from './helpers.js';

export default {
  name: 'list_stashes',
  title: 'List stashed sessions',
  description: 'Lists the sessions stashed in this browser (File > Stash), newest first: key, name, time. Stashes live in the browser\'s IndexedDB and persist across reloads. Autostash saves are named "autostash".',
  inputSchema: obj({}),
  annotations: { readOnlyHint: true },
  execute: async () => ({ stashes: await listStashes() })
};
