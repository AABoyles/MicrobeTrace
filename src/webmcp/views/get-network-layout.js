import { need, networkHandle, networkState } from './helpers.js';

export default {
  name: 'get_network_layout',
  title: 'Get network layout',
  description: 'Returns where the network view has put its nodes: each node\'s id and x/y position in layout space (as drawn now, including pinned nodes), with the view\'s state (zoom, pinned, simulation running). Useful for finding which nodes lie close together visually or for judging the layout. The network view must be open. Positions are rounded to `precision` decimals (default 1).',
  inputSchema: {
    type: 'object',
    properties: {
      ids: { type: 'array', items: { type: 'string' }, description: 'Only these node ids (default all, up to limit)' },
      limit: { type: 'integer', minimum: 1, maximum: 20000, description: 'Most nodes to return (default 2000)' },
      precision: { type: 'integer', minimum: 0, maximum: 6, description: 'Decimals to keep (default 1)' }
    },
    additionalProperties: false
  },
  annotations: { readOnlyHint: true },
  execute: async ({ ids, limit = 2000, precision = 1 }) => {
    await need('network');
    const h = networkHandle();
    const p = h.graph.getPointPositions();
    const k = Math.pow(10, precision);
    const want = ids && new Set(ids.map(String));
    const nodes = [];
    let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
    h.points.forEach((d, i) => {
      const x = p[2 * i], y = p[2 * i + 1];
      if (x !== x) return;
      if (x < xmin) xmin = x; if (x > xmax) xmax = x; if (y < ymin) ymin = y; if (y > ymax) ymax = y;
      if (want && !want.has(String(d._id))) return;
      if (nodes.length < limit) nodes.push({ id: d._id, x: Math.round(x * k) / k, y: Math.round(y * k) / k, pinned: !!d.fixed, cluster: d.cluster === undefined ? null : d.cluster });
    });
    return Object.assign(networkState(h), { returned: nodes.length, bounds: { xmin, xmax, ymin, ymax }, nodes });
  }
};
