import { fail } from '../core.js';
import { obj, bool } from '../schema.js';
import { strList, nodes, applySelection, selectionSummary, modeSchema } from './helpers.js';

export default {
  name: 'select_neighbors',
  title: 'Select neighbors',
  description: 'Expands a set of nodes to their neighbors along the currently visible links, to a given number of steps, and selects the result. ' +
    'The seed nodes are the given ids, or the currently selected nodes when ids is omitted. includeSeeds (default true) keeps the seeds selected. ' +
    'mode: replace (default), add, remove or toggle. Returns the selection summary and how many nodes lie at each distance. Requires loaded data.',
  inputSchema: obj({
    ids: strList('Seed node IDs (default: the current selection)'),
    depth: { type: 'integer', minimum: 1, maximum: 50, description: 'Steps along links (default 1)' },
    includeSeeds: bool('Keep the seed nodes in the result (default true)'),
    mode: modeSchema
  }),
  execute: async ({ ids, depth = 1, includeSeeds = true, mode = 'replace' }) => {
    const all = nodes(), g = self.session.data.graph;
    const byId = new Map(all.map(d => [String(d._id), d]));
    let seeds;
    if (ids && ids.length) {
      const unknown = ids.filter(id => !byId.has(String(id)));
      if (unknown.length == ids.length) fail('None of those IDs match a node: ' + unknown.slice(0, 5).join(', '));
      seeds = ids.map(id => byId.get(String(id))).filter(Boolean);
    } else {
      seeds = all.filter(d => d.selected);
      if (!seeds.length) fail('No seed nodes: pass ids or select some nodes first');
    }
    const adjacency = new Map();
    const link = (a, b) => { if (!adjacency.has(a)) adjacency.set(a, []); adjacency.get(a).push(b); };
    for (let i = 0; i < g.visibleCount; i++) {
      const e = g.visible[i], s = g.ids[g.source(e)], t = g.ids[g.target(e)];
      link(s, t); link(t, s);
    }
    const distance = new Map(seeds.map(d => [String(d._id), 0]));
    let frontier = seeds.map(d => String(d._id));
    for (let step = 1; step <= depth && frontier.length; step++) {
      const next = [];
      frontier.forEach(id => (adjacency.get(id) || []).forEach(n => {
        if (!distance.has(n)) { distance.set(n, step); next.push(n); }
      }));
      frontier = next;
    }
    const set = new Set();
    distance.forEach((dist, id) => { if ((includeSeeds || dist > 0) && byId.has(id)) set.add(byId.get(id)); });
    const byDistance = {};
    distance.forEach(dist => { byDistance[dist] = (byDistance[dist] || 0) + 1; });
    const changed = applySelection(set, mode);
    return Object.assign({ seeds: seeds.length, reached: set.size, nodesAtDistance: byDistance, changed }, selectionSummary());
  }
};
