// Session model, settings and events, and the work pipeline.
//
// The session's shape and how it is reset, the node and link model, the
// settings store and events, and the workers' progress and cancellation
// (MT.runWorker, MT.viewComputing).
//
// An ES module (#323). createMT(env) makes an MT, runs the other core modules'
// installers on it and returns it; importing a module does nothing (#341). src/mt.js
// calls it once for the page and sets self.MT for the classic scripts; tests call it
// for each fake env. It uses these MT names from the other files at run time:
//   colors.js: COLOR_BLIND_SAFE
//   links-clusters.js: getVisibleLinks
//   ui.js: enableSearch
//   views.js: createLayout, launchView
// env supplies session and temp (self on the page, a plain object in tests); document, Worker
// and the libraries are read as globals. The body of createMT is not indented, so that the
// diff of the change that wrapped it stays small.
import { db } from './db.js';
import { MTDates } from './dates.js';
import { MTEvents } from './events.js';
import { MTGraph } from './graph.js';
import { MTNodeSources } from './nodes.js';
import { MTSessionFormat } from './session-format.js';
import { MTSettings } from './settings.js';
import { cleanID } from './formats/shared.js';
import { makeSession } from './session.js';

import { installLoading } from './loading.js';
import { installLinksClusters } from './links-clusters.js';
import { installColors } from './colors.js';
import { installExport } from './export.js';
import { installViews } from './views.js';
import { installUI } from './ui.js';

