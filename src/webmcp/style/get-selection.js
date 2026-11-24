import { obj } from '../schema.js';
import { T, readOnly, strList, nodes } from './helpers.js';

export default {
  name: 'get_selection',
  title: 'Get selection',
  description: 'Returns the currently selected nodes: count, and their IDs (or chosen fields, paged). Selection is shared by all views. Requires loaded data.',
  inputSchema: obj(Object.assign({
    fields: strList('Node fields to return for each selected node; omit for just the _id of each')
  }, T.schemas.page)),
  annotations: readOnly,
  execute: async ({ fields, offset, limit }) => {
    const selected = nodes().filter(d => d.selected);
    const items = fields && fields.length ? selected.map(d => T.pick(d, fields)) : selected.map(d => d._id);
    return T.page(items, { offset, limit });
  }
};
