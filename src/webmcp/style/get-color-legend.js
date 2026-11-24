import { obj } from '../schema.js';
import { T, W, readOnly, legend } from './helpers.js';

export default {
  name: 'get_color_legend',
  title: 'Get color legend',
  description: 'Returns the color legend for nodes or links: the field being colored by, and for each value (among visible nodes/links) its count, frequency, color (#rrggbb), opacity (1 opaque) and any custom display name. ' +
    'With no color variable, returns the single color. For nodes it also reports the shape variable and symbols if shapes vary. These are the rows of the floating color table. Requires loaded data.',
  inputSchema: obj(Object.assign({
    kind: { type: 'string', enum: ['node', 'link'], description: 'Whose legend' },
    sortBy: { type: 'string', enum: ['count', 'value', 'table'], description: 'count (default, most first), value, or table (the order of the underlying color table)' }
  }, T.schemas.page), ['kind']),
  annotations: readOnly,
  execute: async ({ kind, sortBy = 'count', offset, limit }) => {
    T.requireData();
    const l = legend(kind);
    if (sortBy == 'count') l.values.sort((a, b) => b.count - a.count);
    else if (sortBy == 'value') l.values.sort((a, b) => T.compare(a.value, b.value));
    const p = T.page(l.values, { offset, limit: limit == null ? 200 : limit });
    const out = Object.assign({}, l, { values: p.items, returned: p.returned, offset: p.offset });
    if (kind == 'node') {
      const sv = W()['node-symbol-variable'];
      out.shapeVariable = sv;
      out.defaultShape = W()['node-symbol'];
      if (sv != 'None' && self.session.style.nodeSymbolsTable[sv]) {
        const keys = self.session.style.nodeSymbolsTableKeys[sv] || [], symbols = self.session.style.nodeSymbolsTable[sv];
        out.shapes = keys.map((value, i) => ({ value: String(value), shape: symbols[i] }));
      }
    }
    const o = self.session.style.overwrite || {};
    if (o[kind + 'ColorHeaderVariable'] == l.variable) out.title = o[kind + 'ColorHeaderTitle'];
    return out;
  }
};
