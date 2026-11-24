import { fail, requireData, filter, sort, page, schemas } from '../core.js';
import { RO, isEmpty, round, P, nodeSelectProps, selectNodes, quantile, groupKey } from './helpers.js';

const OPS_AGG = ['count', 'sum', 'mean', 'min', 'max', 'median', 'distinct'];

export default {
  name: 'aggregate',
  title: 'Aggregate nodes',
  description: 'Groups nodes by one or more fields and computes statistics per group, like a pivot table / SQL GROUP BY. Always gives count per group; metrics add numeric aggregations of other fields: sum, mean, min, max, median or distinct (count of distinct values). With no groupBy, aggregates all (filtered) nodes together. ' +
    'Example: groupBy:["state"], metrics:[{field:"degree",op:"mean"}]. Rows can be filtered with having (on count and metric columns, e.g. field "count"), sorted and paged. Metric columns are named op_field (mean_degree). Returns {total, items:[{<groupBy fields>, count, op_field...}]}.',
  inputSchema: {
    type: 'object',
    properties: Object.assign({
      groupBy: { type: 'array', items: { type: 'string' }, description: 'Node fields to group by (can be empty)' },
      metrics: { type: 'array', items: { type: 'object', properties: { field: { type: 'string' }, op: { type: 'string', enum: OPS_AGG } }, required: ['field', 'op'] }, description: 'Aggregations of numeric (or any, for distinct) fields' },
      having: Object.assign({}, schemas.filter, { description: 'Conditions on the resulting rows, e.g. [{field:"count",op:"gte",value:5}]' }),
      sort: schemas.sort
    }, nodeSelectProps, P)
  },
  annotations: RO,
  execute: async args => {
    const d = requireData();
    const groupBy = args.groupBy || [], metrics = args.metrics || [];
    groupBy.concat(metrics.map(m => m.field)).forEach(f => { if (!d.nodeFields.includes(f)) fail('Unknown node field ' + JSON.stringify(f)); });
    metrics.forEach(m => { if (!OPS_AGG.includes(m.op)) fail('Unknown metric op ' + m.op + '; use one of ' + OPS_AGG.join(', ')); });
    const groups = new Map();
    selectNodes(args).forEach(n => {
      const key = JSON.stringify(groupKey(n, groupBy));
      let g = groups.get(key);
      if (!g) { g = { nodes: [], key: groupBy.map(f => isEmpty(n[f]) ? null : n[f] instanceof Date ? n[f].toISOString() : n[f]) }; groups.set(key, g); }
      g.nodes.push(n);
    });
    let rows = Array.from(groups.values()).map(g => {
      const row = {};
      groupBy.forEach((f, i) => { row[f] = g.key[i]; });
      row.count = g.nodes.length;
      metrics.forEach(m => {
        const vals = g.nodes.map(n => n[m.field]).filter(v => !isEmpty(v));
        const nums = vals.map(Number).filter(v => !isNaN(v)).sort((a, b) => a - b);
        let v = null;
        switch (m.op) {
          case 'count': v = vals.length; break;
          case 'distinct': v = new Set(vals.map(String)).size; break;
          case 'sum': v = nums.reduce((a, b) => a + b, 0); break;
          case 'mean': v = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null; break;
          case 'min': v = nums.length ? nums[0] : null; break;
          case 'max': v = nums.length ? nums[nums.length - 1] : null; break;
          case 'median': v = quantile(nums, 0.5); break;
        }
        row[m.op + '_' + m.field] = round(v);
      });
      return row;
    });
    rows = filter(rows, args.having);
    rows = sort(rows, args.sort && args.sort.length ? args.sort : [{ field: 'count', descending: true }]);
    return page(rows, args);
  }
};
