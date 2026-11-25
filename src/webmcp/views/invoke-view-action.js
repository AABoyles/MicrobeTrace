import { fail } from '../core.js';
import { idOf, viewSchema, openSchema, settle, rootOf, need, slug, actionsOf, publicAction } from './helpers.js';

export default {
  name: 'invoke_view_action',
  title: 'Invoke view action',
  description: 'Clicks one of a view\'s buttons, found by its id or title from list_view_actions (the title match ignores case and may be a distinctive part of the title). Examples: network "Center and Scale Network" (fit), "Pin all Nodes" (toggles), tree "Simplify" / "Consolidate", settings gear to open the pane. Brings the view to the front first. Returns the action\'s state afterwards (pressed/enabled) and the view\'s other actions that changed.',
  inputSchema: {
    type: 'object',
    properties: {
      view: viewSchema,
      open: openSchema,
      action: { type: 'string', description: 'The action\'s id or title' }
    },
    required: ['view', 'action'],
    additionalProperties: false
  },
  // A button can do anything its view does, so the user decides each click
  confirm: ({ view, action }) => 'Click ' + JSON.stringify(String(action).slice(0, 100)) + ' in the ' + String(view).slice(0, 50) + ' view.',
  execute: async ({ view, open, action }) => {
    const item = await need(view, { open, show: true });
    const root = rootOf(item);
    const actions = actionsOf(root, false);
    const q = String(action).trim().toLowerCase();
    let found = actions.filter(a => a.id == q); // eslint-disable-line eqeqeq -- action ids are matched as text or number alike
    if (!found.length) found = actions.filter(a => a.title.toLowerCase() === q);
    if (!found.length) found = actions.filter(a => a.title.toLowerCase().includes(q) || a.id.includes(slug(q)));
    if (!found.length) fail('No action matching ' + JSON.stringify(action) + ' in the ' + item.componentType + ' view. Actions: ' + actions.map(a => a.id).join(', '));
    if (found.length > 1) fail('"' + action + '" matches several actions: ' + found.map(a => a.id + ' (' + a.title + ')').join('; ') + '. Use an id.');
    const target = found[0];
    if (!target.enabled) fail('The action ' + target.id + ' is disabled right now');
    const before = actions.map(publicAction);
    target.el.click();
    await settle(300);
    const after = actionsOf(root, false).map(publicAction);
    const now = after.find(a => a.id == target.id); // eslint-disable-line eqeqeq -- action ids are matched as text or number alike
    const changed = after.filter(a => { const b = before.find(x => x.id == a.id); return b && JSON.stringify(b) != JSON.stringify(a) && a.id != target.id; }); // eslint-disable-line eqeqeq -- action ids are matched as text or number alike
    return { view: idOf(item), invoked: target.title, id: target.id, state: now || null, otherChanges: changed };
  }
};
