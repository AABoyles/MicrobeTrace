import { fail } from '../core.js';
import { viewSchema, hasLayout, items, itemOf, mounted, activate, launch, checkView, need, snapshot, layoutState, applyLayout } from './helpers.js';

// Removes a view's leaf from a layout tree, tidying empty and single-child containers
function without(node, view) {
  if (!node.content) return node.type == view ? null : node;
  const content = node.content.map(c => without(c, view)).filter(Boolean);
  if (!content.length) return null;
  if (node.type != 'stack' && content.length === 1) return content[0];
  const out = Object.assign({}, node, { content });
  if (out.active == view) delete out.active;
  return out;
}

// Puts a new stack holding `view` beside the stack that holds `target`
function placed(tree, target, view, direction) {
  const orientation = direction == 'left' || direction == 'right' ? 'row' : 'column';
  const before = direction == 'left' || direction == 'above';
  const fresh = { type: 'stack', content: [{ type: view }], active: view };
  let done = false;
  const go = (node, parent) => {
    if (done || !node.content) return node;
    if (node.type == 'stack' && node.content.some(c => c.type == target)) {
      done = true;
      if (parent && parent.type == orientation) return { splice: true, node, fresh, before };
      return { type: orientation, content: before ? [fresh, node] : [node, fresh] };
    }
    const content = [];
    node.content.forEach(c => {
      const r = go(c, node);
      if (r && r.splice) before ? content.push(r.fresh, r.node) : content.push(r.node, r.fresh);
      else content.push(r);
    });
    return Object.assign({}, node, { content });
  };
  const out = go(tree, null);
  if (!done) fail('The ' + target + ' view is not in the layout');
  return out;
}

export default {
  name: 'open_view',
  title: 'Open view',
  description: 'Opens a view and waits until it has drawn its first frame. By default it joins the last panel as a tab and comes to the front (an already-open view is just brought to the front). Pass placement "left", "right", "above" or "below" to put it in its own panel beside another view (relativeTo, default the active view), so several views are visible at once; for an already-open view this moves it. Placing re-creates the open views (their settings are kept, but transient state such as network zoom is reset). Most views need data loaded first. Returns the resulting layout.',
  inputSchema: {
    type: 'object',
    properties: {
      view: viewSchema,
      placement: { type: 'string', enum: ['tab', 'left', 'right', 'above', 'below'], description: 'Where to put it: a tab in the existing panel (default), or its own panel beside relativeTo' },
      relativeTo: Object.assign({}, viewSchema, { description: 'For left/right/above/below: the open view to place it beside (default: the active view)' })
    },
    required: ['view'],
    additionalProperties: false
  },
  execute: async ({ view, placement = 'tab', relativeTo }) => {
    view = checkView(view);
    if (!hasLayout()) fail('MicrobeTrace has not finished starting.');
    if (view != 'files' && !(self.session && self.session.data && self.session.data.nodes.length)) {
      // Views can open, but they have nothing to draw
      console.warn('WebMCP: opening ' + view + ' with no data loaded');
    }
    const existing = itemOf(view);
    if (placement == 'tab' || (placement != 'tab' && !items().length)) {
      const item = existing || await launch(view);
      await mounted(item);
      await activate(item);
    } else {
      const target = relativeTo ? checkView(relativeTo) : (await need(null)).componentType;
      if (target == view) fail('relativeTo must be a different view from the one being placed');
      if (!itemOf(target)) fail('The ' + target + ' view is not open, so nothing can be placed beside it');
      let tree = snapshot();
      if (existing) tree = without(tree, view);
      tree = placed(tree, target, view, placement);
      await applyLayout(tree);
    }
    return Object.assign({ opened: view, placement }, layoutState());
  }
};
