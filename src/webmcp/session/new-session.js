import { fail, waitFor } from '../core.js';
import { obj } from '../schema.js';
import { FILES_VIEW_WAIT_MS } from './helpers.js';

export default {
  name: 'new_session',
  title: 'Start a new session',
  description: 'Discards the current session (all loaded data, files and settings) and starts empty at the Files view, as File > New does. This cannot be undone; stash_session or save_session first if the data matters. You must pass confirm: true (and the user must then allow it).',
  inputSchema: obj({ confirm: { type: 'boolean', description: 'Must be true to proceed' } }, ['confirm']),
  annotations: { consequentialHint: true },
  // The confirm argument is the agent saying it means it; the user still decides
  confirm: args => {
    if (args.confirm !== true) fail('This discards all loaded data and settings. Pass confirm: true to proceed (stash_session or save_session first to keep it).');
    return 'Discard all the loaded data, files and settings, and start a new session. This cannot be undone.';
  },
  execute: async (args) => {
    if (args.confirm !== true) fail('This discards all loaded data and settings. Pass confirm: true to proceed (stash_session or save_session first to keep it).');
    self.MT.reset();
    await waitFor(() => self.MT.filesView, { timeout: FILES_VIEW_WAIT_MS, message: 'The Files view did not open' });
    return { reset: true, hint: 'Add files with add_file, or load_demo / generate_sequences / open_session.' };
  }
};
