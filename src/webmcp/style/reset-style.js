import { obj, bool } from '../schema.js';
import { T, counts, applySetting, KINDS, refreshTable, STYLE_KEYS } from './helpers.js';

export default {
  name: 'reset_style',
  title: 'Reset style',
  description: 'Resets styling to MicrobeTrace\'s defaults: colors, sizes, shapes, labels, tooltips, borders, floating table options, and (by default) the per-value color tables, opacities, renamed legend values and palettes. ' +
    'scope: nodes, links, page (selected and background colors), or all (default). Does not touch filters, the timeline, layout or data. This discards custom styling. Returns the settings changed.',
  inputSchema: obj({
    scope: { type: 'string', enum: ['all', 'nodes', 'links', 'page'], description: 'What to reset (default all)' },
    clearValueColors: bool('Also reset per-value colors, opacities, names and palettes for the scope (default true)')
  }),
  annotations: { consequentialHint: true },
  confirm: ({ scope = 'all' }) => 'Reset ' + (scope == 'all' ? 'all the styling' : 'the ' + ({ nodes: 'node', links: 'link', page: 'page' }[scope] || scope) + ' styling') + ' to the defaults. Custom colors and settings for it are lost.',
  execute: async ({ scope = 'all', clearValueColors = true }) => {
    T.requireData();
    const groups = scope == 'all' ? ['nodes', 'links', 'page'] : [scope];
    const defaults = self.MT.defaultWidgets, style = self.session.style, fresh = self.MT.sessionSkeleton().style;
    const keys = groups.flatMap(g => STYLE_KEYS[g]);
    const map = {};
    // Variables first, so the tables go before their colors are put back
    keys.sort((a, b) => (/-variable$/.test(a) ? 0 : 1) - (/-variable$/.test(b) ? 0 : 1)).forEach(k => { map[k] = defaults[k]; });
    const changes = {};
    for (const [k, v] of Object.entries(map)) {
      const r = await applySetting(k, Array.isArray(v) ? v.slice() : v);
      if (r.changed) changes[k] = { old: r.old, new: r.new };
    }
    if (clearValueColors) {
      groups.filter(g => g != 'page').forEach(g => {
        const kind = g == 'nodes' ? 'node' : 'link', cfg = KINDS[kind];
        style[cfg.table] = {};
        style[cfg.keys] = {};
        style[cfg.alphas] = fresh[cfg.alphas].slice();
        style[cfg.names] = {};
        style[cfg.palette] = fresh[cfg.palette].slice();
        if (kind == 'node') { style.nodeSymbolsTable = {}; style.nodeSymbolsTableKeys = {}; }
        style.overwrite = style.overwrite || {};
        delete style.overwrite[kind + 'ColorHeaderVariable'];
        delete style.overwrite[kind + 'ColorHeaderTitle'];
        cfg.create();
        refreshTable(kind);
      });
    }
    return { scope, changes, counts: counts() };
  }
};
