import { viewSchema, need, layoutState } from './helpers.js';

export default {
  name: 'focus_view',
  title: 'Bring view to front',
  description: 'Makes an already-open view the visible tab of its panel (and focused). Views in background tabs have no size and do not draw until shown, so do this before reading a view\'s image or interacting with it.',
  inputSchema: { type: 'object', properties: { view: viewSchema }, required: ['view'], additionalProperties: false },
  execute: async ({ view }) => {
    const item = await need(view, { show: true });
    return Object.assign({ focused: item.componentType }, layoutState());
  }
};
