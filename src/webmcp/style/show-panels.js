import { fail } from '../core.js';
import { obj, bool } from '../schema.js';
import { W, applyAll } from './helpers.js';

export default {
  name: 'show_panels',
  title: 'Show or hide floating panels',
  description: 'Shows or hides the floating panels over the views: the node color table, the link color table (both appear only while coloring by a field), the node shape table (network view) and the network statistics (node, link, cluster counts). ' +
    'Give any of the booleans. Returns which panels are shown.',
  inputSchema: obj({
    nodeColorTable: bool('Show the node color table'),
    linkColorTable: bool('Show the link color table'),
    nodeSymbolTable: bool('Show the node shape table'),
    statistics: bool('Show the network statistics panel')
  }),
  execute: async args => {
    const keys = { nodeColorTable: 'node-color-table-show', linkColorTable: 'link-color-table-show', nodeSymbolTable: 'node-symbol-table-show', statistics: 'network-statistics-show' };
    const map = {};
    Object.keys(keys).forEach(k => { if (args[k] !== undefined) map[keys[k]] = !!args[k]; });
    if (!Object.keys(map).length) fail('Give at least one panel');
    await applyAll(map);
    const w = W();
    const visible = id => { const el = document.getElementById(id); return !!el && el.style.display != 'none' && !el.hidden && getComputedStyle(el).display != 'none'; };
    return {
      settings: Object.fromEntries(Object.values(keys).map(k => [k, !!w[k]])),
      displayed: { nodeColorTable: visible('node-color-table-wrapper'), linkColorTable: visible('link-color-table-wrapper'), statistics: visible('network-statistics-wrapper') }
    };
  }
};
