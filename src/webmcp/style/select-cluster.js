import { fail } from '../core.js';
import { obj, bool } from '../schema.js';
import { T, strList, nodes, applySelection, selectionSummary, modeSchema } from './helpers.js';

export default {
  name: 'select_cluster',
  title: 'Select clusters',
  description: 'Selects all nodes of one or more clusters (connected groups under the current link filter), named by cluster number or by nodes in them. ' +
    'mode: replace (default), add, remove or toggle. visibleOnly limits to visible nodes. Returns the selection summary. Requires loaded data.',
  inputSchema: obj({
    clusters: { type: 'array', items: { type: 'integer' }, description: 'Cluster numbers (the cluster field of nodes)' },
    nodeIds: strList('Select the clusters these nodes belong to'),
    visibleOnly: bool('Only visible nodes'),
    mode: modeSchema
  }),
  execute: async ({ clusters, nodeIds, visibleOnly, mode = 'replace' }) => {
    const all = nodes();
    const wanted = new Set(clusters || []);
    (nodeIds || []).forEach(id => { wanted.add(T.nodeById(id).cluster); });
    if (!wanted.size) fail('Give clusters or nodeIds');
    const set = new Set(all.filter(d => wanted.has(d.cluster) && (!visibleOnly || d.visible)));
    const changed = applySelection(set, mode);
    return Object.assign({ clusters: Array.from(wanted), matched: set.size, changed }, selectionSummary());
  }
};
