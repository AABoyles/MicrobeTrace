import { fail, waitFor } from '../core.js';

// How long a tool waits for a view's network to start, and for a view it
// opened to show up
export const GRAPH_WAIT_MS = 20000, VIEW_SHOW_WAIT_MS = 5000;

export const VIEWS = [
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
  { id: 'geo_map', title: 'Map', group: 'Maps', description: 'Nodes and links on a map, placed by latitude/longitude fields or by zipcode, county, state or country fields. Setting map-projection draws it flat (mercator), as the United States with Alaska and Hawaii inset (albers-usa) or as a globe; setting map-shade shades countries, states or counties by how many nodes each holds (a choropleth). Works offline.', requires: 'loaded data with geographic fields' },
  { id: 'phylogenetic_tree', title: 'Phylogenetic Tree', group: 'Sequences', description: 'A phylogenetic tree built from the sequences (neighbor-joining or similar), or a loaded Newick tree, with layouts (vertical, horizontal, circular) and node styling. Exports Newick.', requires: 'sequences, or a loaded Newick tree' },
  { id: 'sequences', title: 'Sequences', group: 'Sequences', description: 'The aligned sequences as a colored grid of bases, with consensus and variant highlighting. Exports FASTA/MEGA/PNG.', requires: 'sequences' }
];

const VIEW_IDS = VIEWS.map(v => v.id);

export const viewSchema = { type: 'string', enum: VIEW_IDS, description: 'The view\'s id (see list_views). Old names such as 2d_network or pixi mean network. Omit for the active view where the tool says so.' };

export const openSchema = { type: 'boolean', description: 'Open the view first if it is not open (default false: fails if the view is not open)' };

const MT = () => self.MT;

const nextFrame = () => new Promise(r => requestAnimationFrame(() => r()));

const sleep = ms => new Promise(r => setTimeout(r, ms));

export const settle = async (ms = 80) => { await nextFrame(); await nextFrame(); await sleep(ms); };

const canon = view => view ? MT().viewName(String(view).trim().toLowerCase().replace(/[\s-]+/g, '_')) : view;

export const hasLayout = () => self.layout && self.layout.rootItem;

export const items = () => hasLayout() ? self.layout.contentItems : [];

export const itemOf = view => items().find(i => i.componentType === view);

export const rootOf = item => item.container.element;

export const isShown = item => { const r = rootOf(item); return !!(r && r.clientWidth && r.clientHeight); };

const activeOf = stack => stack && (typeof stack.getActiveComponentItem === 'function' ? stack.getActiveComponentItem() : stack.activeComponentItem);

export const isActive = item => item.parent && activeOf(item.parent) === item;

// Waits for a view's element to be filled in (and, for the network, its graph)
export async function mounted(item) {
  await waitFor(() => rootOf(item).children.length > 0, { timeout: 30000, message: 'The ' + item.componentType + ' view did not finish opening' });
  if (item.componentType === 'network') {
    await waitFor(() => self.temp && self.temp.network && self.temp.network.graph, { timeout: GRAPH_WAIT_MS }).catch(() => {});
  }
  await settle(50);
}

export async function activate(item) {
  if (!isActive(item)) item.parent.setActiveComponentItem(item, true);
  await waitFor(() => isShown(item), { timeout: VIEW_SHOW_WAIT_MS }).catch(() => {});
  await settle(60);
}

export function launch(view) {
  return new Promise((resolve, reject) => {
    try { MT().launchView(view, resolve); } catch (e) { reject(e); }
  });
}

export function checkView(view) {
  view = canon(view);
  if (!VIEW_IDS.includes(view)) fail('Unknown view ' + JSON.stringify(view) + '. The views are: ' + VIEW_IDS.join(', '));
  return view;
}

