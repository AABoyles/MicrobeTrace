import { fail } from '../core.js';
import { obj, bool } from '../schema.js';
import { T, strList, nodes, applySelection, selectionSummary, modeSchema } from './helpers.js';

function resolveNodes({ ids, filter, match, all, visibleOnly }) {
  let candidates = nodes();
  if (visibleOnly) candidates = candidates.filter(d => d.visible);
  if (ids && ids.length) {
    const wanted = new Set(ids.map(String));
    const missing = ids.map(String).filter(id => !self.session.data.nodes.some(d => d._id == id));
    if (missing.length == ids.length) fail('None of those IDs match a node: ' + missing.slice(0, 5).join(', '));
    candidates = candidates.filter(d => wanted.has(String(d._id)));
    var unknown = missing;
  } else if (!filter && !all) {
    fail('Say which nodes: ids, filter (with optional match), or all: true');
  }
  if (filter && filter.length) candidates = T.filter(candidates, filter, match);
  return { set: new Set(candidates), unknown: unknown || [] };
}

export default {
  name: 'select_nodes',
  title: 'Select nodes',
  description: 'Selects (highlights) nodes in every view by ID and/or by a condition on node fields, and emits node-selected. ' +
    'ids and filter combine as an intersection (listed IDs that also meet the filter); all: true selects every node (or, with filter, those meeting it). ' +
    'mode: replace (default; deselect everything else), add, remove, or toggle. visibleOnly limits to nodes currently visible. ' +
    'Filter: array of {field, op, value}, ops eq ne lt lte gt gte in nin contains startsWith endsWith regex empty notEmpty. ' +
    'Returns how many nodes changed, the selected count and the first selected IDs. Requires loaded data. Use get_selection to read, clear_selection to clear.',
  inputSchema: obj({
    ids: strList('Node IDs (_id) to select'),
    filter: T.schemas.filter,
    match: T.schemas.match,
    all: bool('Select all nodes (subject to filter)'),
    visibleOnly: bool('Only consider visible nodes (default false)'),
    mode: modeSchema
  }),
  execute: async args => {
    const { set, unknown } = resolveNodes(args);
    const changed = applySelection(set, args.mode || 'replace');
    return Object.assign({ matched: set.size, changed, unknownIds: unknown }, selectionSummary());
  }
};
