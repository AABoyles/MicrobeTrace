// View lifecycle: the layout, panels, panes, mounting and what views need.
//
// Views register and mount, open and launch, park and place their panels in the
// GoldenLayout, slide their settings panes, describe themselves, and cache and
// load the layout.
//
// An ES module (#323) that adds to MT: installX(MT, env), which createMT in common.js calls
// (#341). It uses these MT names from the other files at run time, through MT:
//   common.js: events, settings
//   loading.js: dateFields, loadDemo, locationKinds, pickLocationFields,
//     updateDemoButtons
//   ui.js: fillSelect, showColorOptions, showOnline, titleize
// It reads the session and temp (and the layout) from env, which is self on the page and a
// fake in tests; the browser and library globals (document, Worker, d3, ...) it reads bare.
// The body of the installer is not indented, so that the diff of the change that wrapped it
// stays small.


export function installViews(MT, env) {
let peek = ra => ra[ra.length - 1];

const emptyLayout = {
  settings: { showPopoutIcon: false },
  dimensions: { headerHeight: 26 },
  root: { type: "stack", content: [] }
};

// The view (component) items in a layout subtree, in layout order
const viewItems = item => !item ? [] : item.isComponent ? [item] : item.contentItems.flatMap(viewItems);
const stacks = item => !item || item.isComponent ? [] : (item.isStack ? [item] : []).concat(item.contentItems.flatMap(stacks));

MT.createLayout = () => {
  if (env.layout) {
    parkPanels();
    env.layout.destroy();
  }
  recentViews.length = 0;
  env.layout = new goldenLayout.GoldenLayout(document.getElementById("main-panel"));
  env.layout.resizeWithContainerAutomatically = true;
  // golden-layout builds a component before its element is in the page, where
  // a view's inline scripts couldn't find their own elements. Components are
  // therefore empty here, and renderView fills each one in once it's attached.
  env.layout.registerComponentFunction(() => function () {});
  // MicrobeTrace's open views, which golden-layout 1 called contentItems
  Object.defineProperty(env.layout, "contentItems", { get: () => viewItems(env.layout.rootItem) });
  env.layout.loadLayout(emptyLayout);
  env.layout.on("stateChanged", () => env.session.layout = MT.cacheLayout(env.layout.rootItem));
  env.layout.on("activeContentItemChanged", bringForward);
  env.layout.on("focus", e => bringForward(e.target));
};

// The views converted to ES modules (#339): components/NAME.js exports mount(root, ctx) and
// optionally `libraries`, and is loaded with import() rather than a script tag. Add a view's
// name here when it is converted (and take its <script> tag out of its HTML). The rest are
// classic scripts that call MT.registerView, being phased out.
const MODULE_VIEWS = new Set(["histogram", "table", "network", "geo_map", "choropleth", "globe", "phylogenetic_tree", "sequences", "bubbles", "waterfall", "timeline", "gantt", "heatmap", "scatterplot", "flow_diagram", "conflicts", "aggregation", "crosstab"]);
// The imported modules, by view name
const modules = {};

// Fetches a view's HTML into temp.componentCache, and its script (so that
// it is cached for the worker and a missing or wrong file shows up here, not
// when the view opens). A failed fetch (offline, 404, or a server answering
// with something other than HTML or script) is not cached, so the next attempt
// tries again, and rejects with a message naming the view.
const fetchView = view => {
  if (env.temp.componentCache[view]) return Promise.resolve();
  const fail = () => {
    throw new Error("Could not load the " + MT.titleize(view) + " view. Check your connection and try again.");
  };
  // server.js answers unknown paths with the app shell (index.html)
  const get = url => fetch(url).then(response => {
    if (!response.ok) fail();
    return response.text();
  }, fail).then(text => {
    if (/^\s*<!doctype/i.test(text)) fail();
    return text;
  });
  // A module view is imported, which fetches and checks its file as well as fetching does;
  // an unconverted one is fetched, and run later by the script tag in its HTML.
  const code = MODULE_VIEWS.has(view)
    ? import("../components/" + view + ".js").then(module => { modules[view] = module; }, fail)
    : get("components/" + view + ".js");
  return Promise.all([get("components/" + view + ".html"), code])
    .then(([html]) => { env.temp.componentCache[view] = html; });
};
const viewFailed = error => MT.toast.error(error.message);

// Renders a view's HTML into its (newly attached) layout item
// (Scripts set as HTML don't run, so each is replaced by a copy that does.)
// The page's content security policy allows no inline scripts, so a view's
// script is a file, named by a <script src> in its HTML. Scripts added like
// this run as soon as they load, in no set order, unless marked not async;
// they are, so they run in the order added. The view is only set up once its
// scripts have run, which is what the returned promise waits for (it rejects
// if one fails to load).
const renderView = contentItem => {
  const element = contentItem.container.element;
  element.innerHTML = env.temp.componentCache[contentItem.componentType];
  return Promise.all(Array.from(element.querySelectorAll("script"), old => new Promise((resolve, reject) => {
    const script = document.createElement("script");
    Array.from(old.attributes).forEach(a => script.setAttribute(a.name, a.value));
    script.async = false;
    script.textContent = old.textContent;
    if (script.src) {
      script.addEventListener("load", resolve);
      script.addEventListener("error", () => reject(new Error("Could not load the " + MT.titleize(contentItem.componentType) + " view. Check your connection and try again.")));
    }
    old.replaceWith(script);
    if (!script.src) resolve();
  })));
};

// The lazy libraries (see MT.loadLibrary) each view needs before it can be set up,
// which are fetched when the view first opens and not with the page (#324).
// Libraries needed only by an action, like the spreadsheet one for an Excel
// export, are loaded by that action.
const VIEW_LIBRARIES = {
  // A session can hold spreadsheets added but not yet read, which the view lists
  files: () => env.session.files.some(f => /^xlsx?$/i.test(f.extension || "")) ? ["xlsx"] : []
};
// A module view names its own in `export const libraries`, besides any listed above
// (once every view is a module the table can go, #339).
const librariesOf = view => {
  const listed = VIEW_LIBRARIES[view], declared = modules[view] && modules[view].libraries;
  return [].concat(typeof listed == "function" ? listed() : listed || [], declared || []);
};
const loadLibraries = view => Promise.all(librariesOf(view).map(MT.loadLibrary)).catch(() => {
  throw new Error("Could not load the " + MT.titleize(view) + " view. Check your connection and try again.");
});

// Renders a view and, once its scripts have run, sets it up and mounts it.
// A view closed while its script loaded is left alone. A view whose script
// or library couldn't load is closed, with a message.
const openView = contentItem => {
  const ready = loadLibraries(contentItem.componentType).then(() => renderView(contentItem)).then(() => {
    if (!contentItem.container.element.isConnected) return;
    setupView(contentItem);
    mountView(contentItem);
  }, error => {
    viewFailed(error);
    if (contentItem.container.element.isConnected) contentItem.remove();
  }).finally(() => { if (contentItem.ready === ready) contentItem.ready = null; });
  contentItem.ready = ready;
  return ready;
};

// A view is a mount function, which a module view exports (see MODULE_VIEWS) and a classic one
// registers from its script:
//
//   export function mount(root, { settings, events, MT, session, temp }) {
//     ...
//     return { resize() { ... }, destroy() { ... } };
//   }
//   MT.registerView('histogram', (root, { settings, events }) => { ... });  // classic
//
// mount runs once the view is in the layout, with the view's own element as
// root (query inside it rather than by global ID). resize() runs when the view
// changes size or its tab is shown, and destroy() when it closes. Views
// without a mount function are older ones that set themselves up when their
// script runs.
MT.views = {};
MT.registerView = (name, mount) => { MT.views[name] = mount; };

// A settings pane (.left-pane) is this many pixels wide, and slides in from
// this far off the left edge when closed (the -400px in main.css)
const PANE_WIDTH = 400;

// Slides a view's settings pane (.left-pane) in or out
MT.slidePane = (pane, open) => {
  if (pane.slide) pane.slide.cancel();
  const from = getComputedStyle(pane).display === 'none' ? `-${PANE_WIDTH}px` : getComputedStyle(pane).left;
  const to = open ? '0px' : `-${PANE_WIDTH}px`;
  pane.style.display = 'block';
  pane.style.left = to;
  pane.slide = pane.animate([{ left: from }, { left: to }], { duration: 400, easing: 'ease-in-out' });
  pane.slide.onfinish = () => {
    pane.slide = null;
    if (!open) pane.style.display = 'none';
  };
};

// Makes a view's settings button slide its pane in and out. The pane also
// gets a close button, and Escape closes it, unless it's closing a dialog or
// a menu first or is typed in a text field. `push`, if given, is an element
// moved aside while the pane is open instead of covered by it. `beside` is
// one moved aside only while the view is wide enough to keep a good width
// beside the pane (in a narrower view the pane covers it, as others do);
// `resize` redraws the view when it moves.
// A view that moves aside for an open pane gives up the pane's width plus 10px,
// and only does so while it is at least besideAtLeast pixels wide
const paneRoom = PANE_WIDTH + 10, besideAtLeast = 600;
// The width a view has to draw in: all of it, less what an open pane beside
// it takes
MT.viewWidth = root => root.clientWidth - (root.classList.contains('pane-beside-open') ? paneRoom : 0);
const openPanes = new Set();
const typing = target => target.isContentEditable || target.tagName === 'TEXTAREA' ||
  (target.tagName === 'INPUT' && !['checkbox', 'radio', 'range', 'button', 'color'].includes(target.type));
// In the capture phase, before a menu that Escape closes has closed
document.addEventListener('keydown', e => {
  if (e.key != 'Escape' || typing(e.target) || document.querySelector('.modal.show, .ts-wrapper.dropdown-active, .dropdown-menu.show')) return;
  openPanes.forEach(close => close());
}, true);
MT.paneToggle = (button, pane, open = false, { push, beside, resize } = {}) => {
  const root = pane.parentElement;
  let aside = false;
  const placeBeside = () => {
    const now = open && root.clientWidth >= paneRoom + besideAtLeast;
    if (now == aside) return;
    aside = now;
    beside.classList.toggle('pane-beside', aside);
    root.classList.toggle('pane-beside-open', aside);
    if (resize) resize();
  };
  if (beside) new ResizeObserver(placeBeside).observe(root);
  const set = value => {
    open = value;
    button.classList.toggle('active', open);
    MT.slidePane(pane, open);
    if (push) [].concat(push).forEach(element => element.classList.toggle('pane-pushed', open));
    if (beside) placeBeside();
    if (open) openPanes.add(close);
    else openPanes.delete(close);
  };
  const close = () => {
    if (!pane.isConnected) return openPanes.delete(close);
    if (open) set(false);
  };
  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'btn-close pane-close';
  closeButton.title = 'Close settings';
  closeButton.setAttribute('aria-label', 'Close settings');
  closeButton.addEventListener('click', close);
  pane.prepend(closeButton);
  // The pane's tabs start below the view's toolbar, however tall it grows
  const controls = button.closest('.view-controls');
  if (controls) new ResizeObserver(() => {
    pane.style.setProperty('--controls-height', controls.offsetHeight + 'px');
  }).observe(controls);
  button.addEventListener('click', () => set(!open));
  if (open) set(true);
};

// The room a view's docked tables take at its right (0 without any), and a
// way to hear when that changes: they come and go as views move to the
// front, and grow as they're expanded
MT.dockRoom = root => {
  const dock = Array.from(root.children).find(child => child.classList.contains('panel-dock'));
  return dock && dock.children.length ? dock.offsetWidth + 10 : 0;
};
MT.onDockChange = (root, fn) => {
  let room = MT.dockRoom(root);
  const observer = new ResizeObserver(() => {
    const now = MT.dockRoom(root);
    if (now != room) { room = now; fn(); }
  });
  observer.observe(MT.panelDock(root));
  return () => observer.disconnect();
};

// A view's panel dock: a column down its right-hand side that holds its
// floating tables, stacked so they never overlap, with the statistics at the
// bottom.
MT.panelDock = element => {
  let dock = Array.from(element.children).find(child => child.classList.contains('panel-dock'));
  if (!dock) {
    dock = document.createElement('div');
    dock.className = 'panel-dock';
    element.appendChild(dock);
  }
  return dock;
};

// The page's floating panels, and what a view says (with `panels` in what its
// mount function returns: a list, or a function giving one) to show them: the
// color tables in views that draw node or link colors, the statistics in the
// network. Each sits in the dock of the view in front that shows it, or
// nowhere if there's none. A view whose list changes calls MT.placePanels.
const pagePanels = { 'link-colors': 'link-color-table-wrapper', 'node-colors': 'node-color-table-wrapper', 'statistics': 'network-statistics-wrapper' };
const recentViews = [];
const parking = () => {
  let element = document.getElementById('panel-parking');
  if (!element) {
    element = document.createElement('div');
    element.id = 'panel-parking';
    element.hidden = true;
    document.body.appendChild(element);
  }
  return element;
};
// Panels inside a view go with it when it closes, so they're parked first
const parkPanels = element => Object.values(pagePanels).forEach(id => {
  const panel = document.getElementById(id);
  if (panel && (!element || element.contains(panel))) parking().appendChild(panel);
});
const inFront = item => item.parent && item.parent.isStack && item.parent.getActiveComponentItem() === item;
MT.placePanels = () => {
  if (!env.layout || !env.layout.rootItem) return parkPanels();
  const views = env.layout.contentItems.filter(inFront)
    .sort((a, b) => (recentViews.indexOf(a) + 1 || Infinity) - (recentViews.indexOf(b) + 1 || Infinity));
  Object.entries(pagePanels).forEach(([kind, id]) => {
    const panel = document.getElementById(id);
    if (!panel) return;
    const host = views.find(item => (typeof item.panels === 'function' ? item.panels() : item.panels || []).includes(kind));
    const into = host ? MT.panelDock(host.container.element) : parking();
    if (panel.parentElement !== into) into.appendChild(panel);
  });
};
const bringForward = item => {
  if (!item || !item.isComponent) return;
  const i = recentViews.indexOf(item);
  if (i >= 0) recentViews.splice(i, 1);
  recentViews.unshift(item);
  MT.placePanels();
};

// Names a view's graphic for assistive technology (#184): a region with a
// label, and a visually hidden summary (what's plotted, how much, and that the
// Table view lists the same data) that its description points to. Pass the
// element, its name, and a function that gives the summary's first sentence(s);
// it is written again when the data's visibility changes. Returns the refresh.
let summaryCount = 0;
MT.describeView = (element, name, summary, { role = 'region' } = {}) => {
  if (!element) return () => {};
  element.setAttribute('role', role);
  element.setAttribute('aria-label', name);
  const note = document.createElement('p');
  note.className = 'visually-hidden view-summary';
  note.id = 'view-summary-' + (++summaryCount);
  element.insertAdjacentElement('afterend', note);
  element.setAttribute('aria-describedby', note.id);
  const nodes = () => env.session.data.nodes.filter(d => d.visible !== false).length;
  const links = () => env.session.data.links.filter(d => d.visible !== false).length;
  const refresh = () => {
    let text = '';
    try { text = summary ? summary({ nodes: nodes(), links: links() }) : ''; } catch { /* the name stands alone */ }
    note.textContent = (text ? text + ' ' : '') + 'The Table view lists the same data.';
  };
  refresh();
  const events = MT.events, names = ['node-visibility', 'link-visibility', 'session-loaded'];
  const offs = names.map(n => events.on(n, refresh));
  return () => { offs.forEach(off => typeof off === 'function' && off()); note.remove(); };
};
const nodesOf = n => n.toLocaleString() + (n == 1 ? ' node' : ' nodes');
const linksOf = n => n.toLocaleString() + (n == 1 ? ' link' : ' links');
const variableName = value => String(value || '').replace(/^(links|nodes)-/, '');
// Each view's graphic: where it is, what it's called, and what it plots
MT.viewGraphics = {
  histogram: ['.histogram-plot', 'Histogram of link distances', c => `Histogram of ${variableName(MT.settings.get('histogram-variable'))} across ${linksOf(c.links)} and ${nodesOf(c.nodes)}.`],
  scatterplot: ['.scatterplot-plot', 'Scatterplot of node values', c => `Scatterplot of ${variableName(MT.settings.get('scatterplot-yVar'))} against ${variableName(MT.settings.get('scatterplot-xVar'))}, for ${nodesOf(c.nodes)}.`],
  heatmap: ['.heatmap-plot', 'Heatmap of pairwise distances', c => `Heatmap of the distances between ${nodesOf(c.nodes)}.`],
  bubbles: ['svg.bubbles', 'Bubble chart of node groups', c => `Bubbles for the groups of ${nodesOf(c.nodes)}.`],
  timeline: ['.timeline-chart', 'Epidemic curve over time', c => `Counts over time for ${nodesOf(c.nodes)}.`],
  flow_diagram: ['.flow-plot', 'Flow diagram between node groups', c => `Flows between the groups of ${nodesOf(c.nodes)}.`],
  geo_map: ['.map-canvas', 'Map of node locations', c => `Map of ${nodesOf(c.nodes)} by location.`],
  choropleth: ['.map-canvas', 'Choropleth map of regions', c => `Regions shaded by counts of ${nodesOf(c.nodes)}.`],
  globe: ['canvas.globe', 'Globe of node locations', c => `Globe of ${nodesOf(c.nodes)} by location.`, 'img'],
  phylogenetic_tree: ['.tree', 'Phylogenetic tree', c => `Tree of ${nodesOf(c.nodes)}. Right-click or press Shift+F10 on a branch for its menu.`],
  sequences: ['.sequences-panel', 'Sequence alignment', c => `Alignment of the sequences of ${nodesOf(c.nodes)}.`]
};

const mountView = contentItem => {
  const view = contentItem.componentType;
  const mount = modules[view] ? modules[view].mount : MT.views[view];
  if (!mount) return;
  const container = contentItem.container;
  // What a module view gets in place of the MT, session and temp globals (#339). session and
  // temp are getters because loading a session replaces them.
  const ctx = {
    settings: MT.settings, events: MT.events, container, MT,
    get session() { return env.session; },
    get temp() { return env.temp; }
  };
  const handle = mount(container.element, ctx) || {};
  contentItem.panels = handle.panels || [];
  const graphic = MT.viewGraphics[contentItem.componentType];
  if (graphic) {
    const element = container.element.querySelector(graphic[0]);
    if (element && !element.hasAttribute('aria-label')) {
      const undescribe = MT.describeView(element, graphic[1], graphic[2], { role: graphic[3] });
      container.on('destroy', undescribe);
    }
  }
  const resize = () => handle.resize && handle.resize();
  container.on('resize', resize);
  container.on('show', resize);
  // A view behind another can stop what only shows (an animation, say)
  if (handle.show) container.on('show', handle.show);
  if (handle.hide) container.on('hide', handle.hide);
  container.on('destroy', () => {
    parkPanels(container.element);
    const i = recentViews.indexOf(contentItem);
    if (i >= 0) recentViews.splice(i, 1);
    if (handle.destroy) handle.destroy();
    // Once the layout has settled, the view now in front takes the panels
    setTimeout(MT.placePanels);
  });
  bringForward(contentItem);
};

// Views that were renamed or removed, and the view that opens in their place
// (in saved sessions, layouts and settings)
MT.viewAliases = { '2d_network': 'network', 'pixi': 'network', '3d_network': 'network' };
MT.viewName = view => MT.viewAliases[view] || view;

MT.launchView = (view, callback) => {
  view = MT.viewName(view);
  if (!env.temp.componentCache[view]) {
    fetchView(view).then(() => MT.launchView(view, callback), viewFailed);
  } else {
    let contentItem = env.layout.contentItems.find(item => item.componentType == view);
    if (contentItem) {
      contentItem.parent.setActiveComponentItem(contentItem, true);
      // A view still loading its script is set up when it has
      if (!contentItem.ready) setupView(contentItem);
      else if (callback) { contentItem.ready.then(() => callback(contentItem)); return; }
    } else {
      if (!env.layout.rootItem) env.layout.loadLayout(emptyLayout);
      let lastStack = peek(stacks(env.layout.rootItem)) || env.layout.rootItem;
      contentItem = lastStack.newComponent(view, undefined, MT.titleize(view));
      // The item is in the layout now; it is set up once its script has run
      // (the callback waits for that too)
      const ready = openView(contentItem);
      if (callback) { ready.then(() => callback(contentItem)); return; }
      return contentItem;
    }
    if (callback) {
      callback(contentItem);
    } else {
      return contentItem;
    }
  }
};

// Fills in a view's variable menus, and binds its common controls
const setupView = contentItem => {
  const element = contentItem.element;
  const fill = (selector, fields) => element.querySelectorAll(selector).forEach(select => MT.fillSelect(select, fields, { none: true }));
  fill("select.nodeVariables", env.session.data.nodeFields);
  fill("select.linkVariables", env.session.data.linkFields);
  element.querySelectorAll("select.mixedVariables").forEach(select => {
    MT.fillSelect(select, env.session.data.linkFields, { none: true, prefix: "links-", label: "Link " });
    MT.fillSelect(select, env.session.data.nodeFields, { prefix: "nodes-", label: "Node ", append: true });
  });
  fill("select.branch-variables", ["id", "depth", "height", "length", "value"]);
  element.querySelectorAll(".launch-color-options").forEach(button => button.addEventListener("click", MT.showColorOptions));
  if (navigator.onLine) MT.showOnline(element);
  MT.updateViewNeeds(contentItem);
};

// What each view needs of the session. A view lacking it opens with a short
// note (see MT.updateViewNeeds) saying what to add, rather than blank. Each
// entry returns the note's text, or "" when the session has what the view needs.
const hasLinks = () => env.session.data.graph.edgeCount > 0;
const hasSequences = () => env.session.data.nodes.some(d => d.seq);
const FILES_HINT = "Add them in the Files view (the File menu's Add Data).";
const chosenField = key => { const v = MT.settings.get(key); return v != null && v != "None" && v !== ""; };
const MAP_NEEDS = name => "The " + name + " places nodes by latitude and longitude columns, or by country, state, county, zipcode or census tract. Choose the columns that hold them in this view's settings (the gear). If the data has none, add a node list that does.";
MT.viewNeeds = {
  sequences: () => hasSequences() ? "" : "This view lines up nodes' sequences, and none of these nodes has one. Add a FASTA file, or a node list with a sequence column. " + FILES_HINT,
  phylogenetic_tree: () => hasLinks() || hasSequences() || env.session.files.some(f => f.format == "newick") ? "" :
    "A tree needs sequences, a distance matrix, or a Newick tree file. " + FILES_HINT,
  heatmap: () => hasLinks() || hasSequences() ? "" : "The heatmap draws the distances between nodes, which needs sequences (a FASTA file) or a distance matrix. " + FILES_HINT,
  waterfall: () => hasLinks() ? "" : "This view lists each cluster's links, and there are none. Links come from a link list, a distance matrix, or sequences close enough to link. " + FILES_HINT,
  geo_map: () => MT.settingsHaveLocation("map-field-") ? "" : MAP_NEEDS("map"),
  globe: () => MT.settingsHaveLocation("globe-field-") ? "" : MAP_NEEDS("globe"),
  choropleth: () => chosenField("choropleth-aggregate-on") ? "" :
    "The choropleth shades regions by how many nodes are in each, so it needs a column of countries, states or counties. Choose it in this view's settings (the gear), or load a GeoJSON file there. If the data has none, add a node list that does.",
  timeline: () => MT.dateFields(env.session.data.nodes, env.session.data.nodeFields).length || chosenField("timeline-date-field") ? "" :
    "The epi curve counts nodes by date, and no column holds dates. Add a node list with a date column. " + FILES_HINT,
  gantt: () => MT.dateFields(env.session.data.nodes, env.session.data.nodeFields).length || (MT.settings.get("gantt-dates") || []).length ? "" :
    "This view draws each node's dates as bars, and no column holds dates. Add a node list with a date column. " + FILES_HINT
};

// Whether a map view's settings (the prefix then a kind of location) name a
// field of places or coordinates, once fields named for them are taken up
MT.settingsHaveLocation = prefix => {
  MT.pickLocationFields(MT.settings, prefix);
  return [...MT.locationKinds, "lat", "lon"].some(kind => chosenField(prefix + kind));
};

// Shows or hides a view's note of what it needs. With no data at all every
// view says so, and offers the demo; otherwise a view says what it lacks.
MT.updateViewNeeds = contentItem => {
  if (!contentItem || !contentItem.container) return;
  const view = contentItem.componentType, element = contentItem.container.element;
  if (view == "files" || view == "conflicts" || !element) return;
  // A change in the view's own settings (choosing a field) may meet its need
  if (!element.dataset.needsWatched) {
    element.dataset.needsWatched = "1";
    element.addEventListener("change", () => setTimeout(() => MT.updateViewNeeds(contentItem)));
  }
  let text = "";
  if (!env.session.data.nodes.length) {
    text = "There's no data yet. Add files in the Files view (link or node lists, a distance matrix, FASTA or Newick), or look around with the demo data.";
  } else if (MT.viewNeeds[view]) {
    try { text = MT.viewNeeds[view](); } catch (error) { console.error(error); }
  }
  let note = element.querySelector(":scope > .view-needs");
  element.classList.toggle("view-needed", !!text);
  if (!text) { if (note) note.remove(); return; }
  if (!note) {
    note = document.createElement("div");
    note.className = "view-needs";
    note.setAttribute("role", "status");
    note.innerHTML = '<div class="view-needs-title"></div><p class="view-needs-text"></p>' +
      '<div class="view-needs-actions"><button type="button" class="btn btn-primary btn-sm view-needs-files">Open Files</button> ' +
      '<button type="button" class="btn btn-light btn-sm view-needs-demo">Try the demo data</button></div>';
    note.querySelector(".view-needs-files").addEventListener("click", () => MT.launchView("files"));
    note.querySelector(".view-needs-demo").addEventListener("click", () => MT.loadDemo());
    element.appendChild(note);
  }
  const empty = !env.session.data.nodes.length;
  note.querySelector(".view-needs-title").textContent = empty ? "No data yet" : MT.titleize(view) + " needs more data";
  note.querySelector(".view-needs-text").textContent = text;
  // The demo replaces the session, so only an empty one offers it
  note.querySelector(".view-needs-demo").hidden = !empty;
  if (empty) MT.updateDemoButtons();
};
MT.updateAllViewNeeds = () => env.layout.contentItems.forEach(MT.updateViewNeeds);

MT.cacheLayout = contentItem => {
  if (!contentItem) return { type: "stack", content: [] };
  if (["stack", "row", "column"].includes(contentItem.type)) {
    return {
      type: contentItem.type,
      content: contentItem.contentItems.map(MT.cacheLayout)
    };
  }
  return { type: contentItem.componentType };
};

// Replaces the layout with one saved by MT.cacheLayout
MT.loadLayout = component => {
  // A layout saved with several views that now open the same one gets it once
  const views = [], toConfig = c => {
    if (["stack", "row", "column"].includes(c.type)) {
      const content = c.content.map(toConfig).filter(Boolean);
      // As launching them one by one did, the last view in each stack is active
      return c.type == "stack" ? { type: c.type, content, activeItemIndex: Math.max(content.length - 1, 0) } : { type: c.type, content };
    }
    const view = MT.viewName(c.type);
    if (views.includes(view)) return null;
    views.push(view);
    return { type: "component", componentType: view, title: MT.titleize(view) };
  };
  const root = toConfig(component || emptyLayout.root);
  return Promise.all(views.map(fetchView)).then(() => {
    env.layout.loadLayout(Object.assign({}, emptyLayout, { root }));
    // One at a time and in order, as each view's script runs when it loads.
    // Each item is marked as loading from the start, so a launchView for a
    // view still waiting its turn waits too, rather than setting up an empty
    // element (openView replaces the mark with its own when it starts).
    return env.layout.contentItems.reduce((done, item) => {
      const opened = done.then(() => openView(item));
      item.ready = opened;
      opened.finally(() => { if (item.ready === opened) item.ready = null; });
      return opened;
    }, Promise.resolve());
  }, viewFailed);
};
}
