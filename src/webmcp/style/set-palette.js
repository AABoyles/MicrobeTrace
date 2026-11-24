import { fail } from '../core.js';
import { obj, str, bool } from '../schema.js';
import { T, strList, toHex, KINDS, legend, refreshTable } from './helpers.js';

function schemeColors(name, size) {
  const s = self.d3[name];
  if (!Array.isArray(s)) fail('Unknown scheme ' + name + '. See list_palettes');
  if (typeof s[0] == 'string') return s.slice();
  const sizes = s.map((x, i) => x ? i : -1).filter(i => i >= 0);
  const n = size && s[size] ? size : sizes[sizes.length - 1];
  return s[n].slice();
}

export default {
  name: 'set_palette',
  title: 'Set color palette',
  description: 'Replaces the list of colors assigned, in order, to the values of a color-by field for nodes or links, from a named d3 scheme (see list_palettes) or an explicit list of colors. ' +
    'With apply (default true) the existing color tables (and opacities) are rebuilt from the new palette so the change shows immediately; otherwise it applies only to fields colored for the first time. ' +
    'Returns the palette and the legend. Requires loaded data.',
  inputSchema: obj({
    kind: { type: 'string', enum: ['node', 'link'] },
    scheme: str('d3 scheme name, e.g. "schemeTableau10"'),
    size: { type: 'integer', description: 'For schemes with several sizes (like schemeBlues), the number of colors (default the largest)' },
    colors: strList('Explicit colors (#rrggbb or CSS names), in order, instead of scheme'),
    apply: bool('Rebuild the current color tables from the palette (default true)')
  }, ['kind']),
  execute: async ({ kind, scheme, size, colors, apply = true }) => {
    T.requireData();
    let list;
    if (colors && colors.length) list = colors.map(toHex);
    else if (scheme) list = schemeColors(scheme, size);
    else fail('Give scheme or colors');
    const cfg = KINDS[kind], style = self.session.style;
    style[cfg.palette] = list;
    if (apply) {
      style[cfg.table] = {};
      style[cfg.keys] = {};
      style[cfg.alphas] = [1];
    }
    cfg.create();
    refreshTable(kind);
    return { kind, palette: list, legend: legend(kind) };
  }
};
