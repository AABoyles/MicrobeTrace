import { fail, requireData, schemas } from '../core.js';
import { W, RO, isEmpty, nodeSelectProps, selectNodes, groupKey } from './helpers.js';

export default {
  name: 'crosstab',
  title: 'Crosstab',
  description: 'Counts nodes by the combinations of two node fields, like the Crosstab view: rows are values of fieldA, columns values of fieldB, cells are counts. Also gives row and column totals. Empty values are shown as "(Empty)". Use for questions like "how many cases per state and group". ' +
    'Returns {rows, columns, matrix[row][col], rowTotals, columnTotals, total}.',
  inputSchema: {
    type: 'object',
    properties: Object.assign({
      fieldA: { type: 'string', description: 'Node field for the rows' },
      fieldB: { type: 'string', description: 'Node field for the columns' },
      orderBy: { type: 'string', enum: ['label', 'count'], description: 'Order of rows and columns: by value (default) or descending count' },
      includeEmpty: { type: 'boolean', description: 'Count nodes with an empty value as "(Empty)" (default true)' }
    }, { filter: schemas.filter, match: schemas.match, visibleOnly: nodeSelectProps.visibleOnly, selectedOnly: nodeSelectProps.selectedOnly }),
    required: ['fieldA', 'fieldB']
  },
  annotations: RO,
  execute: async args => {
    const { fieldA, fieldB, orderBy = 'label', includeEmpty = true } = args;
    const d = requireData();
    [fieldA, fieldB].forEach(f => { if (!d.nodeFields.includes(f)) fail('Unknown node field ' + JSON.stringify(f)); });
    const counts = new Map(), rowT = new Map(), colT = new Map();
    let total = 0;
    selectNodes(args).forEach(n => {
      if (!includeEmpty && (isEmpty(n[fieldA]) || isEmpty(n[fieldB]))) return;
      const [a, b] = groupKey(n, [fieldA, fieldB]);
      counts.set(a + '\u0000' + b, (counts.get(a + '\u0000' + b) || 0) + 1);
      rowT.set(a, (rowT.get(a) || 0) + 1); colT.set(b, (colT.get(b) || 0) + 1); total++;
    });
    const order = totals => Array.from(totals.keys()).sort((a, b) => orderBy === 'count' ? totals.get(b) - totals.get(a) || W.compare(a, b) : W.compare(a, b));
    const rows = order(rowT), columns = order(colT);
    return {
      fieldA, fieldB, rows, columns,
      matrix: rows.map(a => columns.map(b => counts.get(a + '\u0000' + b) || 0)),
      rowTotals: rows.map(a => rowT.get(a)), columnTotals: columns.map(b => colT.get(b)), total
    };
  }
};
