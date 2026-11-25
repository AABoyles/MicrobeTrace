import { fail } from '../core.js';
import { idOf, viewSchema, hasLayout, items, itemOf, mounted, activate, launch, checkView, need, nextId, snapshot, layoutState, applyLayout } from './helpers.js';

// A leaf's view id: geo_map, or geo_map@2 for a second copy
const leafId = node => node.type + (node.instance > 1 ? '@' + node.instance : '');
const leaf = view => {
  const [type, instance] = view.split('@');
  return instance ? { type, instance: +instance } : { type };
};

// Removes a view's leaf from a layout tree, tidying empty and single-child containers
function without(node, view) {
  if (!node.content) return leafId(node) === view ? null : node;
  const content = node.content.map(c => without(c, view)).filter(Boolean);
  if (!content.length) return null;
  if (node.type !== 'stack' && content.length === 1) return content[0];
  const out = Object.assign({}, node, { content });
  if (out.active === view) delete out.active;
  return out;
}

// Puts a new stack holding `view` beside the stack that holds `target`
function placed(tree, target, view, direction) {
  const orientation = direction === 'left' || direction === 'right' ? 'row' : 'column';
  const before = direction === 'left' || direction === 'above';
  const fresh = { type: 'stack', content: [leaf(view)], active: view };
  let done = false;
  const go = (node, parent) => {
    if (done || !node.content) return node;
    if (node.type === 'stack' && node.content.some(c => leafId(c) === target)) {
      done = true;
      if (parent && parent.type === orientation) return { splice: true, node, fresh, before };
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
  description: 'Opens a view and waits until it has drawn its first frame. By default it joins the last panel as a tab and comes to the front (an already-open view is just brought to the front, unless another is true: then another copy of it opens, with its own settings, as the View menu does). Pass placement "left", "right", "above" or "below" to put it in its own panel beside another view (relativeTo, default the active view), so several views are visible at once; for an already-open view this moves it. Placing re-creates the open views (their settings are kept, but transient state such as network zoom is reset). Most views need data loaded first. Returns the resulting layout.',
  inputSchema: {
    type: 'object',
    properties: {
      view: viewSchema,
      placement: { type: 'string', enum: ['tab', 'left', 'right', 'above', 'below'], description: 'Where to put it: a tab in the existing panel (default), or its own panel beside relativeTo' },
      another: { type: 'boolean', description: 'Open another copy of a view that is already open (default false). Not for files, conflicts or network, which can be open only once' },
      relativeTo: Object.assign({}, viewSchema, { description: 'For left/right/above/below: the open view to place it beside (default: the active view)' })
    },
    required: ['view'],
    additionalProperties: false
  },
  execute: async ({ view, placement = 'tab', relativeTo, another = false }) => {
    view = checkView(view);
    if (!hasLayout()) fail('MicrobeTrace has not finished starting.');
    if (another) {
      view = view.split('@')[0];
      if (self.MT.singleViews.includes(view)) fail('The ' + view + ' view can be open only once');
    }
    if (view !== 'files' && !(self.session && self.session.data && self.session.data.nodes.length)) {
      // Views can open, but they have nothing to draw
      console.warn('WebMCP: opening ' + view + ' with no data loaded');
    }
    const existing = another ? undefined : itemOf(view);
    if (placement === 'tab' || (placement !== 'tab' && !items().length)) {
      const item = existing || await launch(view, { another });
      await mounted(item);
      await activate(item);
      view = idOf(item);
    } else {
      const target = relativeTo ? checkView(relativeTo) : idOf(await need(null));
      if (another) view = nextId(view);
      if (existing) view = idOf(existing);
      if (target === view) fail('relativeTo must be a different view from the one being placed');
      if (!itemOf(target)) fail('The ' + target + ' view is not open, so nothing can be placed beside it');
      let tree = snapshot();
      if (existing) tree = without(tree, view);
      tree = placed(tree, target, view, placement);
      await applyLayout(tree);
    }
    return Object.assign({ opened: view, placement }, layoutState());
  }
};
