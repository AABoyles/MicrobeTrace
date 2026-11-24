import { fail } from '../core.js';
import { obj, str, num } from '../schema.js';
import { T, W, checkVariable, applyAll, result } from './helpers.js';

export default {
  name: 'label_nodes',
  title: 'Label nodes',
  description: 'Shows text labels next to nodes in the network view: variable is the node field to show ("None" hides labels), size the font size (6..72, default 16), orientation where the label sits relative to the node (Right, Left, Top, Bottom, Middle). Returns the settings changed.',
  inputSchema: obj({
    variable: str('Node field to label with, or "None"'),
    size: num('Font size, 6 to 72', { minimum: 1, maximum: 200 }),
    orientation: { type: 'string', enum: ['Right', 'Left', 'Top', 'Bottom', 'Middle'] }
  }),
  execute: async ({ variable, size, orientation }) => {
    T.requireData();
    const map = {};
    if (variable !== undefined) map['node-label-variable'] = checkVariable('node', variable);
    if (size !== undefined) map['node-label-size'] = size;
    if (orientation !== undefined) map['node-label-orientation'] = orientation;
    if (!Object.keys(map).length) fail('Give variable, size or orientation');
    const r = await applyAll(map);
    return result(r, [], { labels: { variable: W()['node-label-variable'], size: W()['node-label-size'], orientation: W()['node-label-orientation'] } });
  }
};
