import { fail } from '../core.js';
import { obj } from '../schema.js';
import { timeoutSchema, dataLoaded, filesView, loading, summary } from './helpers.js';

export default {
  name: 'launch',
  title: 'Launch the network',
  description: 'Reads the pending files (add_file) with the current loading options (set_loading_options) and builds the network: parses the files, computes links from sequences if there are any, finds clusters, and opens the default view. ' +
    'Waits until the network has loaded (up to timeoutMs), then returns a summary: node, link and cluster counts, node and link fields, the open views, and the loading log messages. ' +
    'Fails if there are no files or a file has a problem (the error says which and how to fix it; see list_pending_files). Large sequence sets can take minutes.',
  inputSchema: obj({ timeoutMs: timeoutSchema(300000) }),
  annotations: { consequentialHint: true },
  confirm: () => dataLoaded() ? 'Build a new network from the files waiting to load, replacing the network loaded now.' : null,
  execute: async (args) => {
    if (!self.session.files.length) fail('There are no files to launch. Add some with add_file (or use load_demo / generate_sequences / open_session).');
    const view = await filesView();
    const problems = view.problems();
    if (problems.length) fail('Fix these files before launching: ' + problems.map(p => p.name + ': ' + p.problem).join(' | ') + '. Use update_pending_file to choose columns or a format.');
    await loading(async () => {
      if (!(await view.launch())) fail('Launch is not available: ' + (view.problems().map(p => p.name + ': ' + p.problem).join(' | ') || 'no files'));
    }, args.timeoutMs || 300000);
    return summary();
  }
};
