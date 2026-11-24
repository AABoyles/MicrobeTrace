import { obj } from '../schema.js';
import { T, readOnly, filterState } from './helpers.js';

export default {
  name: 'get_filter_state',
  title: 'Get filter state',
  description: 'Reports how the network is currently filtered: the link filter variable and threshold (and each variable\'s remembered threshold), pruning (none, nearest neighbor or minimum spanning tree) and epsilon, minimum cluster size, ' +
    'the timeline variable, visible/total counts of nodes, links and clusters, the numeric link fields that can be filtered on (with default thresholds of distance metrics), ' +
    'the range of the current variable\'s link values with an optional histogram (useful for choosing a threshold), and the largest clusters. Requires loaded data.',
  inputSchema: obj({ bins: { type: 'integer', minimum: 0, maximum: 200, description: 'Histogram bins for the link values of the filter variable (default 20; 0 for none)' } }),
  annotations: readOnly,
  execute: async ({ bins = 20 }) => { T.requireData(); return filterState(bins); }
};
