import { fail } from '../core.js';
import { obj, str, num } from '../schema.js';
import { T, linkFields, checkVariable, linkFieldNumeric, applySetting, rank, filterState } from './helpers.js';

export default {
  name: 'set_link_filter',
  title: 'Set link filter',
  description: 'Sets how links are filtered, as the Filtering tab of the Settings dialog does: links are visible when the filter variable\'s value is at or below the threshold. ' +
    'All arguments are optional; give any. Changes rerun clustering and visibility and this waits until the network has finished updating. ' +
    'Changing the variable restores that variable\'s last threshold (or its metric\'s default, e.g. TN93 0.015, SNPs 16) unless you also pass threshold. ' +
    'Returns the old/new settings and the new visible counts of nodes, links and clusters. Requires loaded data. Use get_filter_state first to see the variables and value ranges.',
  inputSchema: obj({
    variable: str('Numeric link field to filter on (link-sort-variable), e.g. "tn93", "snps", "distance". See get_filter_state.numericLinkFields'),
    threshold: num('Maximum link value that still counts as a link (link-threshold); must be >= 0', { minimum: 0 }),
    prune: { type: 'string', enum: ['none', 'nn', 'mst'], description: 'How to prune links (link-prune): "none" keeps every link within the threshold; "nn" keeps each node\'s links to its nearest neighbors (can split clusters); "mst" keeps the minimum spanning tree (keeps clusters connected). Both keep near-ties (see epsilon) and may take a while for big networks' },
    epsilon: num('Tie tolerance exponent (filtering-epsilon, shown as Tie Tolerance): distances within a fraction 10^epsilon of each other count as ties when pruning. UI range -3..2')
  }),
  execute: async args => {
    T.requireData();
    const map = {};
    if (args.variable !== undefined) {
      const f = checkVariable('link', args.variable, { allowNone: false, what: 'variable' });
      if (!linkFieldNumeric(f)) fail('Link field ' + f + ' is not numeric, so it cannot be filtered on. Numeric fields: ' + linkFields().filter(linkFieldNumeric).join(', '));
      map['link-sort-variable'] = f;
    }
    if (args.threshold !== undefined) {
      if (typeof args.threshold !== 'number' || !isFinite(args.threshold) || args.threshold < 0) fail('threshold must be a number >= 0');
      map['link-threshold'] = args.threshold;
    }
    if (args.prune !== undefined) {
      if (!['none', 'nn', 'mst'].includes(args.prune)) fail('prune must be "none", "nn" or "mst"');
      map['link-prune'] = args.prune;
    }
    if (args.epsilon !== undefined) {
      if (typeof args.epsilon !== 'number' || !isFinite(args.epsilon)) fail('epsilon must be a number');
      map['filtering-epsilon'] = args.epsilon;
    }
    if (!Object.keys(map).length) fail('Give at least one of variable, threshold, prune, epsilon (get_filter_state reads the current state)');
    const keys = Object.keys(map).sort((a, b) => rank(a) - rank(b));
    const changes = {};
    for (const k of keys) {
      const r = await applySetting(k, map[k]);
      if (r.changed) changes[k] = { old: r.old, new: r.new };
    }
    // Changing the variable may bring back a different threshold than the old one
    return { changes, state: filterState(0) };
  }
};
