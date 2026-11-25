import { fail } from '../core.js';
import { hasLayout, layoutState, applyLayout } from './helpers.js';

export default {
  name: 'set_layout',
  title: 'Set layout',
  description: 'Replaces the whole arrangement of views. layout is a tree: {type: "row"|"column"|"stack", content: [...]} where a stack is a panel of tabs, a row puts children side by side, a column stacks them, and leaves are {type: <view id>} (a view may be given more than once, but files, conflicts and network at most once; instance, 1 to 99, says which copy\'s settings it has). A stack may name its front tab with active. Example: {type:"row", content:[{type:"stack",content:[{type:"network"}]},{type:"column",content:[{type:"stack",content:[{type:"heatmap"}]},{type:"stack",content:[{type:"table"}]}]}]}. Views not listed are closed; the listed ones are re-created (settings are kept). Returns the resulting layout.',
  inputSchema: {
    type: 'object',
    properties: {
      layout: {
        type: 'object',
        description: 'A layout tree as returned by get_layout\'s `layout`',
        properties: {
          type: { type: 'string', description: 'stack, row, column, or a view id' },
          content: { type: 'array', items: { type: 'object' } },
          active: { type: 'string', description: 'For a stack: the view id in front' }
        },
        required: ['type']
      }
    },
    required: ['layout'],
    additionalProperties: false
  },
  annotations: { consequentialHint: true },
  execute: async ({ layout }) => {
    if (!hasLayout()) fail('MicrobeTrace has not finished starting.');
    await applyLayout(JSON.parse(JSON.stringify(layout)));
    return layoutState();
  }
};
