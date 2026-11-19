(function(self){
  'use strict';

  // WebMCP tools for views: which views exist and are open, where they sit in the
  // layout, each view's own settings and buttons, and pictures and exports of
  // what a view shows. (Global settings, filtering and colors are in style.js;
  // loading data in session.js; reading data in query.js.)

  const { fail, waitFor, image, pick } = self.MTWebMCP;
  const { same } = self.MTWebMCP.schema;
  const define = tool => self.MTWebMCP.define(tool);
  // How long a tool waits for a view's network to start, and for a view it
  // opened to show up
  const GRAPH_WAIT_MS = 20000, VIEW_SHOW_WAIT_MS = 5000;

  // The views --------------------------------------------------------------------

  const VIEWS = [
    { id: 'files', title: 'Files', group: 'Data', description: 'Where data is loaded: the file list, field and distance-metric choices, and the Launch button. Opens by default until data is launched.', requires: 'nothing' },
    { id: 'network', title: 'Network', group: 'Visualizations', description: 'The 2D force-directed network of nodes (people/sequences) and links (genetic or other relationships), colored and sized by node/link variables, with clusters, polygons, labels, legends and a timeline player.', requires: 'loaded data' },
    { id: 'histogram', title: 'Histogram', group: 'Visualizations', description: 'Distribution of one node or link variable (for example link distance, or a node field) as a histogram.', requires: 'loaded data' },
    { id: 'scatterplot', title: 'Scatterplot', group: 'Visualizations', description: 'Plots nodes by two chosen numeric variables, optionally sized and colored by others.', requires: 'loaded data with numeric node fields' },
    { id: 'bubbles', title: 'Bubbles', group: 'Visualizations', description: 'Packed bubbles of nodes grouped by a variable (counts per category).', requires: 'loaded data' },
    { id: 'flow_diagram', title: 'Flow Diagram', group: 'Visualizations', description: 'A Sankey-style diagram of how nodes flow between the categories of two variables.', requires: 'loaded data with categorical node fields' },
    { id: 'heatmap', title: 'Heatmap', group: 'Visualizations', description: 'A pairwise distance matrix between nodes (or clusters) as a heatmap; can export the matrix as CSV.', requires: 'loaded data with link distances' },
    { id: 'timeline', title: 'Epi Curve', group: 'Visualizations', description: 'Counts of nodes (new cases) over time as an epidemic curve, from a date field.', requires: 'loaded data with a date field' },
    { id: 'gantt', title: 'Gantt', group: 'Visualizations', description: 'Timeline bars per node from start and end date fields.', requires: 'loaded data with date fields' },
    { id: 'table', title: 'Table', group: 'Tables', description: 'A sortable table of the nodes, links or clusters shown, with chosen columns. Exports CSV, XLSX or JSON.', requires: 'loaded data' },
    { id: 'aggregation', title: 'Aggregation', group: 'Tables', description: 'Summary counts of nodes or links grouped by a variable, as tables.', requires: 'loaded data' },
    { id: 'crosstab', title: 'Crosstab', group: 'Tables', description: 'A contingency table cross-tabulating two node variables.', requires: 'loaded data with categorical node fields' },
    { id: 'waterfall', title: 'Waterfall', group: 'Tables', description: 'Clusters and their members listed by size, as a waterfall of the cluster structure.', requires: 'loaded data with clusters' },
    { id: 'conflicts', title: 'Conflicts', group: 'Tables', description: 'Where several loaded files disagree about a node field, with per-file values and a choice of which file wins.', requires: 'two or more files giving the same node different values' },
    { id: 'geo_map', title: 'Map', group: 'Maps', description: 'Nodes plotted on a Leaflet map from latitude/longitude fields, or from state, county or country fields (needs the internet for tiles).', requires: 'loaded data with geographic fields' },
    { id: 'choropleth', title: 'Choropleth', group: 'Maps', description: 'A map shading regions (states, counties, countries) by the number of nodes in each.', requires: 'loaded data with a region field' },
    { id: 'globe', title: 'Globe', group: 'Maps', description: 'Nodes and links on a rotating 3D globe from latitude/longitude fields.', requires: 'loaded data with latitude/longitude fields' },
    { id: 'phylogenetic_tree', title: 'Phylogenetic Tree', group: 'Sequences', description: 'A phylogenetic tree built from the sequences (neighbor-joining or similar), or a loaded Newick tree, with layouts (vertical, horizontal, circular) and node styling. Exports Newick.', requires: 'sequences, or a loaded Newick tree' },
    { id: 'sequences', title: 'Sequences', group: 'Sequences', description: 'The aligned sequences as a colored grid of bases, with consensus and variant highlighting. Exports FASTA/MEGA/PNG.', requires: 'sequences' }
  ];
  const VIEW_IDS = VIEWS.map(v => v.id);
  const viewInfo = id => VIEWS.find(v => v.id == id);

  const viewSchema = { type: 'string', enum: VIEW_IDS, description: 'The view\'s id (see list_views). Old names such as 2d_network or pixi mean network. Omit for the active view where the tool says so.' };
  const openSchema = { type: 'boolean', description: 'Open the view first if it is not open (default false: fails if the view is not open)' };

  const MT = () => self.MT;
  const nextFrame = () => new Promise(r => requestAnimationFrame(() => r()));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const settle = async (ms = 80) => { await nextFrame(); await nextFrame(); await sleep(ms); };
  const canon = view => view ? MT().viewName(String(view).trim().toLowerCase().replace(/[\s-]+/g, '_')) : view;

  // Layout ----------------------------------------------------------------------

  const hasLayout = () => self.layout && self.layout.rootItem;
  const items = () => hasLayout() ? self.layout.contentItems : [];
  const itemOf = view => items().find(i => i.componentType == view);
  const rootOf = item => item.container.element;
  const isShown = item => { const r = rootOf(item); return !!(r && r.clientWidth && r.clientHeight); };
  const activeOf = stack => stack && (typeof stack.getActiveComponentItem === 'function' ? stack.getActiveComponentItem() : stack.activeComponentItem);
  const isActive = item => item.parent && activeOf(item.parent) === item;

  // Waits for a view's element to be filled in (and, for the network, its graph)
  async function mounted(item) {
    await waitFor(() => rootOf(item).children.length > 0, { timeout: 30000, message: 'The ' + item.componentType + ' view did not finish opening' });
    if (item.componentType == 'network') {
      await waitFor(() => self.temp && self.temp.network && self.temp.network.graph, { timeout: GRAPH_WAIT_MS }).catch(() => {});
    }
    await settle(50);
  }

  async function activate(item) {
    if (!isActive(item)) item.parent.setActiveComponentItem(item, true);
    await waitFor(() => isShown(item), { timeout: VIEW_SHOW_WAIT_MS }).catch(() => {});
    await settle(60);
  }

  function launch(view) {
    return new Promise((resolve, reject) => {
      try { MT().launchView(view, resolve); } catch (e) { reject(e); }
    });
  }

  function checkView(view) {
    view = canon(view);
    if (!VIEW_IDS.includes(view)) fail('Unknown view ' + JSON.stringify(view) + '. The views are: ' + VIEW_IDS.join(', '));
    return view;
  }

  // The open item for a view (opening it first if asked), or the active view's
  async function need(view, { open = false, show = false } = {}) {
    if (!hasLayout()) fail('MicrobeTrace has not finished starting.');
    let item;
    if (view) {
      view = checkView(view);
      item = itemOf(view);
      if (!item) {
        if (!open) fail('The ' + view + ' view is not open. Open it with open_view (or pass open: true). Open views: ' + (items().map(i => i.componentType).join(', ') || 'none'));
        item = await launch(view);
        await mounted(item);
      }
    } else {
      const all = items();
      item = all.find(i => isActive(i) && isShown(i)) || all.find(isShown) || all[0];
      if (!item) fail('No view is open. Open one with open_view.');
    }
    if (show) await activate(item);
    return item;
  }

  // The layout as MT.cacheLayout saves it, plus each stack's active view
  function snapshot(item = self.layout.rootItem) {
    if (!item) return { type: 'stack', content: [] };
    if (item.isComponent) return { type: item.componentType };
    const out = { type: item.type, content: item.contentItems.map(snapshot) };
    if (item.type == 'stack') { const a = activeOf(item); if (a) out.active = a.componentType; }
    return out;
  }

  // The same, with sizes and titles, for reading
  function describe(item = self.layout.rootItem) {
    if (!item) return { type: 'stack', content: [] };
    if (item.isComponent) {
      const r = rootOf(item);
      return { type: 'view', view: item.componentType, title: item.title, active: isActive(item), width: r ? r.clientWidth : 0, height: r ? r.clientHeight : 0 };
    }
    const out = { type: item.type, content: item.contentItems.map(describe) };
    if (item.type == 'stack') { const a = activeOf(item); out.activeView = a ? a.componentType : null; }
    return out;
  }

  const layoutState = () => ({
    openViews: items().map(i => i.componentType),
    activeViews: items().filter(isActive).map(i => i.componentType),
    tree: describe(),
    layout: snapshot()
  });

  // Applies a layout tree ({type: stack|row|column, content, active}; leaves
  // {type: viewId}), then makes each stack's `active` view the one in front
  async function applyLayout(tree) {
    const views = [];
    const check = (node, path) => {
      if (!node || typeof node != 'object' || typeof node.type != 'string') fail('Layout node at ' + path + ' needs a type');
      if (['stack', 'row', 'column'].includes(node.type)) {
        if (!Array.isArray(node.content)) fail('Layout node at ' + path + ' (' + node.type + ') needs a content array');
        node.content.forEach((c, i) => check(c, path + '.content[' + i + ']'));
      } else {
        const v = checkView(node.type);
        if (views.includes(v)) fail('The ' + v + ' view appears twice in the layout; each view can be open once');
        views.push(v);
      }
    };
    check(tree, 'layout');
    // golden-layout wants rows and columns to hold stacks, so a bare view there is wrapped
    const wrap = n => {
      if (['row', 'column'].includes(n.type)) return Object.assign({}, n, { content: n.content.map(c => ['stack', 'row', 'column'].includes(c.type) ? wrap(c) : { type: 'stack', content: [c] }) });
      return n;
    };
    tree = ['stack', 'row', 'column'].includes(tree.type) ? wrap(tree) : { type: 'stack', content: [tree] };
    await MT().loadLayout(tree);
    await Promise.all(items().map(mounted));
    const front = node => {
      if (!node.content) return;
      if (node.type == 'stack' && node.active) {
        const it = itemOf(canon(node.active));
        if (it) it.parent.setActiveComponentItem(it, false);
      }
      node.content.forEach(front);
    };
    front(tree);
    await settle(120);
    items().forEach(i => { try { const m = MT().views[i.componentType]; void m; } catch (e) { /* nothing */ } });
    window.dispatchEvent(new Event('resize'));
    await settle(80);
  }

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

  define({
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
  });

  define({
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
  });

  define({
    name: 'close_view',
    title: 'Close view',
    description: 'Closes an open view (its tab; the panel disappears if it was the last tab). The view\'s settings are kept, so reopening it restores them.',
    inputSchema: { type: 'object', properties: { view: viewSchema }, required: ['view'], additionalProperties: false },
    annotations: { consequentialHint: true },
    execute: async ({ view }) => {
      const item = await need(view);
      const name = item.componentType;
      item.remove();
      await settle(80);
      return Object.assign({ closed: name }, layoutState());
    }
  });

  define({
    name: 'focus_view',
    title: 'Bring view to front',
    description: 'Makes an already-open view the visible tab of its panel (and focused). Views in background tabs have no size and do not draw until shown, so do this before reading a view\'s image or interacting with it.',
    inputSchema: { type: 'object', properties: { view: viewSchema }, required: ['view'], additionalProperties: false },
    execute: async ({ view }) => {
      const item = await need(view, { show: true });
      return Object.assign({ focused: item.componentType }, layoutState());
    }
  });

  define({
    name: 'get_layout',
    title: 'Get layout',
    description: 'Returns how the views are arranged: panels (stacks of tabbed views) nested in rows and columns. `tree` is rich (with titles, sizes and which tab is in front); `layout` is the compact form that set_layout accepts. Also lists open and active views.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
    execute: async () => layoutState()
  });

  define({
    name: 'set_layout',
    title: 'Set layout',
    description: 'Replaces the whole arrangement of views. layout is a tree: {type: "row"|"column"|"stack", content: [...]} where a stack is a panel of tabs, a row puts children side by side, a column stacks them, and leaves are {type: <view id>} (each view at most once). A stack may name its front tab with active. Example: {type:"row", content:[{type:"stack",content:[{type:"network"}]},{type:"column",content:[{type:"stack",content:[{type:"histogram"}]},{type:"stack",content:[{type:"table"}]}]}]}. Views not listed are closed; the listed ones are re-created (settings are kept). Returns the resulting layout.',
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
  });

  // View settings --------------------------------------------------------------

  const text = el => el ? el.textContent.replace(/\s+/g, ' ').trim() : '';
  const isOff = (el, root) => {
    for (let e = el; e && e !== root; e = e.parentElement) {
      if (e.matches('.left-pane, .tab-pane, .collapse, .modal')) continue;
      if (e.hidden || e.style.display == 'none' || e.classList.contains('d-none') || getComputedStyle(e).display === 'none') return true;
    }
    return false;
  };

  function labelOf(el, root) {
    if (el.id) {
      const l = root.querySelector('label[for="' + CSS.escape(el.id) + '"]');
      if (text(l)) return text(l);
    }
    const aria = el.getAttribute('aria-label');
    if (aria) return aria;
    const group = el.closest('.form-group, .row');
    if (group) {
      const l = group.querySelector('label, .col-3, .col-4, .col-5');
      if (l && !l.contains(el) && text(l)) return text(l);
      if (l && l.querySelector('label') && text(l.querySelector('label'))) return text(l.querySelector('label'));
    }
    const own = el.closest('label');
    if (own && text(own)) return text(own);
    return '';
  }

  const descriptionOf = (el, root) => {
    const t = el.title || (el.closest('[title]') && el.closest('[title]').title) || '';
    return t.trim();
  };

  function sectionOf(el, root) {
    const out = {};
    const pane = el.closest('.tab-pane');
    if (pane) {
      const link = root.querySelector('[href="#' + CSS.escape(pane.id) + '"], [data-bs-target="#' + CSS.escape(pane.id) + '"]');
      out.tab = text(link) || pane.id;
    }
    const collapse = el.closest('.collapse');
    if (collapse && collapse !== pane) {
      const button = root.querySelector('[data-bs-target="#' + CSS.escape(collapse.id) + '"]');
      out.section = text(button) || collapse.id;
    }
    return out;
  }

  const optionsOf = select => Array.from(select.options).map(o => ({ value: o.value, label: o.textContent.trim() }));

  // Every [data-setting] control in a view, one record per setting
  function settingsOf(root) {
    const MTs = self.MT.settings;
    const records = new Map();
    root.querySelectorAll('[data-setting]').forEach(el => {
      if (el.closest('.modal')) return;
      const key = el.dataset.setting;
      let r = records.get(key);
      if (!r) {
        r = { key, controls: [] };
        records.set(key, r);
      }
      r.controls.push(el);
    });
    return Array.from(records.values()).map(({ key, controls }) => {
      const el = controls[0];
      const rec = Object.assign({ key, label: labelOf(el, root) || self.MT.titleize(key), description: descriptionOf(el, root) }, sectionOf(el, root));
      if (el.type == 'checkbox') rec.type = 'boolean';
      else if (el.type == 'radio') {
        const options = controls.map(c => {
          const lab = c.closest('label');
          return { value: c.value, label: text(lab) || c.value };
        });
        if (options.every(o => o.value == 'true' || o.value == 'false')) {
          rec.type = 'boolean';
          rec.options = options.map(o => ({ value: o.value == 'true', label: o.label }));
        } else {
          rec.type = 'choice';
          rec.options = options;
        }
      } else if (el.tagName === 'SELECT') {
        rec.type = el.multiple ? 'multi-choice' : 'choice';
        rec.options = optionsOf(el);
      } else if (el.type == 'range' || el.type == 'number') {
        rec.type = 'number';
        rec.control = el.type == 'range' ? 'slider' : 'number';
        ['min', 'max', 'step'].forEach(a => { if (el.getAttribute(a) !== null && el.getAttribute(a) !== '') rec[a] = Number(el.getAttribute(a)); });
      } else if (el.type == 'color') rec.type = 'color';
      else rec.type = 'text';
      rec.value = MTs.get(key);
      if (rec.value === undefined) rec.value = null;
      rec.disabled = controls.every(c => c.disabled);
      rec.visible = !controls.every(c => isOff(c, root));
      rec._controls = controls;
      return rec;
    });
  }

  const publicRecord = r => { const { _controls, ...rest } = r; return rest; };

  const cssColor = value => {
    const c = document.createElement('canvas').getContext('2d');
    c.fillStyle = '#000001';
    c.fillStyle = String(value);
    const v = c.fillStyle;
    if (v == '#000001' && !/^(#000001|rgb\(0, 0, 1\))$/i.test(String(value))) return null;
    return v.startsWith('#') ? v : null;
  };

  function coerce(rec, value) {
    const name = '"' + rec.key + '"';
    switch (rec.type) {
      case 'boolean': {
        if (typeof value === 'boolean') return value;
        if (value === 'true' || value === 1 || value === 'on') return true;
        if (value === 'false' || value === 0 || value === 'off') return false;
        fail(name + ' is on/off: pass true or false');
        break;
      }
      case 'number': {
        const n = typeof value === 'number' ? value : (typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN);
        if (!isFinite(n)) fail(name + ' needs a number');
        let out = n;
        if (rec.min !== undefined && out < rec.min) out = rec.min;
        if (rec.max !== undefined && out > rec.max) out = rec.max;
        return out;
      }
      case 'choice': {
        const s = String(value);
        const exact = rec.options.find(o => String(o.value) === s);
        const loose = exact || rec.options.find(o => o.label.toLowerCase() == s.toLowerCase() || String(o.value).toLowerCase() == s.toLowerCase());
        if (!loose) fail(name + ' must be one of: ' + rec.options.map(o => JSON.stringify(o.value) + (o.label && o.label != o.value ? ' (' + o.label + ')' : '')).join(', '));
        return loose.value;
      }
      case 'multi-choice': {
        const list = [].concat(value).map(v => {
          const o = rec.options.find(o => String(o.value) === String(v) || o.label.toLowerCase() == String(v).toLowerCase());
          if (!o) fail(name + ' has no option ' + JSON.stringify(v) + '; options: ' + rec.options.map(o => o.value).join(', '));
          return o.value;
        });
        return list;
      }
      case 'color': {
        if (/^#[0-9a-f]{6}$/i.test(value)) return String(value).toLowerCase();
        const hex = cssColor(value);
        if (!hex) fail(name + ' needs a color such as "#ff8800" or "red"');
        return hex;
      }
      default:
        return String(value);
    }
  }

  define({
    name: 'get_view_settings',
    title: 'Get view settings',
    description: 'Discovers every setting of a view (the controls in its settings pane): key, label, what it does (from the control\'s tooltip), current value, type (boolean, number, choice, multi-choice, color, text), allowed options (value and label; variable menus list the loaded data\'s fields) or min/max/step, the pane tab and section it is in, and whether it is currently disabled or hidden (some controls only appear when another is set). Pass the keys to set_view_settings. These are the view\'s own settings; global ones (colors, filtering, selection) are separate tools. The view must be open. Also lists other_controls: inputs of the view that are not stored settings (for set_view_control).',
    inputSchema: {
      type: 'object',
      properties: {
        view: viewSchema,
        open: openSchema,
        keys: { type: 'array', items: { type: 'string' }, description: 'Only these settings (default all)' },
        onlyVisible: { type: 'boolean', description: 'Leave out hidden controls (default false)' }
      },
      required: ['view'],
      additionalProperties: false
    },
    annotations: { readOnlyHint: true },
    execute: async ({ view, open, keys, onlyVisible }) => {
      const item = await need(view, { open });
      let records = settingsOf(rootOf(item));
      if (keys) {
        const missing = keys.filter(k => !records.some(r => r.key == k));
        if (missing.length) fail('The ' + item.componentType + ' view has no setting ' + missing.join(', ') + '. Its settings: ' + records.map(r => r.key).join(', '));
        records = records.filter(r => keys.includes(r.key));
      }
      if (onlyVisible) records = records.filter(r => r.visible);
      return { view: item.componentType, count: records.length, settings: records.map(publicRecord), other_controls: otherControls(rootOf(item)) };
    }
  });

  define({
    name: 'set_view_settings',
    title: 'Set view settings',
    description: 'Changes settings of a view; the view redraws. settings is {key: value} using keys from get_view_settings: booleans as true/false, numbers (clamped to min/max), choices as an option value or its label (case-insensitive), colors as "#rrggbb" or a CSS color name. All values are checked first and nothing is applied if any is invalid. Returns each change as from -> to, plus the view\'s settings that are now stored. Note some controls are only meaningful when others are set (see the hidden flag in get_view_settings).',
    inputSchema: {
      type: 'object',
      properties: {
        view: viewSchema,
        open: openSchema,
        settings: { type: 'object', description: 'Setting keys and their new values', additionalProperties: true },
        show: { type: 'boolean', description: 'Bring the view to the front first, so it redraws visibly (default true)' }
      },
      required: ['view', 'settings'],
      additionalProperties: false
    },
    execute: async ({ view, open, settings, show = true }) => {
      const item = await need(view, { open, show });
      const root = rootOf(item);
      const records = settingsOf(root);
      const entries = Object.entries(settings || {});
      if (!entries.length) fail('settings is empty');
      const errors = [], plan = [];
      entries.forEach(([key, value]) => {
        const rec = records.find(r => r.key == key);
        if (!rec) return errors.push('No setting "' + key + '" in the ' + item.componentType + ' view (see get_view_settings)');
        try { plan.push({ rec, key, value: coerce(rec, value) }); } catch (e) { errors.push(e.message); }
      });
      if (errors.length) fail(errors.join('\n'));
      const changes = [];
      for (const { rec, key, value } of plan) {
        const from = self.MT.settings.get(key);
        self.MT.settings.set(key, value);
        changes.push({ key, from: from === undefined ? null : from, to: value, changed: !same(from, value) });
      }
      await settle(150);
      // A control that did not take the value (a view that reads its controls
      // instead of the setting store) is written and told
      plan.forEach(({ rec, key, value }) => {
        rec._controls.forEach(el => {
          if (!self.MTBind) return;
          if (el.tagName === 'SELECT' && el.multiple) return;
          const now = el.type == 'radio' ? (el.checked ? self.MTBind.read(el) : undefined) : self.MTBind.read(el);
          const shown = el.type == 'radio' ? el.checked === (self.MTBind.read(el) === value) : same(now, value);
          if (!shown) {
            self.MTBind.write(el, value);
            const type = el.type == 'range' || el.type == 'number' || el.type == 'text' ? 'input' : 'change';
            if (el.type != 'radio' || el.checked) el.dispatchEvent(new Event(type, { bubbles: true }));
          }
        });
      });
      await settle(100);
      const after = settingsOf(root).filter(r => plan.some(p => p.key == r.key)).map(publicRecord);
      return { view: item.componentType, changes, settings: after };
    }
  });

  // Inputs of a view that are not bound to settings
  function otherControls(root) {
    const out = [];
    root.querySelectorAll('select, input, textarea').forEach(el => {
      if (el.dataset.setting || el.closest('.modal, .tabulator, .js-plotly-plot, .ts-wrapper, .dropdown-menu') || el.type == 'hidden' || el.type == 'file' || el.type == 'button') return;
      if (el.classList.contains('ts-control') || el.closest('.btn-group-toggle')) return;
      const control = controlSelector(root, el);
      if (!control) return;
      const rec = { control, label: labelOf(el, root) || el.title || '', type: el.tagName === 'SELECT' ? (el.multiple ? 'multi-choice' : 'choice') : el.type == 'checkbox' ? 'boolean' : el.type, value: el.type == 'checkbox' ? el.checked : (el.multiple ? Array.from(el.selectedOptions).map(o => o.value) : el.value), disabled: el.disabled };
      if (el.tagName === 'SELECT') rec.options = optionsOf(el);
      out.push(rec);
    });
    return out;
  }

  function controlSelector(root, el) {
    if (el.id && root.querySelectorAll('#' + CSS.escape(el.id)).length === 1) return '#' + el.id;
    if (el.name && root.querySelectorAll('[name="' + el.name + '"]').length === 1) return '[name="' + el.name + '"]';
    for (const c of el.classList) {
      if (/^(form-|btn|col-|ts-)/.test(c)) continue;
      if (root.querySelectorAll('.' + CSS.escape(c)).length === 1) return '.' + c;
    }
    return null;
  }

  define({
    name: 'set_view_control',
    title: 'Set view control',
    description: 'Sets an input of a view that is not a stored setting (listed as other_controls by get_view_settings, for example the field menus of Conflicts or Crosstab), by writing the control and firing its input/change events. control is the selector given there (such as "#conflicts-field"). value: a string (an option value or its label for menus), number, boolean (checkboxes) or an array (multi-select menus). Returns the control\'s resulting value.',
    inputSchema: {
      type: 'object',
      properties: {
        view: viewSchema,
        open: openSchema,
        control: { type: 'string', description: 'Selector from other_controls' },
        value: { description: 'The new value' }
      },
      required: ['view', 'control', 'value'],
      additionalProperties: false
    },
    execute: async ({ view, open, control, value }) => {
      const item = await need(view, { open, show: true });
      const root = rootOf(item);
      let el;
      try { el = root.querySelector(control); } catch (e) { fail('Invalid selector ' + control); }
      if (!el) fail('No control ' + control + ' in the ' + item.componentType + ' view; see other_controls in get_view_settings');
      if (el.disabled) fail('That control is disabled right now');
      if (el.tagName === 'SELECT') {
        const options = Array.from(el.options);
        const want = [].concat(value).map(v => {
          const o = options.find(o => o.value === String(v)) || options.find(o => o.textContent.trim().toLowerCase() == String(v).toLowerCase());
          if (!o) fail('Not an option; the options are: ' + options.map(o => JSON.stringify(o.value)).join(', '));
          return o;
        });
        options.forEach(o => { o.selected = want.includes(o); });
      } else if (el.type == 'checkbox' || el.type == 'radio') {
        el.checked = !!(value === true || value === 'true');
      } else {
        el.value = value;
      }
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      await settle(150);
      return otherControls(root).find(c => c.control == control) || { control, value: el.value };
    }
  });

  // View actions -------------------------------------------------------------

  const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'button';

  function actionsOf(root, includeExport) {
    const seen = new Map(), out = [];
    root.querySelectorAll('button, [role="button"], a.btn, input[type="button"], .dropdown-item').forEach(el => {
      if (el.closest('.modal') || el.classList.contains('btn-close') || el.matches('label')) return;
      if (el.closest('.tabulator, .js-plotly-plot, .ts-wrapper, .leaflet-control-container')) return;
      const toggle = el.dataset.bsToggle;
      if (toggle == 'tab' || toggle == 'collapse') return;
      if (el.dataset.setting || el.querySelector('[data-setting]') || el.closest('.btn-group-toggle')) return;
      const exportOpener = toggle == 'modal';
      if (exportOpener && !includeExport) return;
      const name = el.getAttribute('aria-label') || el.title || text(el) || el.dataset.bsOriginalTitle || '';
      if (!name) return;
      const base = slug(name), n = (seen.get(base) || 0) + 1;
      seen.set(base, n);
      const menu = el.closest('.dropdown-menu');
      const toggler = menu && menu.parentElement.querySelector('[data-bs-toggle="dropdown"]');
      out.push({
        id: n > 1 ? base + '-' + n : base,
        title: name,
        text: text(el),
        where: el.closest('.view-controls') ? 'toolbar' : el.closest('.left-pane') ? 'settings pane' : 'view',
        kind: exportOpener ? 'export' : toggle == 'dropdown' ? 'menu' : menu ? 'menu item' : 'button',
        menu: toggler ? (toggler.title || text(toggler)) : undefined,
        pressed: el.getAttribute('aria-pressed') == 'true' || (el.classList.contains('active') && el.matches('[data-toggle="button"], .settings-toggle, [class*="toggle"]')) || undefined,
        enabled: !el.disabled && !el.classList.contains('disabled'),
        visible: !isOff(el, root),
        el
      });
    });
    return out;
  }

  const publicAction = a => { const { el, ...rest } = a; Object.keys(rest).forEach(k => rest[k] === undefined && delete rest[k]); return rest; };

  define({
    name: 'list_view_actions',
    title: 'List view actions',
    description: 'Lists the buttons of a view that do things: the toolbar (settings gear, Fit/Center, Pin all nodes, Play, autorotate, ...), buttons in its settings pane (Simplify and Consolidate in the tree, Clear picks in Conflicts, ...) and menu items. Each has an id, title, where it is, whether it is pressed/enabled/visible. Run one with invoke_view_action. Export dialogs are separate (export_view); pass includeExport to list their openers. The view must be open.',
    inputSchema: { type: 'object', properties: { view: viewSchema, open: openSchema, includeExport: { type: 'boolean' } }, required: ['view'], additionalProperties: false },
    annotations: { readOnlyHint: true },
    execute: async ({ view, open, includeExport }) => {
      const item = await need(view, { open });
      const actions = actionsOf(rootOf(item), includeExport).map(publicAction);
      return { view: item.componentType, count: actions.length, actions };
    }
  });

  define({
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
      let found = actions.filter(a => a.id == q);
      if (!found.length) found = actions.filter(a => a.title.toLowerCase() == q);
      if (!found.length) found = actions.filter(a => a.title.toLowerCase().includes(q) || a.id.includes(slug(q)));
      if (!found.length) fail('No action matching ' + JSON.stringify(action) + ' in the ' + item.componentType + ' view. Actions: ' + actions.map(a => a.id).join(', '));
      if (found.length > 1) fail('"' + action + '" matches several actions: ' + found.map(a => a.id + ' (' + a.title + ')').join('; ') + '. Use an id.');
      const target = found[0];
      if (!target.enabled) fail('The action ' + target.id + ' is disabled right now');
      const before = actions.map(publicAction);
      target.el.click();
      await settle(300);
      const after = actionsOf(root, false).map(publicAction);
      const now = after.find(a => a.id == target.id);
      const changed = after.filter(a => { const b = before.find(x => x.id == a.id); return b && JSON.stringify(b) != JSON.stringify(a) && a.id != target.id; });
      return { view: item.componentType, invoked: target.title, id: target.id, state: now || null, otherChanges: changed };
    }
  });

  // Images and exports ------------------------------------------------------------

  const blobToDataURL = blob => new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
  const loadImage = src => new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('The image could not be read'));
    i.src = src;
  });

  // Scales an image down to maxWidth wide, in the format asked
  async function finish(dataURL, { maxWidth, format = 'png', quality = 0.9, background }) {
    const img = await loadImage(dataURL);
    let w = img.naturalWidth, h = img.naturalHeight;
    const wanted = 'image/' + format;
    const scale = maxWidth && w > maxWidth ? maxWidth / w : 1;
    if (scale == 1 && dataURL.startsWith('data:' + wanted + ';')) return { dataURL, width: w, height: h };
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(w * scale));
    canvas.height = Math.max(1, Math.round(h * scale));
    const c = canvas.getContext('2d');
    if (format == 'jpeg') { c.fillStyle = background || '#ffffff'; c.fillRect(0, 0, canvas.width, canvas.height); }
    c.imageSmoothingQuality = 'high';
    c.drawImage(img, 0, 0, canvas.width, canvas.height);
    return { dataURL: canvas.toDataURL(wanted, quality), width: canvas.width, height: canvas.height };
  }

  // The view's export dialog action (see MT.exporterOf): its file types, and run()
  const exporterOf = item => MT().exporterOf(rootOf(item));
  const IMAGE_TYPES = ['png', 'jpeg', 'webp'];

  // Runs a view's own export action with these settings, taking the file it
  // saves (MT.saveAs) when `download` is false instead of letting it download
  async function runExport(item, { format, filename, scale, quality, download }) {
    const exporter = exporterOf(item);
    if (!exporter) fail('The ' + item.componentType + ' view has no export dialog.');
    const formats = exporter.types;
    format = format ? String(format).toLowerCase().replace('jpg', 'jpeg') : formats[0].value;
    const chosen = formats.find(f => f.value == format || f.label.toLowerCase() == format);
    if (!chosen) fail('The ' + item.componentType + ' view exports: ' + formats.map(f => f.value).join(', ') + ' (not ' + format + ')');
    const m = MT(), original = m.saveAs;
    let saved = null;
    m.saveAs = (blob, name) => {
      saved = { blob, name };
      if (download) original.call(m, blob, name);
    };
    let base;
    try {
      // Resolves once the file is saved; a view that saves another way (XLSX, PDF) never reaches saveAs
      base = await exporter.run({ filetype: chosen.value, filename, scale, quality });
    } finally {
      m.saveAs = original;
    }
    if (!saved) {
      if (download) return { format: chosen.value, filename: base + '.' + chosen.value, formats, note: 'This format is saved by the browser directly, so its size is not known.' };
      fail('The ' + chosen.value + ' export does not hand its file back to the page; use download: true to save it instead.');
    }
    return Object.assign(saved, { format: chosen.value, formats });
  }

  // A view's pixels without an export dialog: its canvases, or its DOM
  async function rasterize(root, scale) {
    const w = root.clientWidth, h = root.clientHeight;
    if (!w || !h) fail('The view has no size (it is in a background tab); focus_view it first.');
    const box = root.getBoundingClientRect();
    const background = (self.MT.settings && self.MT.settings.get('background-color')) || getComputedStyle(root).backgroundColor || '#ffffff';
    const copy = root.cloneNode(true);
    const src = [root, ...root.querySelectorAll('*')], dst = [copy, ...copy.querySelectorAll('*')];
    src.forEach((s, i) => {
      const d = dst[i];
      if (!d) return;
      if (s.tagName === 'SCRIPT' || s.matches('.modal, .left-pane')) { d.remove(); return; }
      const cs = getComputedStyle(s);
      let css = '';
      for (let k = 0; k < cs.length; k++) css += cs[k] + ':' + cs.getPropertyValue(cs[k]) + ';';
      d.setAttribute('style', css);
      d.removeAttribute('class');
      if (s.tagName === 'CANVAS') {
        let url = null;
        try { if (s.width && s.height) url = s.toDataURL('image/png'); } catch (e) { /* tainted */ }
        if (url) {
          const img = document.createElement('img');
          img.setAttribute('src', url);
          img.setAttribute('style', css);
          d.replaceWith(img);
        }
      }
    });
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('width', w); svg.setAttribute('height', h);
    svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    const fo = document.createElementNS(ns, 'foreignObject');
    fo.setAttribute('width', '100%'); fo.setAttribute('height', '100%');
    copy.style.margin = '0';
    fo.appendChild(copy);
    svg.appendChild(fo);
    void box;
    const blob = await self.MT.svgImage(svg, { scale, backgroundColor: background, type: 'image/png' });
    if (!blob) fail('The view could not be drawn.');
    return blobToDataURL(blob);
  }

  define({
    name: 'get_view_image',
    title: 'Get view image',
    description: 'Renders a view as an image that you can see, to check what it actually draws (network layout and colors, chart shapes, map, tree, table). Uses the view\'s own export (the same picture its Export dialog saves, with legends) where it has one, and otherwise a snapshot of its canvases/DOM. Nothing is downloaded. The view is brought to the front first. Large images are scaled down to maxWidth (default 1200 px) to keep them small. Returns the image plus its size and how it was made.',
    inputSchema: {
      type: 'object',
      properties: {
        view: Object.assign({}, viewSchema, { description: 'The view to draw (default: the active view)' }),
        open: openSchema,
        scale: { type: 'number', minimum: 0.1, maximum: 4, description: 'Render scale (default 1: one pixel per screen pixel)' },
        maxWidth: { type: 'integer', minimum: 100, maximum: 4000, description: 'Scale the image down to at most this width (default 1200)' },
        format: { type: 'string', enum: ['png', 'jpeg'], description: 'Image format (default png; jpeg is smaller)' },
        quality: { type: 'number', minimum: 0.1, maximum: 1, description: 'JPEG quality (default 0.85)' },
        method: { type: 'string', enum: ['auto', 'export', 'dom'], description: 'auto (default): the view\'s export, else a DOM/canvas snapshot' }
      },
      additionalProperties: false
    },
    annotations: { readOnlyHint: true },
    execute: async ({ view, open, scale = 1, maxWidth = 1200, format = 'png', quality = 0.85, method = 'auto' }) => {
      const item = await need(view, { open, show: true });
      const root = rootOf(item);
      await settle(150);
      let dataURL, used;
      const exporter = exporterOf(item);
      if (method != 'dom' && exporter && IMAGE_TYPES.some(t => exporter.types.some(o => o.value == t))) {
        try {
          const result = await runExport(item, { format: 'png', scale, download: false });
          dataURL = await blobToDataURL(result.blob);
          used = 'export';
        } catch (e) {
          if (method == 'export') throw e;
        }
      } else if (method == 'export') {
        fail('The ' + item.componentType + ' view has no image export; use method auto or dom.');
      }
      if (!dataURL) {
        dataURL = await rasterize(root, scale);
        used = 'dom';
      }
      const out = await finish(dataURL, { maxWidth, format, quality, background: self.MT.settings.get('background-color') });
      return image(out.dataURL, { view: item.componentType, width: out.width, height: out.height, format, method: used, viewSize: { width: root.clientWidth, height: root.clientHeight } });
    }
  });

  define({
    name: 'export_view',
    title: 'Export view',
    description: 'Runs a view\'s own Export dialog: image formats (png, jpeg, webp, svg), data formats (csv, xlsx, json for tables and crosstab; Newick nwk for the tree; geojson for maps; fasta/mega for sequences; csv for the heatmap), as that view offers (call with no format to learn them: the result lists formats). With download true (default) the file is saved by the browser as filename + extension. With download false nothing is saved and the content is returned instead: text formats (svg, csv, json, nwk, geojson, fasta) as text, images as an image; XLSX and PDF cannot be returned. The view is brought to the front first.',
    inputSchema: {
      type: 'object',
      properties: {
        view: Object.assign({}, viewSchema, { description: 'The view to export (default: the active view)' }),
        open: openSchema,
        format: { type: 'string', description: 'A format the view offers, e.g. png, svg, csv, nwk (default: the first it offers)' },
        filename: { type: 'string', description: 'File name without extension' },
        download: { type: 'boolean', description: 'Save a file (default true), or return the content (false)' },
        scale: { type: 'number', minimum: 0.1, maximum: 8, description: 'Image scale (image formats; default 1)' },
        quality: { type: 'number', minimum: 0.1, maximum: 1, description: 'JPEG/WebP quality' },
        maxChars: { type: 'integer', minimum: 1000, description: 'With download false, the most text characters to return (default 200000)' },
        maxWidth: { type: 'integer', minimum: 100, description: 'With download false and an image format, scale down to this width (default 1200)' }
      },
      additionalProperties: false
    },
    annotations: { consequentialHint: true },
    confirm: ({ view, format, filename, download = true }) => download ?
      'Download an export of the ' + (view ? String(view).slice(0, 50) + ' view' : 'active view') + (format ? ' as ' + String(format).slice(0, 20) : '') +
      (filename ? ', named ' + JSON.stringify(String(filename).slice(0, 100)) : '') + ', to this computer.' : null,
    execute: async ({ view, open, format, filename, download = true, scale, quality, maxChars = 200000, maxWidth = 1200 }) => {
      const item = await need(view, { open, show: true });
      await settle(100);
      const result = await runExport(item, { format, filename, scale, quality, download });
      if (download) {
        return { view: item.componentType, downloaded: true, filename: result.name || result.filename, format: result.format, size: result.blob ? result.blob.size : null, note: result.note, formats: result.formats };
      }
      const blob = result.blob;
      const meta = { view: item.componentType, filename: result.name, format: result.format, mimeType: blob.type, size: blob.size, formats: result.formats };
      if (/^image\/(png|jpeg|webp)/.test(blob.type)) {
        const out = await finish(await blobToDataURL(blob), { maxWidth, format: blob.type == 'image/jpeg' ? 'jpeg' : 'png' });
        return image(out.dataURL, Object.assign(meta, { width: out.width, height: out.height }));
      }
      let body = await blob.text();
      const truncated = body.length > maxChars;
      if (truncated) body = body.slice(0, maxChars);
      return Object.assign(meta, { truncated, length: truncated ? undefined : body.length, content: body });
    }
  });

  // The network view -----------------------------------------------------------

  const networkHandle = () => {
    const h = self.temp && self.temp.network;
    if (!h || !h.graph) fail('The network view is not open (or its graph is still starting). Use open_view with view "network".');
    return h;
  };

  const networkState = h => {
    const g = h.graph;
    return {
      nodes: h.points.length,
      links: h.links.length,
      allPinned: !!self.session.network.allPinned,
      zoom: typeof g.getZoomLevel === 'function' ? g.getZoomLevel() : null,
      simulationRunning: typeof g.isSimulationRunning === 'boolean' ? g.isSimulationRunning : (g.isSimulationRunning === undefined ? null : !!g.isSimulationRunning)
    };
  };

  define({
    name: 'network_control',
    title: 'Control network view',
    description: 'Controls the 2D network view\'s camera and layout simulation. action: "fit" (center and scale the network to the view), "zoom" (set zoom level; level 1 is default, bigger is closer), "pin_all" / "unpin_all" (fix every node where it is / let the force layout move them again), "freeze" (pause the force simulation without pinning), "resume" (restart the simulation), "reheat" (restart with more energy to re-spread nodes). Opens the network view if needed. Returns the network\'s state (nodes, zoom, pinned).',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['fit', 'zoom', 'pin_all', 'unpin_all', 'freeze', 'resume', 'reheat'] },
        level: { type: 'number', minimum: 0.01, maximum: 100, description: 'For zoom: the zoom level' },
        duration: { type: 'integer', minimum: 0, description: 'Animation time in ms for fit/zoom (default 300)' }
      },
      required: ['action'],
      additionalProperties: false
    },
    execute: async ({ action, level, duration = 300 }) => {
      const item = await need('network', { open: true, show: true });
      void item;
      await waitFor(() => self.temp && self.temp.network && self.temp.network.graph, { timeout: GRAPH_WAIT_MS, message: 'The network graph did not start' });
      const h = networkHandle();
      const g = h.graph;
      switch (action) {
        case 'fit': h.fit(); break;
        case 'zoom':
          if (typeof level != 'number') fail('zoom needs a level');
          if (typeof g.setZoomLevel != 'function') fail('This network build cannot set a zoom level; use fit.');
          g.setZoomLevel(level, duration);
          break;
        case 'pin_all': if (!self.session.network.allPinned) h.pinAll(); break;
        case 'unpin_all': if (self.session.network.allPinned) h.pinAll(); break;
        case 'freeze': g.pause(); break;
        case 'resume': g.start(0.3); break;
        case 'reheat': g.start(1); break;
      }
      await settle(action == 'fit' ? 900 : 300);
      return Object.assign({ action }, networkState(networkHandle()));
    }
  });

  define({
    name: 'get_network_layout',
    title: 'Get network layout',
    description: 'Returns where the network view has put its nodes: each node\'s id and x/y position in layout space (as drawn now, including pinned nodes), with the view\'s state (zoom, pinned, simulation running). Useful for finding which nodes lie close together visually or for judging the layout. The network view must be open. Positions are rounded to `precision` decimals (default 1).',
    inputSchema: {
      type: 'object',
      properties: {
        ids: { type: 'array', items: { type: 'string' }, description: 'Only these node ids (default all, up to limit)' },
        limit: { type: 'integer', minimum: 1, maximum: 20000, description: 'Most nodes to return (default 2000)' },
        precision: { type: 'integer', minimum: 0, maximum: 6, description: 'Decimals to keep (default 1)' }
      },
      additionalProperties: false
    },
    annotations: { readOnlyHint: true },
    execute: async ({ ids, limit = 2000, precision = 1 }) => {
      await need('network');
      const h = networkHandle();
      const p = h.graph.getPointPositions();
      const k = Math.pow(10, precision);
      const want = ids && new Set(ids.map(String));
      const nodes = [];
      let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
      h.points.forEach((d, i) => {
        const x = p[2 * i], y = p[2 * i + 1];
        if (x != x) return;
        if (x < xmin) xmin = x; if (x > xmax) xmax = x; if (y < ymin) ymin = y; if (y > ymax) ymax = y;
        if (want && !want.has(String(d._id))) return;
        if (nodes.length < limit) nodes.push({ id: d._id, x: Math.round(x * k) / k, y: Math.round(y * k) / k, pinned: !!d.fixed, cluster: d.cluster === undefined ? null : d.cluster });
      });
      return Object.assign(networkState(h), { returned: nodes.length, bounds: { xmin, xmax, ymin, ymax }, nodes });
    }
  });

  void pick;
})(typeof self !== 'undefined' ? self : this);