// The open item for a view (opening it first if asked), or the active view's
export async function need(view, { open = false, show = false } = {}) {
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
export function snapshot(item = self.layout.rootItem) {
  if (!item) return { type: 'stack', content: [] };
  if (item.isComponent) return { type: item.componentType };
  const out = { type: item.type, content: item.contentItems.map(snapshot) };
  if (item.type === 'stack') { const a = activeOf(item); if (a) out.active = a.componentType; }
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
  if (item.type === 'stack') { const a = activeOf(item); out.activeView = a ? a.componentType : null; }
  return out;
}

export const layoutState = () => ({
  openViews: items().map(i => i.componentType),
  activeViews: items().filter(isActive).map(i => i.componentType),
  tree: describe(),
  layout: snapshot()
});

// Applies a layout tree ({type: stack|row|column, content, active}; leaves
// {type: viewId}), then makes each stack's `active` view the one in front
export async function applyLayout(tree) {
  const views = [];
  const check = (node, path) => {
    if (!node || typeof node !== 'object' || typeof node.type !== 'string') fail('Layout node at ' + path + ' needs a type');
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
    if (node.type === 'stack' && node.active) {
      const it = itemOf(canon(node.active));
      if (it) it.parent.setActiveComponentItem(it, false);
    }
    node.content.forEach(front);
  };
  front(tree);
  await settle(120);
  items().forEach(i => { try { const m = MT().views[i.componentType]; void m; } catch { /* nothing */ } });
  window.dispatchEvent(new Event('resize'));
  await settle(80);
}

const text = el => el ? el.textContent.replace(/\s+/g, ' ').trim() : '';

const isOff = (el, root) => {
  for (let e = el; e && e !== root; e = e.parentElement) {
    if (e.matches('.left-pane, .tab-pane, .collapse, .modal')) continue;
    if (e.hidden || e.style.display === 'none' || e.classList.contains('d-none') || getComputedStyle(e).display === 'none') return true;
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

const descriptionOf = el => {
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
export function settingsOf(root) {
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
    const rec = Object.assign({ key, label: labelOf(el, root) || self.MT.titleize(key), description: descriptionOf(el) }, sectionOf(el, root));
    if (el.type === 'checkbox') rec.type = 'boolean';
    else if (el.type === 'radio') {
      const options = controls.map(c => {
        const lab = c.closest('label');
        return { value: c.value, label: text(lab) || c.value };
      });
      if (options.every(o => o.value === 'true' || o.value === 'false')) {
        rec.type = 'boolean';
        rec.options = options.map(o => ({ value: o.value === 'true', label: o.label }));
      } else {
        rec.type = 'choice';
        rec.options = options;
      }
    } else if (el.tagName === 'SELECT') {
      rec.type = el.multiple ? 'multi-choice' : 'choice';
      rec.options = optionsOf(el);
    } else if (el.type === 'range' || el.type === 'number') {
      rec.type = 'number';
      rec.control = el.type === 'range' ? 'slider' : 'number';
      ['min', 'max', 'step'].forEach(a => { if (el.getAttribute(a) !== null && el.getAttribute(a) !== '') rec[a] = Number(el.getAttribute(a)); });
    } else if (el.type === 'color') rec.type = 'color';
    else rec.type = 'text';
    rec.value = MTs.get(key);
    if (rec.value === undefined) rec.value = null;
    rec.disabled = controls.every(c => c.disabled);
    rec.visible = !controls.every(c => isOff(c, root));
    rec._controls = controls;
    return rec;
  });
}

// Drops the bound controls, which are DOM nodes, from a record
export const publicRecord = r => Object.fromEntries(Object.entries(r).filter(([k]) => k !== '_controls'));

// Inputs of a view that are not bound to settings
export function otherControls(root) {
  const out = [];
  root.querySelectorAll('select, input, textarea').forEach(el => {
    if (el.dataset.setting || el.closest('.modal, .tabulator, .js-plotly-plot, .ts-wrapper, .dropdown-menu') || el.type === 'hidden' || el.type === 'file' || el.type === 'button') return;
    if (el.classList.contains('ts-control') || el.closest('.btn-group-toggle')) return;
    const control = controlSelector(root, el);
    if (!control) return;
    const rec = { control, label: labelOf(el, root) || el.title || '', type: el.tagName === 'SELECT' ? (el.multiple ? 'multi-choice' : 'choice') : el.type === 'checkbox' ? 'boolean' : el.type, value: el.type === 'checkbox' ? el.checked : (el.multiple ? Array.from(el.selectedOptions).map(o => o.value) : el.value), disabled: el.disabled };
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

export const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'button';

export function actionsOf(root, includeExport) {
  const seen = new Map(), out = [];
  root.querySelectorAll('button, [role="button"], a.btn, input[type="button"], .dropdown-item').forEach(el => {
    if (el.closest('.modal') || el.classList.contains('btn-close') || el.matches('label')) return;
    if (el.closest('.tabulator, .js-plotly-plot, .ts-wrapper')) return;
    const toggle = el.dataset.bsToggle;
    if (toggle === 'tab' || toggle === 'collapse') return;
    if (el.dataset.setting || el.querySelector('[data-setting]') || el.closest('.btn-group-toggle')) return;
    const exportOpener = toggle === 'modal';
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
      kind: exportOpener ? 'export' : toggle === 'dropdown' ? 'menu' : menu ? 'menu item' : 'button',
      menu: toggler ? (toggler.title || text(toggler)) : undefined,
      pressed: el.getAttribute('aria-pressed') === 'true' || (el.classList.contains('active') && el.matches('.settings-toggle, [class*="toggle"]')) || undefined,
      enabled: !el.disabled && !el.classList.contains('disabled'),
      visible: !isOff(el, root),
      el
    });
  });
  return out;
}

export const publicAction = a => { const rest = Object.fromEntries(Object.entries(a).filter(([k]) => k !== 'el')); Object.keys(rest).forEach(k => rest[k] === undefined && delete rest[k]); return rest; };

export const blobToDataURL = blob => new Promise((resolve, reject) => {
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
export async function finish(dataURL, { maxWidth, format = 'png', quality = 0.9, background }) {
  const img = await loadImage(dataURL);
  let w = img.naturalWidth, h = img.naturalHeight;
  const wanted = 'image/' + format;
  const scale = maxWidth && w > maxWidth ? maxWidth / w : 1;
  if (scale === 1 && dataURL.startsWith('data:' + wanted + ';')) return { dataURL, width: w, height: h };
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const c = canvas.getContext('2d');
  if (format === 'jpeg') { c.fillStyle = background || '#ffffff'; c.fillRect(0, 0, canvas.width, canvas.height); }
  c.imageSmoothingQuality = 'high';
  c.drawImage(img, 0, 0, canvas.width, canvas.height);
  return { dataURL: canvas.toDataURL(wanted, quality), width: canvas.width, height: canvas.height };
}

// The view's export dialog action (see MT.exporterOf): its file types, and run()
export const exporterOf = item => MT().exporterOf(rootOf(item));

// Runs a view's own export action with these settings, taking the file it
// saves (MT.saveAs) when `download` is false instead of letting it download
export async function runExport(item, { format, filename, scale, quality, download }) {
  const exporter = exporterOf(item);
  if (!exporter) fail('The ' + item.componentType + ' view has no export dialog.');
  const formats = exporter.types;
  format = format ? String(format).toLowerCase().replace('jpg', 'jpeg') : formats[0].value;
  const chosen = formats.find(f => f.value === format || f.label.toLowerCase() === format);
  if (!chosen) fail('The ' + item.componentType + ' view exports: ' + formats.map(f => f.value).join(', ') + ' (not ' + format + ')');
  const m = MT(), original = m.saveAs;
  let saved = null;
  m.saveAs = (blob, name) => {
    saved = { blob, name };
    if (download) original.call(m, blob, name);
  };
  let base;
  try {
    // Resolves once the file is saved; a view that saves another way (XLSX) never reaches saveAs
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

export const networkHandle = () => {
  const h = self.temp && self.temp.network;
  if (!h || !h.graph) fail('The network view is not open (or its graph is still starting). Use open_view with view "network".');
  return h;
};

export const networkState = h => {
  const g = h.graph;
  return {
    nodes: h.points.length,
    links: h.links.length,
    allPinned: !!self.session.network.allPinned,
    zoom: typeof g.getZoomLevel === 'function' ? g.getZoomLevel() : null,
    simulationRunning: typeof g.isSimulationRunning === 'boolean' ? g.isSimulationRunning : (g.isSimulationRunning === undefined ? null : !!g.isSimulationRunning)
  };
};
