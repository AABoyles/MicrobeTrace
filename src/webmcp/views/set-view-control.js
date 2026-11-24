import { fail } from '../core.js';
import { viewSchema, openSchema, settle, rootOf, need, otherControls } from './helpers.js';

export default {
  name: 'set_view_control',
  title: 'Set view control',
  description: 'Sets an input of a view that is not a stored setting (listed as other_controls by get_view_settings, for example the field menus of Conflicts or Crosstab), by writing the control and firing its input/change events. control is the selector given there (such as "#conflicts-field"). value: a string (an option value or its label for menus), number, boolean (checkboxes) or an array (multi-select menus). Returns the control\'s resulting value.',
  inputSchema: {
    type: 'object',
    properties: {
      view: viewSchema,
      open: openSchema,
      control: { type: 'string', description: 'Selector from other_controls' },
      value: { description: 'The new value' }
    },
    required: ['view', 'control', 'value'],
    additionalProperties: false
  },
  execute: async ({ view, open, control, value }) => {
    const item = await need(view, { open, show: true });
    const root = rootOf(item);
    let el;
    try { el = root.querySelector(control); } catch { fail('Invalid selector ' + control); }
    if (!el) fail('No control ' + control + ' in the ' + item.componentType + ' view; see other_controls in get_view_settings');
    if (el.disabled) fail('That control is disabled right now');
    if (el.tagName === 'SELECT') {
      const options = Array.from(el.options);
      const want = [].concat(value).map(v => {
        const o = options.find(o => o.value === String(v)) || options.find(o => o.textContent.trim().toLowerCase() == String(v).toLowerCase());
        if (!o) fail('Not an option; the options are: ' + options.map(o => JSON.stringify(o.value)).join(', '));
        return o;
      });
      options.forEach(o => { o.selected = want.includes(o); });
    } else if (el.type == 'checkbox' || el.type == 'radio') {
      el.checked = !!(value === true || value === 'true');
    } else {
      el.value = value;
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    await settle(150);
    return otherControls(root).find(c => c.control == control) || { control, value: el.value };
  }
};
