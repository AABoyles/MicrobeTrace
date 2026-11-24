import { obj, bool } from '../schema.js';
import { applyAll, result } from './helpers.js';

export default {
  name: 'set_link_directed',
  title: 'Set link arrows',
  description: 'Shows (true) or hides (false) arrowheads pointing to links\' targets in the network view (link-directed). Returns the settings changed.',
  inputSchema: obj({ directed: bool('Show arrowheads') }, ['directed']),
  execute: async ({ directed }) => result(await applyAll({ 'link-directed': !!directed })),
};
