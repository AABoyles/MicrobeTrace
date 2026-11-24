import { fail } from '../core.js';
import { obj } from '../schema.js';
import { T, checkVariable, applySetting } from './helpers.js';

export default {
  name: 'set_node_tooltip',
  title: 'Set node tooltip',
  description: 'Chooses which node fields the network view\'s hover tooltip shows (node-tooltip-variable): up to three node fields, in order. Default is just the ID (_id). Pass an empty list for the default. Returns the new setting.',
  inputSchema: obj({ variables: { type: 'array', items: { type: 'string' }, maxItems: 3, description: 'Up to 3 node fields' } }, ['variables']),
  execute: async ({ variables }) => {
    T.requireData();
    if (variables.length > 3) fail('At most 3 tooltip fields');
    variables.forEach(v => checkVariable('node', v, { allowNone: false }));
    const list = variables.length ? variables : ['_id'];
    const r = await applySetting('node-tooltip-variable', list);
    return { old: r.old, new: list };
  }
};
