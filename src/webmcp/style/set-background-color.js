import { obj, str } from '../schema.js';
import { W, toHex, applyAll, result } from './helpers.js';

export default {
  name: 'set_background_color',
  title: 'Set background color',
  description: 'Sets the background color of the views (background-color, default #ffffff). The contrast color for text and gridlines (background-color-contrast) is chosen automatically, black or white. Returns the settings.',
  inputSchema: obj({ color: str('Color, #rrggbb or CSS name') }, ['color']),
  execute: async ({ color }) => {
    const r = await applyAll({ 'background-color': toHex(color) });
    return result(r, [], { color: W()['background-color'], contrast: W()['background-color-contrast'] });
  }
};
