import { fail } from '../core.js';
import { obj, str, num, bool } from '../schema.js';
import { T, S, W, checkVariable, toHex, KINDS, legend, refreshTable } from './helpers.js';

function valueColorTool(kind) {
  const cfg = KINDS[kind], Kind = kind === 'node' ? 'node' : 'link';
  return {
    name: 'set_' + kind + '_value_colors',
    title: 'Set ' + Kind + ' value colors',
    description: 'Edits the color table rows for the field ' + Kind + 's are colored by: gives particular values their own color and/or opacity, as editing the floating ' + Kind + ' color table does. ' +
      'values is a list of {value, color?, opacity?}; value is the field value as text as get_color_legend lists it (e.g. "Georgia", "0"). color is #rrggbb or a CSS color name; opacity is 0 (invisible) to 1 (opaque). ' +
      'variable switches the color-by field first (otherwise the current one is used; color the ' + Kind + 's by a field first with color_' + Kind + 's). reset: true restores the palette colors for this field before applying. ' +
      'Notes: colors are kept per field but follow the position of the value in the table, so they can shift if filtering changes which values are visible; opacities are shared by all fields by position. ' +
      'All values are checked before anything is applied. Returns the resulting legend. Requires loaded data.',
    inputSchema: obj({
      variable: str(Kind + ' field to color by (default: the current one)'),
      values: { type: 'array', description: 'Rows to change', items: obj({
        value: { description: 'The value of the field (as text, or a number)' },
        color: str('New color, #rrggbb or a CSS color name'),
        opacity: num('0 to 1; 1 is opaque', { minimum: 0, maximum: 1 })
      }, ['value']) },
      reset: bool('Restore this field\'s palette colors and opacities first')
    }, ['values']),
    execute: async ({ variable, values, reset }) => {
      T.requireData();
      if (variable !== undefined) {
        const v = checkVariable(kind, variable, { allowNone: false });
        if (W()[cfg.variable] !== v) S().set(cfg.variable, v);
      }
      const current = W()[cfg.variable];
      if (current === 'None') fail('The ' + Kind + 's are not colored by a field. Use color_' + Kind + 's with a variable first, or pass variable');
      const style = self.session.style;
      if (reset) {
        delete style[cfg.table][current];
        delete style[cfg.keys][current];
        style[cfg.alphas] = [1];
      }
      cfg.create();
      const keys = style[cfg.keys][current], colors = style[cfg.table][current];
      const errors = [];
      const edits = values.map(({ value, color, opacity }) => {
        const key = String(value);
        const index = keys.findIndex(k => k === key);
        if (index < 0) { errors.push('No row for value ' + JSON.stringify(key)); return null; }
        let hex = null;
        if (color !== undefined) { try { hex = toHex(color); } catch (e) { errors.push(e.message); return null; } }
        if (opacity !== undefined && (typeof opacity !== 'number' || opacity < 0 || opacity > 1)) { errors.push('opacity for ' + key + ' must be 0..1'); return null; }
        return { index, hex, opacity };
      });
      if (errors.length) fail(errors.slice(0, 10).join('; ') + (errors.length > 10 ? '; ...' : '') + '. Values available: ' + keys.slice(0, 30).join(', ') + (keys.length > 30 ? ', ...' : ''));
      edits.forEach(({ index, hex, opacity }) => {
        if (hex) colors[index] = hex;
        if (opacity !== undefined) {
          while (style[cfg.alphas].length <= index) style[cfg.alphas].push(1);
          style[cfg.alphas][index] = opacity;
        }
      });
      cfg.create();
      refreshTable(kind);
      return { applied: edits.length, legend: legend(kind) };
    }
  };
}

export const node = valueColorTool('node');

export const link = valueColorTool('link');
