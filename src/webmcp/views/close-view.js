import { idOf, viewSchema, settle, need, layoutState } from './helpers.js';

export default {
  name: 'close_view',
  title: 'Close view',
  description: 'Closes an open view (its tab; the panel disappears if it was the last tab). The view\'s settings are kept, so reopening it restores them.',
  inputSchema: { type: 'object', properties: { view: viewSchema }, required: ['view'], additionalProperties: false },
  annotations: { consequentialHint: true },
  execute: async ({ view }) => {
    const item = await need(view);
    const name = idOf(item);
    item.remove();
    await settle(80);
    return Object.assign({ closed: name }, layoutState());
  }
};
