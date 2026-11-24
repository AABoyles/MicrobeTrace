import { obj, str } from '../schema.js';
import { W, toHex, applyAll, result } from './helpers.js';

export default {
  name: 'set_selected_color',
  title: 'Set selected-node color',
  description: 'Sets the color that marks selected nodes (selected-color, default #ff8300). The contrast color used for text over it follows automatically. Returns the settings.',
  inputSchema: obj({ color: str('Color, #rrggbb or CSS name') }, ['color']),
  execute: async ({ color }) => {
    const r = await applyAll({ 'selected-color': toHex(color) });
    return result(r, [], { color: W()['selected-color'], contrast: W()['selected-color-contrast'] });
  }
};
