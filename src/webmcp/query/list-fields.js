import { requireData } from '../core.js';
import { RO, graph, isInternal, isEmpty, clip, fieldValues, entityFields, inferType } from './helpers.js';

// Examples of a field's values: a few distinct ones
function examples(values, n = 3) {
  const seen = new Set(), out = [];
  for (const v of values) {
    if (isEmpty(v)) continue;
    const k = JSON.stringify(v);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(typeof v === 'string' ? clip(v, 40) : v instanceof Date ? v.toISOString() : v);
    if (out.length >= n) break;
  }
  return out;
}

export default {
  name: 'list_fields',
  title: 'List fields',
  description: 'Lists the fields (columns) of the loaded nodes, links or clusters, each with an inferred type (numeric, categorical, text, date, boolean, list, sequence, numeric-text), how many values are non-empty, how many distinct values there are, and a few example values. Internal fields MicrobeTrace maintains (index, _id, selected, visible, cluster, degree, origin, seq, ...) are flagged internal: true. ' +
    'Use this to learn the field names that the filter, sort, color and view tools accept. entity "link" scans up to sampleLimit links.',
  inputSchema: {
    type: 'object',
    properties: {
      entity: { type: 'string', enum: ['node', 'link', 'cluster'], description: 'What to list the fields of (default "node")' },
      visibleOnly: { type: 'boolean', description: 'Only count visible items (default false)' },
      includeInternal: { type: 'boolean', description: 'Include internal fields (default true; each flagged)' },
      sampleLimit: { type: 'integer', minimum: 1000, description: 'Most links read per field for entity "link" (default 200000)' }
    }
  },
  annotations: RO,
  execute: async ({ entity = 'node', visibleOnly = false, includeInternal = true, sampleLimit = 200000 }) => {
    requireData();
    const fields = entityFields(entity).filter(f => includeInternal || !isInternal(f));
    const rows = fields.map(field => {
      const { values, sampled } = fieldValues(entity, field, { visibleOnly, limit: sampleLimit });
      const present = values.filter(v => !isEmpty(v));
      const distinct = field == 'seq' ? present.length : new Set(present.map(v => typeof v === 'object' ? JSON.stringify(v) : v)).size;
      const row = { field, type: inferType(present, field), nonEmpty: present.length, distinct, internal: isInternal(field), examples: field == 'seq' ? [] : examples(present) };
      if (sampled) row.sampled = true;
      return row;
    });
    return { entity, items: entity == 'node' ? (visibleOnly ? requireData().nodes.filter(n => n.visible).length : requireData().nodes.length) : entity == 'cluster' ? requireData().clusters.length : (visibleOnly ? graph().visibleCount : graph().edgeCount), fields: rows };
  }
};
