import { idOf, viewSchema, openSchema, rootOf, need, actionsOf, publicAction } from './helpers.js';

export default {
  name: 'list_view_actions',
  title: 'List view actions',
  description: 'Lists the buttons of a view that do things: the toolbar (settings gear, Fit/Center, Pin all nodes, Play, autorotate, ...), buttons in its settings pane (Simplify and Consolidate in the tree, Clear picks in Conflicts, ...) and menu items. Each has an id, title, where it is, whether it is pressed/enabled/visible. Run one with invoke_view_action. Export dialogs are separate (export_view); pass includeExport to list their openers. The view must be open.',
  inputSchema: { type: 'object', properties: { view: viewSchema, open: openSchema, includeExport: { type: 'boolean' } }, required: ['view'], additionalProperties: false },
  annotations: { readOnlyHint: true },
  execute: async ({ view, open, includeExport }) => {
    const item = await need(view, { open });
    const actions = actionsOf(rootOf(item), includeExport).map(publicAction);
    return { view: idOf(item), count: actions.length, actions };
  }
};
