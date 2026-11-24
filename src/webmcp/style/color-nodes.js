import { fail } from '../core.js';
import { obj, str } from '../schema.js';
import { T, checkVariable, toHex, applyAll, legend, result } from './helpers.js';

export default {
  name: 'color_nodes',
  title: 'Color nodes',
  description: 'Chooses how nodes are colored: by the values of a node field (variable; each value gets a palette color, shown in the node color table) or, with variable "None", all one color (color, node-color). ' +
    'Both may be given. Applies in every view. Returns the settings changed and the node legend. Requires loaded data. Use set_node_value_colors to recolor particular values, set_palette to change the palette.',
  inputSchema: obj({
    variable: str('Node field to color by, or "None" for a single color'),
    color: str('The single color (#rrggbb or CSS name), used when variable is None')
  }),
  execute: async ({ variable, color }) => {
    T.requireData();
    const map = {};
    if (variable !== undefined) map['node-color-variable'] = checkVariable('node', variable);
    if (color !== undefined) map['node-color'] = toHex(color);
    if (!Object.keys(map).length) fail('Give variable and/or color');
    const r = await applyAll(map);
    return result(r, [], { legend: legend('node') });
  }
};
