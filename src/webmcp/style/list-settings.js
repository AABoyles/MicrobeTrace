import { obj, str, bool } from '../schema.js';
import { T, readOnly, controls, allKeys, describeSetting } from './helpers.js';

export default {
  name: 'list_settings',
  title: 'List settings',
  description: 'Lists MicrobeTrace\'s settings (the values behind the Settings dialog and every view\'s controls, stored in session.style.widgets). ' +
    'Each entry has: key, current value, default, type (boolean, number, string, array, object, null), whether it was modified from the default, and, when a control for it exists in the page right now ' +
    '(the global settings always; each view\'s controls only while that view is open), its control type (select, range, number, checkbox, radio, color, text, multiselect), ' +
    'options (select/radio values with labels), min/max/step, a human label and the view it belongs to. Filter by key prefix (e.g. "node-", "link-", "network-", "timeline-"), search text, view, or modified-only. ' +
    'Use get_settings / set_settings to read or change them. Many dedicated tools (set_link_filter, color_nodes, size_nodes...) wrap the common ones.',
  inputSchema: obj(Object.assign({
    prefix: str('Only keys starting with this, e.g. "node-color"'),
    search: str('Only keys, labels or option labels containing this text (case-insensitive)'),
    view: str('Only settings whose control is in this view (e.g. "network", "global settings"), when the view is open'),
    modifiedOnly: bool('Only settings that differ from their default'),
    withControlOnly: bool('Only settings that have a control in the page now')
  }, T.schemas.page)),
  annotations: readOnly,
  execute: async args => {
    const ctl = controls();
    const search = args.search && args.search.toLowerCase();
    let items = allKeys().filter(k => !args.prefix || k.startsWith(args.prefix)).map(k => describeSetting(k, ctl));
    if (args.modifiedOnly) items = items.filter(i => i.modified);
    if (args.withControlOnly) items = items.filter(i => i.control);
    if (args.view) items = items.filter(i => i.view == args.view);
    if (search) items = items.filter(i => i.key.toLowerCase().includes(search) || (i.label || '').toLowerCase().includes(search) ||
      (i.options || []).some(o => (o.label + ' ' + o.value).toLowerCase().includes(search)));
    return T.page(items, { offset: args.offset, limit: args.limit == null ? 200 : args.limit });
  }
};
