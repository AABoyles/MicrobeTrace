import { obj, bool } from '../schema.js';
import { T, W, readOnly, legend, STYLE_KEYS } from './helpers.js';

export default {
  name: 'get_style',
  title: 'Get style',
  description: 'Summarizes the current styling in one call: node and link color variables and colors, sizes, shapes, labels, tooltips, borders, selected and background colors, which floating panels are shown, the palettes, and the node and link legends (compact). Requires loaded data.',
  inputSchema: obj({ legends: bool('Include the color legends (default true)') }),
  annotations: readOnly,
  execute: async ({ legends = true }) => {
    T.requireData();
    const w = W(), out = { settings: {} };
    Object.values(STYLE_KEYS).flat().forEach(k => { out.settings[k] = w[k]; });
    out.panels = { nodeColorTable: !!w['node-color-table-show'], linkColorTable: !!w['link-color-table-show'], nodeSymbolTable: !!w['node-symbol-table-show'], statistics: !!w['network-statistics-show'] };
    out.palettes = { nodeColors: self.session.style.nodeColors, linkColors: self.session.style.linkColors };
    out.shapes = self.session.style.nodeSymbols;
    if (legends) {
      const compact = l => Object.assign({}, l, { values: l.values.slice(0, 50).map(v => ({ value: v.value, name: v.name, count: v.count, color: v.color, opacity: v.opacity })), truncated: l.values.length > 50 });
      out.nodeLegend = compact(legend('node'));
      out.linkLegend = compact(legend('link'));
    }
    return out;
  }
};
