import { fail } from '../core.js';
import { obj, str, num } from '../schema.js';
import { T, W, nodes, checkVariable, applyAll, result } from './helpers.js';

// Does a node field hold numbers (for sizing)?
function numericNodeField(field) {
  let n = 0, numeric = 0;
  for (const d of nodes()) {
    const v = d[field];
    if (v === null || v === undefined || v === '') continue;
    n++;
    if (typeof v === 'number' || (typeof v === 'string' && v.trim() !== '' && !isNaN(+v))) numeric++;
  }
  return n > 0 && numeric / n > 0.5;
}

export default {
  name: 'size_nodes',
  title: 'Size nodes',
  description: 'Sets node size. variable: a numeric node field to scale radius by (node-radius-variable; values map from min to max), or "None" for a fixed size (radius). ' +
    'radius is the fixed size; min and max bound the scaled range. Sizes are in the network view\'s units (default fixed 250, range 250 to 4500; sliders allow 100..5000). Returns the settings changed.',
  inputSchema: obj({
    variable: str('Numeric node field to size by, or "None"'),
    radius: num('Fixed radius when variable is None', { minimum: 1 }),
    min: num('Smallest radius when scaling by a variable', { minimum: 1 }),
    max: num('Largest radius when scaling by a variable', { minimum: 1 })
  }),
  execute: async ({ variable, radius, min, max }) => {
    T.requireData();
    const map = {}, warnings = [];
    if (variable !== undefined) {
      map['node-radius-variable'] = checkVariable('node', variable);
      if (variable !== 'None' && !numericNodeField(variable)) warnings.push('Field ' + variable + ' does not look numeric; sizes may not vary');
    }
    if (radius !== undefined) map['node-radius'] = radius;
    if (min !== undefined) map['node-radius-min'] = min;
    if (max !== undefined) map['node-radius-max'] = max;
    if (!Object.keys(map).length) fail('Give variable, radius, min or max');
    const lo = min !== undefined ? min : W()['node-radius-min'], hi = max !== undefined ? max : W()['node-radius-max'];
    if (lo > hi) fail('min (' + lo + ') cannot exceed max (' + hi + ')');
    const r = await applyAll(map);
    return result(r, warnings, { sizing: { variable: W()['node-radius-variable'], radius: W()['node-radius'], min: W()['node-radius-min'], max: W()['node-radius-max'] } });
  }
};
