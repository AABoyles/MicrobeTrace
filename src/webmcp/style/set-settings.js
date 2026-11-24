import { fail } from '../core.js';
import { obj, bool } from '../schema.js';
import { counts, controls, allKeys, coerce, applyAll, rank } from './helpers.js';

export default {
  name: 'set_settings',
  title: 'Set settings',
  description: 'Changes one or more settings by key, through MicrobeTrace\'s settings store so views and the page react exactly as if a control had been used. ' +
    'Values are checked against each setting\'s type and, where a control exists, its options (an invalid value fails the whole call with nothing applied); out-of-range numbers are applied with a warning. ' +
    'Unknown keys are skipped with a warning unless allowNew is true. Settings are applied in a sensible order (filter settings first, then variable choices, then the rest), ' +
    'and filter settings (link-threshold, link-sort-variable, link-prune, filtering-epsilon, cluster-minimum-size) wait for the network to finish updating. ' +
    'Returns {applied: {key: {old, new}}, unchanged, warnings, counts}. Prefer the dedicated tools for common changes; use list_settings to discover keys.',
  inputSchema: obj({
    values: { type: 'object', description: 'Map of setting key to new value, e.g. {"node-color": "#ff0000", "link-width": 4}', additionalProperties: true },
    allowNew: bool('Create keys that are not existing settings (default false: they are skipped with a warning)')
  }, ['values']),
  execute: async ({ values, allowNew }) => {
    if (!values || typeof values != 'object' || !Object.keys(values).length) fail('values must be an object of {key: value}');
    const known = new Set(allKeys()), warnings = [];
    const map = {};
    Object.keys(values).sort((a, b) => rank(a) - rank(b)).forEach(k => {
      if (known.has(k) || allowNew) map[k] = values[k];
      else warnings.push('Unknown setting ' + JSON.stringify(k) + ' skipped (use list_settings to see keys, or allowNew to create it)');
    });
    const ctl = controls();
    // Check everything before applying anything
    Object.keys(map).forEach(k => { map[k] = coerce(k, map[k], ctl).value; });
    const r = await applyAll(map);
    const unchanged = Object.keys(map).filter(k => !(k in r.changes));
    return { applied: r.changes, unchanged, warnings: warnings.concat(r.warnings), counts: self.session.data.nodes.length ? counts() : null };
  }
};
