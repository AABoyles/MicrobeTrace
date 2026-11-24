import { fail, requireData, filter, schemas } from '../core.js';
import { RO, linkReader, edgeList, filterSortEdges, fieldValues, entityFields, summarizeValues } from './helpers.js';

export default {
  name: 'describe_field',
  title: 'Describe a field',
  description: 'Describes one node, link or cluster field. Categorical/text fields: the distinct values with counts and fractions (top N). Numeric fields: min, max, mean, median, stdev, quantiles and a histogram with bins. Date fields: earliest, latest, median and a histogram over time. Sequence fields: length range. List-valued fields (such as a link origin) count each element. ' +
    'Use before filtering or coloring to see what values exist.',
  inputSchema: {
    type: 'object',
    properties: {
      entity: { type: 'string', enum: ['node', 'link', 'cluster'], description: 'Default "node"' },
      field: { type: 'string', description: 'The field name (see list_fields)' },
      visibleOnly: { type: 'boolean', description: 'Only visible items (default false)' },
      top: { type: 'integer', minimum: 1, maximum: 1000, description: 'Most distinct values listed for categorical fields (default 20)' },
      bins: { type: 'integer', minimum: 1, maximum: 200, description: 'Histogram bins for numeric and date fields (default 10)' },
      filter: schemas.filter,
      match: schemas.match
    },
    required: ['field']
  },
  annotations: RO,
  execute: async ({ entity = 'node', field, visibleOnly = false, top = 20, bins = 10, filter: conditions, match }) => {
    requireData();
    if (!entityFields(entity).includes(field)) fail('Unknown ' + entity + ' field ' + JSON.stringify(field) + '. Fields: ' + entityFields(entity).join(', '));
    let values, sampled = false, items;
    if (conditions && conditions.length) {
      if (entity === 'link') {
        const edges = filterSortEdges(edgeList(visibleOnly ? 'visible' : 'all'), { filter: conditions, match });
        const read = linkReader();
        values = edges.map(e => read(e, field)); items = edges.length;
      } else {
        const list = entity === 'node' ? requireData().nodes.filter(n => !visibleOnly || n.visible) : requireData().clusters.filter(c => !visibleOnly || c.visible);
        values = filter(list, conditions, match).map(x => x[field]); items = values.length;
      }
    } else {
      ({ values, items, sampled } = fieldValues(entity, field, { visibleOnly }));
    }
    return Object.assign({ entity, field, items }, sampled ? { sampled: true } : {}, summarizeValues(values, { field, top, bins }));
  }
};
