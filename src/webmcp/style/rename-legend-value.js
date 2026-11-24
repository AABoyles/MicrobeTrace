import { fail } from '../core.js';
import { obj, str } from '../schema.js';
import { T, W, KINDS, legend, refreshTable } from './helpers.js';

export default {
  name: 'rename_legend_value',
  title: 'Rename legend value',
  description: 'Gives a value a different display name in the node or link color table and legends (as double-clicking a row does; the data is unchanged), or clears the custom name. ' +
    'Can also retitle the table header for the current color variable. Returns the legend. Requires loaded data.',
  inputSchema: obj({
    kind: { type: 'string', enum: ['node', 'link'] },
    value: { description: 'The value whose name to change (as text)' },
    name: str('The display name; empty text or omitted clears the custom name'),
    title: str('New header text for the table\'s name column (for the current color variable)')
  }, ['kind']),
  execute: async ({ kind, value, name, title }) => {
    T.requireData();
    const cfg = KINDS[kind], style = self.session.style;
    if (value === undefined && title === undefined) fail('Give value (with name) and/or title');
    if (value !== undefined) {
      style[cfg.names] = style[cfg.names] || {};
      const key = String(value);
      if (name === undefined || name === '') delete style[cfg.names][key];
      else style[cfg.names][key] = name;
    }
    if (title !== undefined) {
      const variable = W()[cfg.variable];
      if (variable == 'None') fail('There is no color table: color by a field first');
      style.overwrite = style.overwrite || {};
      style.overwrite[kind + 'ColorHeaderVariable'] = variable;
      style.overwrite[kind + 'ColorHeaderTitle'] = title;
    }
    refreshTable(kind);
    return legend(kind);
  }
};
