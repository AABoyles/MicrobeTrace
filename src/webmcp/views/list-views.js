import { VIEWS, items, idOf, itemOf, rootOf, isShown, isActive } from './helpers.js';

export default {
  name: 'list_views',
  title: 'List views',
  description: 'Lists every view MicrobeTrace can show (Network, Histogram, Table, Map, Phylogenetic Tree, ...): its id (use it in the other view tools), name, menu group, a one-line description of what it shows, what data it needs, and whether it is currently open, the ids of its open copies (any view but files, conflicts and network can be open more than once, each copy with its own settings), in front (the visible tab of its panel), and how big it is. The views sit in a layout of panels (see get_layout); open ones are tabs. Use open_view to open one.',
  inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  annotations: { readOnlyHint: true },
  execute: async () => {
    return {
      views: VIEWS.map(v => {
        const item = itemOf(v.id), copies = items().filter(i => i.componentType === v.id).map(idOf);
        const r = item && rootOf(item);
        return Object.assign({}, v, {
          open: !!item,
          copies,
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
