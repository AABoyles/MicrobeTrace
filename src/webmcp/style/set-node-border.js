import { fail } from '../core.js';
import { obj, str, num } from '../schema.js';
import { toHex, applyAll, result } from './helpers.js';

export default {
  name: 'set_node_border',
  title: 'Set node border',
  description: 'Sets the node outline: color (node-color-border, default #000000) and width (node-border-width, default 2; 0 for none). Returns the settings changed.',
  inputSchema: obj({ color: str('Border color'), width: num('Border width, >= 0', { minimum: 0 }) }),
  execute: async ({ color, width }) => {
    const map = {};
    if (color !== undefined) map['node-color-border'] = toHex(color);
    if (width !== undefined) map['node-border-width'] = width;
    if (!Object.keys(map).length) fail('Give color and/or width');
    return result(await applyAll(map));
  }
};
