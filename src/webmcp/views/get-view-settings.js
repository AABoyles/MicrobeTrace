import { fail } from '../core.js';
import { viewSchema, openSchema, rootOf, need, settingsOf, publicRecord, otherControls } from './helpers.js';

export default {
  name: 'get_view_settings',
  title: 'Get view settings',
  description: 'Discovers every setting of a view (the controls in its settings pane): key, label, what it does (from the control\'s tooltip), current value, type (boolean, number, choice, multi-choice, color, text), allowed options (value and label; variable menus list the loaded data\'s fields) or min/max/step, the pane tab and section it is in, and whether it is currently disabled or hidden (some controls only appear when another is set). Pass the keys to set_view_settings. These are the view\'s own settings; global ones (colors, filtering, selection) are separate tools. The view must be open. Also lists other_controls: inputs of the view that are not stored settings (for set_view_control).',
  inputSchema: {
    type: 'object',
    properties: {
      view: viewSchema,
      open: openSchema,
      keys: { type: 'array', items: { type: 'string' }, description: 'Only these settings (default all)' },
      onlyVisible: { type: 'boolean', description: 'Leave out hidden controls (default false)' }
    },
    required: ['view'],
    additionalProperties: false
  },
  annotations: { readOnlyHint: true },
  execute: async ({ view, open, keys, onlyVisible }) => {
    const item = await need(view, { open });
    let records = settingsOf(rootOf(item));
    if (keys) {
      const missing = keys.filter(k => !records.some(r => r.key == k));
      if (missing.length) fail('The ' + item.componentType + ' view has no setting ' + missing.join(', ') + '. Its settings: ' + records.map(r => r.key).join(', '));
      records = records.filter(r => keys.includes(r.key));
    }
    if (onlyVisible) records = records.filter(r => r.visible);
    return { view: item.componentType, count: records.length, settings: records.map(publicRecord), other_controls: otherControls(rootOf(item)) };
  }
};
