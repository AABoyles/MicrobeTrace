import { fail, requireData, nodeById } from '../core.js';
import { RO, round, scopeSchema, visibleSet, linkFieldNames, linkOut, adjacency } from './helpers.js';

// Binary min-heap
class Heap {
  constructor() { this.a = []; }
  push(k, v) { const a = this.a; a.push([k, v]); let i = a.length - 1; while (i) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } }
  pop() {
    const a = this.a, top = a[0], last = a.pop();
    if (a.length) { a[0] = last; let i = 0; for (;;) { let l = 2 * i + 1, r = l + 1, m = i; if (l < a.length && a[l][0] < a[m][0]) m = l; if (r < a.length && a[r][0] < a[m][0]) m = r; if (m == i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } }
    return top;
  }
  get size() { return this.a.length; }
}

export default {
  name: 'shortest_path',
  title: 'Shortest path',
  description: 'The shortest path between two nodes through links. By default it minimises the number of hops; give weight (a link field such as tn93 or distance) to minimise the total of that field instead (links with no value for it are not used). scope "visible" (default) uses the links currently shown, "all" every link. ' +
    'Returns {found, hops, totalWeight, path:[node IDs], links:[the link between each pair]}; found is false if the nodes are not connected. Fails for unknown IDs.',
  inputSchema: {
    type: 'object',
    properties: {
      source: { type: 'string' }, target: { type: 'string' },
      weight: { type: 'string', description: 'Link field to minimise the sum of (default: hop count)' },
      scope: scopeSchema,
      linkFields: { type: 'array', items: { type: 'string' }, description: 'Link fields to return for the path links (default all)' }
    },
    required: ['source', 'target']
  },
  annotations: RO,
  execute: async ({ source, target, weight, scope = 'visible', linkFields }) => {
    requireData();
    nodeById(source); nodeById(target);
    const { nbr, eds, g } = adjacency(scope);
    const s = g.index.get('' + source), t = g.index.get('' + target);
    if (weight && !linkFieldNames().includes(weight)) fail('Unknown link field ' + JSON.stringify(weight));
    const dist = new Map([[s, 0]]), prev = new Map(), heap = new Heap();
    heap.push(0, s);
    const done = new Set();
    while (heap.size) {
      const [d, x] = heap.pop();
      if (done.has(x)) continue;
      done.add(x);
      if (x == t) break;
      nbr[x].forEach((y, i) => {
        let w = 1;
        if (weight) { w = parseFloat(g.getValue(eds[x][i], weight)); if (isNaN(w)) return; if (w < 0) w = 0; }
        const nd = d + w;
        if (!dist.has(y) || nd < dist.get(y)) { dist.set(y, nd); prev.set(y, [x, eds[x][i]]); heap.push(nd, y); }
      });
    }
    if (!dist.has(t)) return { found: false, source, target, scope };
    const path = [t], es = [];
    for (let x = t; x != s;) { const [p, e] = prev.get(x); es.unshift(e); path.unshift(p); x = p; }
    const vis = visibleSet();
    return { found: true, hops: es.length, totalWeight: round(dist.get(t)), weight: weight || 'hops', path: path.map(x => g.ids[x]), links: es.map(e => linkOut(e, linkFields, vis)) };
  }
};
