import { fail } from '../core.js';
import { obj, str, num } from '../schema.js';
import { T, W, checkVariable, linkFieldNumeric, applyAll, result } from './helpers.js';

export default {
  name: 'set_link_width',
  title: 'Set link width',
  description: 'Sets link thickness in the network view: a fixed width (width, default 3), or scaled by a numeric link field (variable; values map from min to max, defaults 3 to 27), "None" for fixed. Widths are 0.3..30 on the sliders. Returns the settings changed.',
  inputSchema: obj({
    variable: str('Numeric link field to scale width by, or "None"'),
    width: num('Fixed width when variable is None', { minimum: 0 }),
    min: num('Thinnest width when scaling', { minimum: 0 }),
    max: num('Thickest width when scaling', { minimum: 0 })
  }),
  execute: async ({ variable, width, min, max }) => {
    T.requireData();
    const map = {}, warnings = [];
    if (variable !== undefined) {
      map['link-width-variable'] = checkVariable('link', variable);
      if (variable != 'None' && !linkFieldNumeric(variable)) warnings.push('Link field ' + variable + ' does not look numeric; widths may not vary');
    }
    if (width !== undefined) map['link-width'] = width;
    if (min !== undefined) map['link-width-min'] = min;
    if (max !== undefined) map['link-width-max'] = max;
    if (!Object.keys(map).length) fail('Give variable, width, min or max');
    const lo = min !== undefined ? min : W()['link-width-min'], hi = max !== undefined ? max : W()['link-width-max'];
    if (lo > hi) fail('min (' + lo + ') cannot exceed max (' + hi + ')');
    const r = await applyAll(map);
    return result(r, warnings, { width: { variable: W()['link-width-variable'], width: W()['link-width'], min: W()['link-width-min'], max: W()['link-width-max'] } });
  }
};
