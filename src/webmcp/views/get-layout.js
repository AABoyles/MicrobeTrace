import { layoutState } from './helpers.js';

export default {
  name: 'get_layout',
  title: 'Get layout',
  description: 'Returns how the views are arranged: panels (stacks of tabbed views) nested in rows and columns. `tree` is rich (with titles, sizes and which tab is in front); `layout` is the compact form that set_layout accepts. Also lists open and active views.',
  inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  annotations: { readOnlyHint: true },
  execute: async () => layoutState()
};
