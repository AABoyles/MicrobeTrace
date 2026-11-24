import { VIEWS, items, rootOf, isShown, isActive } from './helpers.js';

export default {
  name: 'list_views',
  title: 'List views',
  description: 'Lists every view MicrobeTrace can show (Network, Histogram, Table, Map, Phylogenetic Tree, ...): its id (use it in the other view tools), name, menu group, a one-line description of what it shows, what data it needs, and whether it is currently open, in front (the visible tab of its panel), and how big it is. The views sit in a layout of panels (see get_layout); open ones are tabs. Use open_view to open one.',
  inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  annotations: { readOnlyHint: true },
  execute: async () => {
    const open = new Map(items().map(i => [i.componentType, i]));
    return {
      views: VIEWS.map(v => {
        const item = open.get(v.id);
        const r = item && rootOf(item);
        return Object.assign({}, v, {
          open: !!item,
          active: !!item && isActive(item),
          visible: !!item && isShown(item),
          width: r ? r.clientWidth : null,
          height: r ? r.clientHeight : null
        });
      }),
      dataLoaded: !!(self.session && self.session.data && self.session.data.nodes && self.session.data.nodes.length)
    };
  }
};
