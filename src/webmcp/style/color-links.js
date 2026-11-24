import { fail } from '../core.js';
import { obj, str, num } from '../schema.js';
import { T, checkVariable, toHex, applyAll, legend, result } from './helpers.js';

export default {
  name: 'color_links',
  title: 'Color links',
  description: 'Chooses how links are colored: by the values of a link field (variable, e.g. "origin" for the source file, or a categorical field; each value gets a palette color, shown in the link color table) or, with variable "None", all one color (color, link-color). ' +
    'transparency (link-opacity, 0 opaque to 1 invisible) sets how see-through links are when not colored by a field. Returns the settings changed and the link legend. Requires loaded data.',
  inputSchema: obj({
    variable: str('Link field to color by, or "None"'),
    color: str('The single link color, used when variable is None'),
    transparency: num('0 (opaque) to 1 (fully transparent)', { minimum: 0, maximum: 1 })
  }),
  execute: async ({ variable, color, transparency }) => {
    T.requireData();
    const map = {};
    if (variable !== undefined) map['link-color-variable'] = checkVariable('link', variable);
    if (color !== undefined) map['link-color'] = toHex(color);
    if (transparency !== undefined) map['link-opacity'] = transparency;
    if (!Object.keys(map).length) fail('Give variable, color or transparency');
    const r = await applyAll(map);
    return result(r, [], { legend: legend('link') });
  }
};
