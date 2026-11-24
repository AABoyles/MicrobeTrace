import { fail, requireData, page, schemas } from '../core.js';
import { RO, graph, P, scopeSchema, visibleSet, edgeList, filterSortEdges, linkOut } from './helpers.js';

function nodeIndexSet(ids, what) {
  const g = graph();
  const out = new Set();
  [].concat(ids).forEach(id => {
    const x = g.index.get('' + id);
    if (x === undefined) fail('No node has the ID ' + JSON.stringify(id) + (what ? ' (' + what + ')' : ''));
    out.add(x);
  });
  return out;
}

// Edges (as a list) matching: scope, touching nodes, between node sets, filter
function selectEdges(args) {
  const g = graph();
  let edges = edgeList(args.scope === 'all' ? 'all' : 'visible');
  if (args.nodes && args.nodes.length) {
    const set = nodeIndexSet(args.nodes);
    edges = edges.filter(e => set.has(g.source(e)) || set.has(g.target(e)));
  }
  if (args.between) {
    const a = nodeIndexSet(args.between.a || [], 'between.a'), b = nodeIndexSet(args.between.b || [], 'between.b');
    edges = edges.filter(e => { const s = g.source(e), t = g.target(e); return (a.has(s) && b.has(t)) || (a.has(t) && b.has(s)); });
  }
  return edges;
}

const linkQueryProps = {
  scope: scopeSchema,
  nodes: { type: 'array', items: { type: 'string' }, description: 'Only links touching any of these node IDs' },
  between: { type: 'object', description: 'Only links with one end in set a and the other in set b (node IDs)', properties: { a: { type: 'array', items: { type: 'string' } }, b: { type: 'array', items: { type: 'string' } } }, required: ['a', 'b'] },
  filter: schemas.filter,
  match: schemas.match
};

export default {
  name: 'query_links',
  title: 'Query links',
  description: 'Finds links (edges between nodes): filter by link fields (source, target, the distance metrics such as tn93/snps/distance, origin, nn, cluster, visible, and any column from a links file), restrict to links touching given node IDs or running between two sets of nodes, sort (e.g. by tn93 ascending for the closest pairs), and page. ' +
    'scope "visible" (default) searches the links currently shown; "all" searches every link, including computed distances above the threshold (refused above 4 million links). Each link has index, source, target, origin (files it came from), nn, directed, visible, cluster and its distance fields. ' +
    'Returns {total, offset, limit, returned, items}. With count:true only the total.',
  inputSchema: {
    type: 'object',
    properties: Object.assign({}, linkQueryProps, {
      sort: schemas.sort,
      fields: { type: 'array', items: { type: 'string' }, description: 'Link fields to return (default all)' },
      count: { type: 'boolean', description: 'Only return the number of matches' }
    }, P)
  },
  annotations: RO,
  execute: async args => {
    requireData();
    let edges = filterSortEdges(selectEdges(args), args);
    if (args.count) return { total: edges.length };
    const result = page(edges, args), vis = visibleSet();
    result.items = result.items.map(e => linkOut(e, args.fields, vis));
    return result;
  }
};