export function createMT(env = self) {
const MT = {};

MT.dataSkeleton = () => MT.attachGraph({
  nodes: [],
  clusters: [],
  nodeFields: [
    "index",
    "_id",
    "selected",
    "cluster",
    "visible",
    "degree",
    "origin"
  ],
  nodeExclusions: [],
  linkFields: [
    "index",
    "source",
    "target",
    "visible",
    "cluster",
    "origin",
    "nn",
    "directed"
  ],
  clusterFields: [
    "id",
    "nodes",
    "links",
    "sum_distances",
    "links_per_node",
    "mean_genetic_distance",
    "visible"
  ],
  reference: '',
});

MT.defaultWidgets = {
  // Which floating tables and panels are shown
  "link-color-table-show": true,
  "link-dash-table-show": true,
  "network-statistics-show": true,
  "node-color-table-show": true,
  "node-symbol-table-show": true,
  "polygon-color-table-show": true,
  "network-gridlines-show": false,
  "node-label-orientation": "Right",
  "3DNet-link-tooltip-variable": "None",
  "3DNet-link-transparency": 0,
  "3DNet-link-width": 1.6,
  "3DNet-node-tooltip-variable": "_id",
  "3DNet-node-radius": 4,
  "3DNet-node-radius-variable": "None",
  "align-sw": false,
  "align-none": true,
  "ambiguity-resolution-strategy": "AVERAGE",
  "ambiguity-threshold": 0.015,
  "background-color": "#ffffff",
  "background-color-contrast": "#000000",
  "bubble-x": "None",
  "bubble-y": "None",
  "bubble-charge": 1.5,
  "bubble-size": null, // fits the view
  "choropleth-aggregate-as": "states",
  "choropleth-aggregate-on": "None",
  "choropleth-basemap-show": false,
  "choropleth-color-high": "#800026",
  "choropleth-color-low": "#ffffcc",
  "choropleth-color-medium": "#fd8d3c",
  "choropleth-satellite-show": false,
  "choropleth-transparency": 0.3,
  "cluster-minimum-size": 1,
  "default-distance-metric": "tn93",
  "distance-metrics-also": [],
  "default-view": "network",
  "filtering-epsilon": -8,
  "flow-showNodes": "selected",
  "globe-countries-show": false,
  "globe-field-lat": "None",
  "globe-field-lon": "None",
  "globe-field-tract": "None",
  "globe-field-zipcode": "None",
  "globe-field-county": "None",
  "globe-field-state": "None",
  "globe-field-country": "None",
  "globe-link-show": true,
  "globe-link-transparency": 0,
  "globe-node-jitter": -2,
  "globe-node-show": true,
  "globe-node-transparency": 0,
  "globe-stars-show": true,
  "heatmap-invertX": false,
  "heatmap-invertY": false,
  "heatmap-color-high": "#a50026",
  "heatmap-color-medium": "#ffffbf",
  "heatmap-color-low": "#313695",
  "heatmap-axislabels-show": false,
  "histogram-axis-x": true,
  "histogram-scale-log": false,
  "histogram-variable": "links-tn93",
  "infer-directionality-false": true,
  "link-color": "#a6cee3",
  "link-color-table-name-sort": "ASC",
  "link-color-table-counts-sort": "DESC",
  "link-color-table-counts": true,
  "link-color-table-frequencies": false,
  "link-color-variable": "None",
  // Links told apart by a dash pattern, as well as their color (#294)
  "link-dash-variable": "None",
  "link-directed": false,
  "link-label-variable": "None",
  "link-length": 0.125,
  "link-opacity": 0,
  "link-prune": "none",
  "link-sort-variable": "tn93",
  "link-storage": "auto",
  // The threshold each field's links were kept within, where only those were
  // kept (sparse storage); raising the threshold past it reveals no new links
  "link-stored-thresholds": {},
  "link-threshold": 0.015,
  "link-thresholds": {},
  "link-tooltip-variable": "None",
  "link-width": 3,
  "link-width-variable": "None",
  "link-width-max": 27,
  "link-width-min": 3,
  "map-basemap-show": false,
  "map-collapsing-on": true,
  "map-counties-show": false,
  "map-countries-show": true,
  "map-field-lat": "None",
  "map-field-lon": "None",
  "map-field-tract": "None",
  "map-field-zipcode": "None",
  "map-field-county": "None",
  "map-field-state": "None",
  "map-field-country": "None",
  "map-link-show": true,
  "map-link-tooltip-variable": "None",
  "map-link-transparency": 0,
  "map-node-jitter": -2,
  "map-node-show": true,
  "map-node-tooltip-variable": "_id",
  "map-node-transparency": 0,
  "map-satellite-show": false,
  "map-states-show": true,
  "network-friction": 0.4,
  "network-gravity": 0.05,
  "network-link-strength": 0.125,
  "node-border-width": 2,
  "node-charge": 200,
  "node-color": "#1f77b4",
  "node-color-border": "#000000",
  "node-color-table-name-sort": "ASC",
  "node-color-table-counts-sort": "DESC",
  "node-color-table-counts": true,
  "node-color-table-frequencies": false,
  "node-color-variable": "None",
  "node-highlight": false,
  "node-label-size": 16,
  "node-label-variable": "None",
  "node-radius": 250,
  "node-radius-variable": "None",
  "node-radius-min": 250,
  "node-radius-max": 4500,
  "node-symbol": "symbolCircle",
  "node-symbol-table-counts": true,
  "node-symbol-table-frequencies": false,
  "node-symbol-variable": "None",
  "node-timeline-variable": "None",
  "node-tooltip-variable": "_id",
  "physics-tree-branch-type": "Straight",
  "physics-tree-branch-length": 50,
  "physics-tree-charge": 30,
  "physics-tree-friction": 0.05,
  "physics-tree-gravity": 0.05,
  "physics-tree-lateral-strength": 0.025,
  "physics-tree-layout": "Horizontal",
  "physics-tree-node-label-variable": "None",
  "physics-tree-tooltip": "id",
  "physics-tree-type": "tree",
  "polygon-color": "#bbccee",
  "polygon-color-table-name-sort": "ASC",
  "polygon-color-table-counts-sort": "DESC",
  "polygon-color-table-counts": true,
  "polygon-color-table-frequencies": false,
  "polygons-color-show": false,
  "polygons-foci": "cluster",
  "polygons-gather-force": 0,
  "polygons-show" : false,
  "reference-source-file": false,
  "reference-source-first": false,
  "reference-source-consensus": true,
  "scatterplot-xVar": null, // chosen from the data
  "scatterplot-yVar": null,
  "scatterplot-logScale": false,
  "scatterplot-showNodes": false,
  "search-field": "_id",
  //#298
  "search-case-sensitive": false,
  "search-whole-word" : false,
  "selected-color": "#ff8300",
  "selected-color-contrast": "#000000",
  "timeline-bin": "auto",
  "timeline-date-field": "None",
  "timeline-noncumulative": true,
  "tree-animation-on": true,
  "tree-branch-distances-hide": true,
  "tree-branch-distance-size": 12,
  "tree-branch-nodes-show": false,
  "tree-horizontal-stretch": 1,
  "tree-layout-vertical": false,
  "tree-layout-horizontal": true,
  "tree-layout-circular": false,
  "tree-labels-align": false,
  "tree-labels-show": false,
  "tree-leaf-label-show": false,
  "tree-leaf-label-size": 12,
  "tree-leaf-node-radius-variable": "None",
  "tree-leaf-node-show": true,
  "tree-leaf-node-size": null, // fits the leaf spacing
  "tree-mode-square": true,
  "tree-mode-smooth": false,
  "tree-mode-straight": false,
  "tree-round-true": false,
  "tree-ruler-show": true,
  "tree-tooltip-show": true,
  "tree-type": "weighted",
  "tree-vertical-stretch": 1
};

MT.sessionSkeleton = () => ({
  formatVersion: MTSessionFormat.CURRENT_VERSION,
  data: MT.dataSkeleton(),
  files: [],
  layout: {
    content: [
      {
        type: "files"
      }
    ],
    type: "stack"
  },
  messages: [],
  meta: {
    loadTime: 0,
    readyTime: Date.now(),
    startTime: 0,
    anySequences: false
  },
  network: {
    allPinned: false,
    timelinePinned: false,
    nodes: [],
    timelineNodes: []
  },
  state: {
    timeStart: 0,
    timeEnd: Date.now(),
    timeTarget: null
  },
  style: {
    linkAlphas: [1],
    linkColors: MT.COLOR_BLIND_SAFE.slice(),
    linkValueNames: {},
    nodeAlphas: [1],
    nodeColors: MT.COLOR_BLIND_SAFE.slice(),
    nodeColorsTable: {},
    nodeColorsTableKeys: {},
    linkColorsTable: {},
    linkColorsTableKeys: {},
    nodeSymbols: [
      "symbolCircle",
      "symbolCross",
      "symbolDiamond",
      "symbolSquare",
      "symbolStar",
      "symbolTriangle",
      "symbolWye",
      "symbolTriangleDown",
      "symbolTriangleLeft",
      "symbolTriangleRight",
      "symbolDiamondAlt",
      "symbolDiamondSquare",
      "symbolPentagon",
      "symbolHexagon",
      "symbolHexagonAlt",
      "symbolOctagon",
      "symbolOctagonAlt",
      "symbolX"
    ],
    nodeSymbolsTable: {},
    nodeSymbolsTableKeys: {},
    nodeValueNames: {},
    polygonAlphas: [0.5],
    polygonColors: ['#bbccee','#cceeff','#ccddaa','#eeeebb','#ffcccc','#dddddd'],
    polygonValueNames: {},
    overwrite: {},
    // A copy: each session changes its own
    widgets: Object.assign({}, MT.defaultWidgets)
  },
  timeline: 0,
  warnings: []
});

// session.data.graph (an MTGraph, see src/graph.js) holds every link.
// session.data.links is a view of it: reading it builds a link object per link
// (as saved in session files), and assigning an array of links replaces the
// graph. It's expensive for big networks, so MicrobeTrace itself reads links
// through MT.getVisibleLinks, MT.getLink and the graph.
MT.attachGraph = data => {
  Object.defineProperty(data, 'graph', {
    value: new MTGraph(),
    writable: true,
    configurable: true
  });
  // The nodes by ID, and the values each file gave them (see src/nodes.js),
  // which sessions save as nodeSources
  Object.defineProperty(data, 'nodeIndex', { value: new Map(), writable: true, configurable: true });
  Object.defineProperty(data, 'sources', { value: new MTNodeSources(), writable: true, configurable: true });
  Object.defineProperty(data, 'nodeSources', {
    enumerable: true,
    configurable: true,
    get() { return this.sources.save(key => this.nodeIndex.get(key)); },
    set(saved) { this.sources = MTNodeSources.restore(saved, key => this.nodeIndex.get(key)); }
  });
  Object.defineProperty(data, 'links', {
    enumerable: true,
    configurable: true,
    get() { return MT.getAllLinks(this); },
    set(links) {
      this.graph = new MTGraph();
      links.forEach(l => this.graph.addLink(l));
    }
  });
  return data;
};

MT.tempSkeleton = () => ({
  componentCache: {},
  mapData: {},
  messageTimeout: null,
  style: {
    linkAlphaMap: () => 1 - env.session.style.widgets["link-opacity"],
    linkColorMap: () => env.session.style.widgets["link-color"],
    nodeAlphaMap: () => 1,
    nodeColorMap: () => env.session.style.widgets["node-color"],
    nodeSymbolMap: () => env.session.style.widgets["node-symbol"],
    polygonAlphaMap: () => 0.5,
    polygonColorMap: () => env.session.style.widgets["polygon-color"]
  },
  trees: {}
});

MT.defaultNode = () => ({
  index: env.session.data.nodes.length,
  _id: "",
  selected: false,
  cluster: 1,
  visible: true,
  degree: 0,
  origin: []
});

let uniq = a => {
  let seen = {};
  let out = [];
  let len = a.length;
  let j = 0;
  for(let i = 0; i < len; i++) {
    let item = a[i];
    if(seen[item] !== 1) {
      seen[item] = 1;
      out[j++] = item;
    }
  }
  return out;
};
// Used by loading.js too (session upgrades)
MT.uniq = uniq;

// An ID as the app keeps it: text, without the spaces around it. Every
// path that loads data goes through this, so one ID from two sources is one
// node. (Matching stays case-sensitive: "a" and "A" are different IDs.)
// One rule for IDs, shared with the format parsers so one ID from two files is one node (#337)
MT.cleanID = cleanID;

// The session's owner (src/session.js): every write to session.data goes through it (#338).
// These are its older names, which loading code and the tests use.
MT.session = makeSession(MT, env);
MT.addNodeField = MT.session.addNodeField;
MT.addNode = MT.session.addNode;
MT.addLink = MT.session.addLink;

// Each file's value for a node's field, top file first, marking the one used
MT.provenance = (id, field) => env.session.data.sources.provenance('' + id, field);

// Where files disagree: each field, with the IDs of the nodes they disagree on
MT.nodeConflicts = () => env.session.data.sources.conflicts();

MT.preferSource = MT.session.preferSource;
MT.pickSource = MT.session.pickSource;

// The link between two node IDs, or undefined.
MT.getLink = (source, target) => {
  const g = env.session.data.graph;
  const a = g.index.get('' + source), b = g.index.get('' + target);
  if (a === undefined || b === undefined) return;
  const e = g.edgeBetween(a, b);
  if (e >= 0) return MT.linkObject(e);
};

// A plain link object for edge e of the graph.
// (With shareOrigin, its origin list is the graph's own, which must be left alone.)
MT.linkObject = (e, visible, data, shareOrigin) => {
  data = data || env.session.data;
  const g = data.graph;
  const link = g.link(e, shareOrigin);
  data.linkFields.forEach(field => {
    if (!(field in link)) link[field] = null;
  });
  link.visible = visible === undefined ? MT.isLinkVisible(e) : visible;
  link.cluster = g.nodeCluster ? g.nodeCluster[g.source(e)] : 1;
  return link;
};

MT.isLinkVisible = e => {
  const g = env.session.data.graph;
  if (!env.temp.visibleSet || env.temp.visibleSet.graph !== g || env.temp.visibleSet.version !== g.visibleVersion) {
    env.temp.visibleSet = { graph: g, version: g.visibleVersion, set: new Set(g.visible.subarray(0, g.visibleCount)) };
  }
  return env.temp.visibleSet.set.has(e);
};

// The visible links of node id, as { neighbor: ID, link: link object }.
MT.getVisibleNeighbors = id => {
  const g = env.session.data.graph, x = g.index.get('' + id);
  if (x === undefined) return [];
  const out = [];
  for (let v = 0; v < g.visibleCount; v++) {
    const e = g.visible[v], s = g.source(e), t = g.target(e);
    if (s == x || t == x) out.push({ neighbor: g.ids[s == x ? t : s], link: MT.linkObject(e, true) });
  }
  return out;
};

// Every link as an object (what session files store).
MT.getAllLinks = data => {
  data = data || env.session.data;
  const g = data.graph;
  const visible = new Set(g.visible.subarray(0, g.visibleCount));
  const out = [];
  g.forEachEdge(e => out.push(MT.linkObject(e, visible.has(e), data)));
  return out;
};

// Runs a worker on one message and resolves with its reply (the message's
// data). It rejects, with an Error, when the worker throws (onerror), when
// its reply cannot be read (onmessageerror), or when it replies with an
// error ({error: "..."} or the string "Error"); it settles once, and the
// worker is terminated either way, so a failing worker can't leave the
// caller waiting (#222). name says what the worker was doing, for the message.
//
// Running workers can be stopped: MT.cancelWork() terminates them all and
// rejects their promises with an Error whose .cancelled is true, and until
// MT.startWork() runs again, no new worker starts (so the step that was
// waiting on one doesn't go on to start the next). A worker may report its
// progress by posting {progress: fraction} (0 to 1); onProgress gets it.
//
// A view's computations run in a scope of their own (MT.workScope), so that
// view's Cancel stops only its workers, and MT.cancelWork (Launch's Cancel)
// doesn't stop them: a scope's workers are in the scope, not in running.
const running = new Set();
let cancelled = false;
const cancelError = () => Object.assign(new Error("it was cancelled"), { cancelled: true });
MT.startWork = () => { cancelled = false; };
MT.cancelWork = () => {
  cancelled = true;
  Array.from(running).forEach(cancel => cancel());
};
MT.workCancelled = () => cancelled;
MT.workScope = () => {
  const stops = new Set();
  const scope = {
    cancelled: false,
    stops,
    cancel() {
      scope.cancelled = true;
      Array.from(stops).forEach(stop => stop());
    }
  };
  return scope;
};

// Timings and other developer messages, printed only when debugging is on:
// add ?debug to the address, or run localStorage.setItem('MT.debug', '1') in
// the console, then reload. (Workers switch on with it too: runWorker starts
// them with the name "debug", which each worker's debugTime reads.)
MT.debugging = (() => {
  try { return /[?&]debug\b/.test(location.search) || localStorage.getItem('MT.debug') == '1'; } catch { return false; }
})();
MT.debug = (...args) => { if (MT.debugging) console.log(...args); };
// start is the Date.now() value from when the work began
MT.time = (label, start) => { if (MT.debugging) console.log(label + ' time: ', (Date.now() - start).toLocaleString(), 'ms'); };

MT.runWorker = (script, message, { transfer, name, worker, onProgress, scope } = {}) => {
  return new Promise((resolve, reject) => {
    if (scope ? scope.cancelled : cancelled) return reject(cancelError());
    const computer = worker || new Worker(script, MT.debugging ? { name: "debug" } : undefined);
    const owners = scope ? scope.stops : running;
    let settled = false;
    const settle = (fn, value) => {
      if (settled) return;
      settled = true;
      owners.delete(stop);
      try { computer.terminate(); } catch { /* already gone */ }
      fn(value);
    };
    const what = name || script;
    const fail = reason => settle(reject, reason instanceof Error ? reason : new Error(reason));
    const stop = () => fail(cancelError());
    owners.add(stop);
    computer.onmessage = response => {
      const data = response && response.data;
      if (data === "Error") return fail(what + " failed");
      if (data && typeof data === "object" && data.error) return fail(data.error);
      if (data && typeof data === "object" && Object.keys(data).length === 1 && typeof data.progress === "number") {
        if (onProgress) onProgress(data.progress);
        return;
      }
      settle(resolve, data);
    };
    computer.onerror = event => {
      if (event && event.preventDefault) event.preventDefault();
      fail((event && event.message) || what + " failed");
    };
    computer.onmessageerror = () => fail(what + " sent a reply that could not be read");
    try {
      computer.postMessage(message, transfer);
    } catch (error) {
      fail(error);
    }
  });
};

// The loading dialog's progress: the step being done and, where known, how
// far along it is (done of total). It is announced (the text is a live region).
MT.progress = (text, done, total) => {
  const label = document.getElementById("loading-progress-text");
  const bar = document.getElementById("loading-progress-bar");
  const wrap = document.getElementById("loading-progress");
  if (!label || !bar || !wrap) return;
  const known = typeof total === "number" && total > 0;
  const percent = known ? Math.max(0, Math.min(100, Math.round(100 * done / total))) : null;
  label.textContent = text + (known ? ` (${percent}%)` : "...");
  wrap.hidden = false;
  bar.classList.toggle("progress-bar-striped", !known);
  bar.classList.toggle("progress-bar-animated", !known);
  bar.style.width = known ? percent + "%" : "100%";
  bar.setAttribute("aria-valuenow", known ? percent : 0);
  const modal = document.getElementById("loading-information-modal");
  if (modal) modal.setAttribute("aria-busy", "true");
};
MT.progressDone = () => {
  const modal = document.getElementById("loading-information-modal");
  if (modal) modal.setAttribute("aria-busy", "false");
};

// A view's own computation (#293), shown in the view: "Computing the tree..."
// with its progress where the worker reports it, and a Cancel that stops the
// workers this computation started (its scope), not Launch's or another
// view's. Cancelled or failed, the view says so and offers Retry, which runs
// the same work again. The text is a live region, as the loading dialog's is.
// MT.viewComputing(root, what) returns { run, stop, destroy }: run(work, done)
// calls work(scope, onProgress), which returns the result or a promise of it,
// and then done(result), unless the run was cancelled, superseded (by a later
// run or stop) or the view closed. stop() ends the current run without a message.
MT.viewComputing = (root, what) => {
  const box = document.createElement("div");
  box.className = "view-computing";
  box.innerHTML = `<p class="visually-hidden" role="status" aria-live="polite"></p>
    <div class="view-computing-card" hidden>
      <p class="view-computing-text" aria-hidden="true"></p>
      <div class="progress view-computing-progress">
        <div class="progress-bar progress-bar-striped progress-bar-animated" role="progressbar" aria-label="Progress" aria-valuemin="0" aria-valuemax="100" style="width: 100%"></div>
      </div>
      <div class="view-computing-actions">
        <button type="button" class="btn btn-secondary btn-sm view-computing-cancel">Cancel</button>
        <button type="button" class="btn btn-primary btn-sm view-computing-retry" hidden>Retry</button>
      </div>
    </div>`;
  root.append(box);
  const status = box.querySelector('[role="status"]');
  const card = box.querySelector(".view-computing-card");
  const text = box.querySelector(".view-computing-text");
  const bar = box.querySelector(".progress-bar");
  const cancelButton = box.querySelector(".view-computing-cancel");
  const retryButton = box.querySelector(".view-computing-retry");
  let current = null, last = null, destroyed = false, announced = -1;

  // mode: "busy" (Cancel), "stopped" (Retry) or "idle" (nothing shown)
  const setState = (message, mode) => {
    const focused = box.contains(document.activeElement) ? document.activeElement : null;
    card.hidden = mode == "idle";
    cancelButton.hidden = mode != "busy";
    retryButton.hidden = mode != "stopped";
    bar.parentElement.hidden = mode != "busy";
    text.textContent = message;
    status.textContent = message;
    // Focus can't stay on a control that's gone: move it to the one that replaces it
    if (focused && (card.hidden || focused.hidden)) {
      const next = mode == "stopped" ? retryButton : mode == "busy" ? cancelButton : root.querySelector(".view-controls button");
      if (next) next.focus();
    }
  };
  // The live region is told each tenth of the way, not at every step
  const progressTo = fraction => {
    const percent = Math.max(0, Math.min(100, Math.round(100 * fraction)));
    bar.classList.remove("progress-bar-striped", "progress-bar-animated");
    bar.style.width = percent + "%";
    bar.setAttribute("aria-valuenow", percent);
    text.textContent = `Computing ${what} (${percent}%)...`;
    if (Math.floor(percent / 10) != announced) {
      announced = Math.floor(percent / 10);
      status.textContent = `Computing ${what} (${percent}%)...`;
    }
  };

  const stop = () => {
    const was = current;
    current = null;
    if (was) was.cancel();
    setState("", "idle");
  };
  const run = (work, done = () => {}) => {
    if (destroyed) return Promise.resolve();
    if (current) {
      const superseded = current;
      current = null;
      superseded.cancel();
    }
    const scope = current = MT.workScope();
    last = { work, done };
    const computing = `Computing ${what}`;
    announced = -1;
    setState(computing + "...", "busy");
    // Until the worker reports a fraction, the bar says only that work is going on
    bar.classList.add("progress-bar-striped", "progress-bar-animated");
    bar.style.width = "100%";
    bar.removeAttribute("aria-valuenow");
    return Promise.resolve()
      .then(() => work(scope, fraction => { if (scope === current) progressTo(fraction); }))
      .then(result => {
        if (scope !== current) return;
        done(result);
        current = null;
        setState("", "idle");
      })
      .catch(error => {
        if (scope !== current) return;
        current = null;
        if (scope.cancelled || (error && error.cancelled)) return setState(`${computing} was cancelled.`, "stopped");
        console.error(error);
        const reason = ((error && error.message) || "" + error).replace(/\.$/, "");
        setState(`Couldn't compute ${what}: ${reason}.`, "stopped");
      });
  };
  cancelButton.addEventListener("click", () => { if (current) current.cancel(); });
  retryButton.addEventListener("click", () => { if (last) run(last.work, last.done); });

  return {
    run,
    stop,
    destroy() {
      destroyed = true;
      stop();
      box.remove();
    }
  };
};

// The one place that replaces the session and temp globals is MT.session.reset (src/session.js)
MT.resetSession = MT.session.reset;

MT.reset = () => {

  // temp variables is affecting the recall file's link visibility when recalling the same file
  // reset temp causing register component error since file view has been registered and 2nd_network view via ansyc call also causing register error
  // reset temp but retain componentCache
  MT.resetSession({ keepComponents: true });
  
  // The controls show the new session's settings (and the statistics hide,
  // having no network)
  MT.settings.reload();
  MT.enableSearch(false);
  // A new layout also drops the stateChanged listeners the old views added
  MT.createLayout();
  MT.launchView("files");
};

// The settings store and event bus that views use (see src/settings.js and
// src/events.js)
MT.settings = new MTSettings(() => env.session.style.widgets);
MT.events = new MTEvents();

// Today, as YYYY-MM-DD in local time
MT.today = () => {
  const d = new Date(), pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// Turns autostash on or off, as the Files view's Session Recovery buttons do
// (and WebMCP's set_autostash). Turning it off stops the copies made each minute.
MT.setAutostash = enabled => {
  enabled = !!enabled;
  db.setItem('stash-auto', enabled ? 'true' : 'false');
  if (!enabled && env.temp.autostash) clearInterval(env.temp.autostash.interval);
  const radio = document.querySelector('input[name="stash-auto"][value="' + (enabled ? 'true' : 'false') + '"]');
  if (radio) radio.checked = true;
};

// Reads a date field (see src/dates.js): null if it is not a date.
MT.parseDate = MTDates.parseDate;

installLoading(MT, env);
installLinksClusters(MT, env);
installColors(MT, env);
installExport(MT, env);
installViews(MT, env);
installUI(MT, env);

return MT;
}
