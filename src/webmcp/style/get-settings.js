import { obj } from '../schema.js';
import { readOnly, strList, controls, allKeys, describeSetting } from './helpers.js';

export default {
  name: 'get_settings',
  title: 'Get settings',
  description: 'Reads the current value (and default, type, control info, as list_settings gives) of specific settings by key. Unknown keys are reported in "unknown".',
  inputSchema: obj({ keys: strList('Setting keys, e.g. ["node-color-variable", "link-threshold"]') }, ['keys']),
  annotations: readOnly,
  execute: async ({ keys }) => {
    const ctl = controls(), known = new Set(allKeys());
    const settings = {}, unknown = [];
    keys.forEach(k => { if (known.has(k)) settings[k] = describeSetting(k, ctl); else unknown.push(k); });
    return { settings, unknown };
  }
};
