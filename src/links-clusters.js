// Links and clusters: distances, links, trees, clusters and statistics.
//
// Consensus and distances, the links within a threshold, the distance matrix,
// trees and nearest-neighbour and spanning-tree pruning, clusters, what is
// visible, and the statistics.
//
// An ES module (#323) that adds to MT: installX(MT, env), which createMT in common.js calls
// (#341). It uses these MT names from the other files at run time, through MT:
//   common.js: addNodeField, debug, events, linkObject, nodeConflicts,
//     parseDate, progress, progressDone, runWorker, settings, time
//   loading.js: align, reportDateColumns
//   ui.js: enableSearch, fillSelect, hideModal
//   views.js: launchView, loadLayout, updateAllViewNeeds
// It reads the session and temp (and the layout) from env, which is self on the page and a
// fake in tests; the browser and library globals (document, Worker, d3, ...) it reads bare.
// The body of the installer is not indented, so that the diff of the change that wrapped it
// stays small.
import { db } from './db.js';
import { MTDates } from './dates.js';
import { MTGraph } from './graph.js';

export function installLinksClusters(MT, env) {

MT.computeConsensus = nodes => {
  if (!nodes) nodes = env.session.data.nodes.filter(d => d.seq);
  return MT.runWorker("workers/compute-consensus.js", nodes, { name: "The consensus computation" }).then(response => {
    MT.time('Consensus Transit', response.start);
    return response.consensus;
  });
};

// The index of a provisional reference among seqs (strings): their medoid by
// k-mer distance, which needs no alignment (#317). -1 if none is usable.
MT.pickReference = (seqs, options = {}) => {
  return MT.runWorker("workers/pick-reference.js", { seqs, ...options }, { name: "Choosing a reference" }).then(response => response.index);
};

// Fewer sequences than this make too noisy a vote; their medoid is used instead
MT.minConsensusSequences = 12;

// A reference built from the sequences themselves (#317). A column-wise vote
// over raw sequences means nothing (offsets and indels shift the columns),
// so they are first aligned to a provisional reference, their k-mer medoid,
// and the vote is taken in its coordinates. Sites where most sequences have
// a gap are dropped. nodes are {seq}; scoring is the aligner's scores.
MT.consensusReference = async (nodes, scoring) => {
  const seqs = nodes.map(d => d.seq || "");
  const index = await MT.pickReference(seqs);
  if (index < 0) return "";
  const medoid = seqs[index].toUpperCase().replace(/[-\s]/g, "");
  const usable = seqs.filter(s => /[^-\s]/.test(s));
  if (usable.length < MT.minConsensusSequences) return medoid;
  // Copies, so the caller's nodes keep no trace of this alignment
  const aligned = await MT.align({ nodes: usable.map(seq => ({ seq })), reference: medoid, ...scoring });
  // A sequence the aligner could place nowhere would vote gap at every site
  const placed = aligned.filter(d => /[^-]/.test(d._seq)).map(d => ({ seq: d._seq }));
  if (!placed.length) return medoid;
  const consensus = await MT.computeConsensus(placed);
  return consensus.replace(/-/g, "");
};

MT.computeAmbiguityCounts = () => {
  return new Promise((resolve, reject) => {
    let nodes = env.session.data.nodes;
    let subset = nodes.filter(d => d.seq);
    const subsetLength = subset.length;
    MT.runWorker("workers/compute-ambiguity-counts.js", subset.map(d => d.seq), { name: "The ambiguity count" }).then(response => {
      MT.time('Ambiguity Count Transit', response.start);
      let start = Date.now();
      const dists = new Float32Array(response.counts);
      for (let j = 0; j < subsetLength; j++) {
        nodes[subset[j].index]._ambiguity = dists[j];
      }
      MT.addNodeField('_ambiguity');
      MT.time('Ambiguity Count Merge', start);
      resolve();
    }).catch(reject);
  });
};

MT.computeConsensusDistances = () => {
  return new Promise((resolve, reject) => {
    let start = Date.now();
    let nodes = env.session.data.nodes;
    let nodesLength = nodes.length;
    let subset = [];
    for (let i = 0; i < nodesLength; i++) {
      let node = nodes[i];
      if (node.seq) {
        subset.push({
          index: i,
          seq: node.seq
        });
      } else {
        subset.push({
          index: i,
          seq: ""
        });
      }
    }
    let subsetLength = subset.length;
    MT.runWorker("workers/compute-consensus-distances.js", {
      consensus: env.session.data.consensus,
      subset: subset,
      start: start
    }, { name: "The consensus distance computation" }).then(response => {
      let dists = new Uint32Array(response.dists);
      MT.time('Consensus Difference Transit', response.start);
      start = Date.now();
      for (let j = 0; j < subsetLength; j++) {
        nodes[subset[j].index]._diff = dists[j];
      }
      MT.addNodeField('_diff');
      MT.time('Consensus Difference Merge', start);
      resolve();
    }).catch(reject);
  });
};

// Distance metrics computed by bx-distance-models (workers/compute-links.js).
// count: the metric counts sites rather than measuring a proportion, which sets
// the default link threshold.
MT.distanceMetrics = {
  tn93: { label: 'TN93', threshold: 0.015 },
  snps: { label: 'SNPs', threshold: 16, count: true },
  hamming: { label: 'Hamming', threshold: 0.015 },
  p_distance: { label: 'P-Distance', threshold: 0.015 },
  jc69: { label: 'JC69', threshold: 0.015 },
  k2p: { label: 'K2P', threshold: 0.015 },
  tn92: { label: 'TN92', threshold: 0.015 },
  transitions: { label: 'Transitions', threshold: 16, count: true },
  transversions: { label: 'Transversions', threshold: 16, count: true },
  ts_tv_ratio: { label: 'Ts/Tv Ratio', threshold: 2 }
};

// What a distance metric measures, in plain words, and the unit its link
// threshold is in (shown under the metric and threshold controls, #272)
MT.metricHelp = {
  tn93: ['Substitutions per site, correcting for multiple hits and unequal base frequencies. The usual choice for HIV.', 'substitutions per site (0.015 = 1.5%)'],
  tn92: ['Like TN93 but assuming equal base frequencies.', 'substitutions per site (0.015 = 1.5%)'],
  k2p: ['Substitutions per site, with transitions and transversions counted separately.', 'substitutions per site (0.015 = 1.5%)'],
  jc69: ['Substitutions per site, assuming every change is equally likely.', 'substitutions per site (0.015 = 1.5%)'],
  snps: ['The number of sites that differ.', 'differing sites (a count)'],
  hamming: ['The fraction of sites that differ.', 'fraction of sites that differ (0.015 = 1.5%)'],
  p_distance: ['The fraction of compared sites that differ.', 'fraction of sites that differ (0.015 = 1.5%)'],
  transitions: ['The number of purine-purine or pyrimidine-pyrimidine changes (A/G, C/T).', 'transition sites (a count)'],
  transversions: ['The number of purine-pyrimidine changes.', 'transversion sites (a count)'],
  ts_tv_ratio: ['Transitions divided by transversions. A diagnostic, not a distance.', 'a ratio']
};

// The step of a threshold for a metric's values
MT.thresholdStep = metric => metric.count ? 1 : metric.threshold < 1 ? 0.001 : 0.1;

// Above this many pairs, 'auto' link storage keeps only the links within the
// link threshold. Below it, every pair's distance is kept in the graph's
// distance triangle (4 bytes per pair: 200 MB for 10,000 sequences).
MT.maxDenseLinks = 5e7;

// parts + 1 row boundaries splitting the upper triangle of an n x n matrix into
// runs of rows with nearly equal numbers of pairs.
MT.rowSplits = (n, parts) => {
  const total = n * (n - 1) / 2;
  let splits = [0], pairs = 0, row = 0;
  for (let p = 1; p < parts; p++) {
    while (row < n && pairs < total * p / parts) pairs += n - 1 - row++;
    splits.push(row);
  }
  splits.push(n);
  return splits;
};

// The metrics computed from the sequences: the distance metric first, then
// any others chosen to compute too
MT.computedMetrics = (widgets = env.session.style.widgets) => {
  const metric = widgets['default-distance-metric'];
  const also = (widgets['distance-metrics-also'] || []).filter(m => m !== metric && MT.distanceMetrics[m]);
  return [metric, ...new Set(also)];
};

// The metric a link field holds, if it holds a computed one. Each is kept
// under its own name (tn93, snps…); sessions from before this kept the
// distance metric's as distance, which they filter on.
MT.fieldMetric = field => MT.distanceMetrics[field] ? field : null;

// The threshold the stored links of a field were limited to, if a threshold
// above it would show fewer links than the data has (sparse storage), else null.
MT.storedThresholdBelow = (field, threshold) => {
  const stored = (env.session.style.widgets['link-stored-thresholds'] || {})[field];
  return stored != null && parseFloat(threshold) > stored ? stored : null;
};

MT.computeLinks = async subset => {
  const widgets = env.session.style.widgets;
  const metrics = MT.computedMetrics(widgets), metric = metrics[0];
  const strategy = (widgets['ambiguity-resolution-strategy'] || 'SKIP').toUpperCase();
  // HIV-TRACE -g (tn93 -a resolve -g F) decides pair by pair, in the worker:
  // a pair is averaged when the sites resolution touched are at least F of its
  // compared sites, and resolved otherwise.
  const order = subset;

  const n = order.length;
  const pairs = n * (n - 1) / 2;
  const storage = widgets['link-storage'];
  // Each metric kept takes its own 4 bytes a pair
  const sparse = storage === 'threshold' || (storage !== 'all' && pairs * metrics.length > MT.maxDenseLinks);
  // Kept within the link threshold for the distance metric, and within their
  // own default thresholds for the others
  const thresholds = sparse ? metrics.map((m, i) => i === 0 ? parseFloat(widgets['link-threshold']) : MT.distanceMetrics[m].threshold) : null;
  if (sparse) MT.debug(`Keeping only links with ${metrics.map((m, i) => `${m} <= ${thresholds[i]}`).join(', ')} (${pairs.toLocaleString()} pairs)`);

  // Where only links within a threshold are kept, remember it (#228)
  const stored = Object.assign({}, widgets['link-stored-thresholds']);
  metrics.forEach((m, i) => { if (sparse) stored[m] = thresholds[i]; else delete stored[m]; });
  MT.settings.set('link-stored-thresholds', stored);

  const seqs = order.map(d => d.seq);
  const cores = Math.min(navigator.hardwareConcurrency || 4, 8);
  const workers = Math.max(1, Math.min(cores, Math.ceil(pairs / 1e5)));
  const splits = MT.rowSplits(n, workers);
  const message = {
    seqs,
    metric,
    metrics,
    mode: strategy === 'HIVTRACE-G' ? 'hivtrace-g' : strategy.toLowerCase(),
    fraction: parseFloat(widgets['ambiguity-threshold']),
    threshold: thresholds && thresholds[0],
    thresholds
  };
  // Each worker's results, a part per metric
  // Progress is the share of the distance workers done: a worker counts as
  // done when it replies
  const done = splits.slice(1).map(() => 0);
  const report = () => MT.progress('Computing distances', done.reduce((a, b) => a + b, 0), done.length);
  report();
  const parts = await Promise.all(splits.slice(1).map((rowEnd, w) => new Promise((resolve, reject) => {
    MT.runWorker('workers/compute-links.js',
      Object.assign({ rowStart: splits[w], rowEnd }, message), { name: "The distance computation" })
      .then(data => { done[w] = 1; report(); resolve(data); }, reject);
  })));

  MT.time('Links Transit', Math.min(...parts.map(p => p.start)));
  let start = Date.now();
  const g = env.session.data.graph;
  const before = g.edgeCount;
  metrics.forEach((m, i) => {
    const field = m;
    MT.session.addLinkField(field);
    if (sparse) {
      parts.forEach(({ results }) => {
        const { source, target, distance } = results[i];
        const k = distance.length;
        for (let l = 0; l < k; l++) {
          g.addLink({
            source: order[target[l]]._id,
            target: order[source[l]]._id,
            [field]: distance[l],
            origin: ['Genetic Distance']
          });
        }
      });
    } else {
      // The parts are consecutive runs of the upper triangle, in order.
      const tri = new Float32Array(pairs);
      let offset = 0;
      parts.forEach(({ results }) => {
        tri.set(results[i].distances, offset);
        offset += results[i].distances.length;
      });
      g.setDistances(order.map(d => d._id), tri, field, 'Genetic Distance');
    }
  });
  MT.time('Links Merge', start);
  return g.edgeCount - before;
};

// Distances between every pair of nodes, for the given link field, as a
// condensed upper triangle (NaN where there's no link) over labels.
MT.getCondensedDM = (metric, labels) => {
  const g = env.session.data.graph;
  metric = metric || env.session.style.widgets['link-sort-variable'];
  labels = labels || MT.getDMLabels();
  const n = labels.length;
  const pos = new Int32Array(g.nodeCount).fill(-1);
  labels.forEach((id, i) => {
    const x = g.index.get(id);
    if (x !== undefined) pos[x] = i;
  });
  const tri = new Float64Array(n * (n - 1) / 2).fill(NaN);
  g.forEachValue(metric, (v, e, s, t) => {
    let i = pos[s], j = pos[t];
    if (typeof v !== 'number') v = parseFloat(v); // XLSX link files give strings
    if (i < 0 || j < 0 || isNaN(v)) return;
    if (i > j) [i, j] = [j, i];
    tri[MTGraph.pairIndex(i, j, n)] = v;
  });
  return { labels, tri };
};

// The row order of MT.getDM (every node, in session order).
MT.getDMLabels = () => env.session.data.nodes.map(d => d._id);

// The most nodes MT.getDM builds a matrix for by default: a Float64Array of
// n * n is 200 MB at 5,000 nodes, and 800 MB at 10,000 (#248).
MT.DM_MAX_NODES = 5000;

// Why the distance matrix of the current nodes can't be built, or null if it can
MT.dmTooLargeMessage = (maxNodes = MT.DM_MAX_NODES) => {
  const n = env.session.data.nodes.length;
  if (n <= maxNodes) return null;
  return 'The distance matrix of ' + n.toLocaleString() + ' nodes (' + (n * n / 1e6).toLocaleString(undefined, { maximumFractionDigits: 0 }) +
    ' million cells) is too large to build; the limit is ' + maxNodes.toLocaleString() + ' nodes. Filter the data to fewer nodes to use it.';
};

// The distance matrix computed last, kept while the graph, the metric and the
// nodes are as they were, so restyling a view doesn't compute it again.
let dmCache = null;

// The full distance matrix for the link sort variable, in the order of
// MT.getDMLabels(): a Float64Array of n * n, row by row, NaN where there's no
// link, 0 on the diagonal. It is shared (don't change it; copy it to hand it to
// a worker). Rejects, saying why, when there are more than maxNodes nodes.
// The matrix is filled in a worker (workers/expand-dm.js), so it can be
// cancelled and reports its progress; options are as MT.runWorker's scope and
// onProgress.
MT.getDM = (maxNodes = MT.DM_MAX_NODES, { scope, onProgress } = {}) => {
  return Promise.resolve().then(() => {
    const tooLarge = MT.dmTooLargeMessage(maxNodes);
    if (tooLarge) throw new Error(tooLarge);
    const g = env.session.data.graph, nodes = env.session.data.nodes;
    const n = nodes.length, metric = env.session.style.widgets['link-sort-variable'];
    const c = dmCache;
    if (c && c.graph === g && c.version === g.version && c.metric === metric && c.nodes === nodes && c.n === n) return c.dm;
    const start = Date.now(), version = g.version;
    const { tri } = MT.getCondensedDM(metric, MT.getDMLabels());
    return MT.runWorker("workers/expand-dm.js", { n, tri }, { transfer: [tri.buffer], name: "The distance matrix", scope, onProgress }).then(response => {
      const dm = response.dm;
      dmCache = { graph: g, version, metric, nodes, n, dm };
      MT.time('DM Compute', start);
      return dm;
    });
  });
};

// The tree from the distance matrix, in a worker (its options are as MT.getDM's)
MT.computeTree = ({ scope, onProgress } = {}) => {
  // Every way out settles the promise, as MT.runHamsters waits on it:
  // parsing a tree too deep for patristic throws here, on the main thread (#250)
  return MT.getDM(undefined, { scope, onProgress }).then(dm => {
    const matrix = dm.slice(); // the worker takes this copy; the cached one stays
    return MT.runWorker("workers/compute-tree.js", {
      labels: MT.getDMLabels(),
      matrix,
      round: env.session.style.widgets["tree-round"]
    }, { transfer: [matrix.buffer], name: "The tree computation", scope });
  }).then(async response => {
    // patristic comes with the tree bundle, which the tree view loads too (#324)
    await MT.loadLibrary("tree");
    env.temp.tree = patristic.parseJSON(response.tree);
    MT.time('Tree Transit', response.start);
  });
};

MT.computeDirectionality = () => {
  return new Promise((resolve, reject) => {
    // Directions are inferred from the tree (see MT.runHamsters).
    if (!env.temp.tree) return resolve();
    const g = env.session.data.graph;
    const ids = new Uint32Array(g.edgeCount), sources = [], targets = [];
    let x = 0;
    g.forEachEdge((e, s, t) => {
      ids[x++] = e;
      sources.push(g.ids[s]);
      targets.push(g.ids[t]);
    });
    MT.runWorker("workers/compute-directionality.js", {
      sources: sources,
      targets: targets,
      tree: env.temp.tree
    }, { name: "The directionality computation" }).then(response => {
      let flips = new Uint8Array(response.output);
      MT.time('Directionality Transit', response.start);
      let start = Date.now();
      let n = flips.length;
      try {
        for (let i = 0; i < n; i++) {
          if (flips[i]) {
            const e = g.flip(ids[i]);
            if (e >= 0) g.setFlag(e, MTGraph.DIRECTED, true);
          }
        }
      } finally {
        g.version++;
      }
      MT.time('Directionality Integration', start);
      resolve();
    }).catch(reject); // (a worker that throws, say on a tree too deep for patristic, rejects)
  });
};

// Runs a worker that takes the condensed distance matrix for the link sort
// variable and returns pairs of node positions, and flags those links as
// nearest neighbors.
// The metric is the link sort variable (the field the threshold filters on)
// unless one is given.
MT.computeNNFlags = (script, name, metric) => {
  return new Promise((resolve, reject) => {
    const g = env.session.data.graph;
    metric = metric || env.session.style.widgets['link-sort-variable'];
    const labels = g.ids.slice();
    const { tri } = MT.getCondensedDM(metric, labels);
    MT.runWorker(script, {
      n: labels.length,
      matrix: tri,
      epsilon: env.session.style.widgets["filtering-epsilon"]
    }, { transfer: [tri.buffer], name }).then(response => {
      let pairs = new Uint32Array(response.pairs);
      MT.time(name + ' Transit', response.start);
      const start = Date.now();
      g.clearFlag(MTGraph.NN);
      for (let i = 0; i < pairs.length; i += 2) {
        const e = g.edgeBetween(pairs[i], pairs[i + 1]);
        if (e >= 0) g.setFlag(e, MTGraph.NN, true);
      }
      g.version++;
      MT.time(name + ' Merge', start);
      resolve();
    }).catch(reject);
  });
};

// The two ways of pruning links (the link-prune setting, #236):
// "mst" keeps the minimum spanning tree plus near-ties (workers/compute-mst.js),
// which keeps every cluster connected; "nn" keeps each node's links to its own
// nearest neighbours plus near-ties (workers/compute-nn.js), which can split a
// cluster. Both flag the links they keep with MTGraph.NN.
MT.computeMST = metric => MT.computeNNFlags("workers/compute-mst.js", "MST", metric);

MT.computeNN = metric => MT.computeNNFlags("workers/compute-nn.js", "NN", metric);

// Flags the links the link-prune setting keeps (nothing to do for "none")
MT.computePruning = () => {
  const prune = env.session.style.widgets["link-prune"];
  if (prune === "nn") return MT.computeNN();
  if (prune === "mst") return MT.computeMST();
  return Promise.resolve();
};

// Directions are inferred from the tree, so with that on, the tree is built
// first (unless there is one already, from a Newick file) and the links are
// flipped before finishUp freezes the graph and the views draw it. The tree
// isn't built otherwise: building it on every load overflowed patristic's
// stack on large datasets (#250), and only the tree view needs it then, which
// builds it when opened (and reuses the one built here).
MT.runHamsters = async () => {
  // MT.computeMST();
  if (!env.session.style.widgets['infer-directionality-false']) {
    try {
      if (!env.temp.tree) await MT.computeTree();
      await MT.computeDirectionality();
    } catch (error) {
      console.error(error);
      MT.toast.warning("Couldn't infer the links' directions; they are shown as loaded.", 10);
    }
  }
  return MT.finishUp();
};

MT.finishUp = async (oldSession) => { 
  clearTimeout(env.temp.messageTimeout);
  // Where the files just read disagree, say so, and offer to show where
  if (!oldSession) {
    const differ = Array.from(MT.nodeConflicts().values()).reduce((n, ids) => n + ids.length, 0);
    if (differ) MT.toast.warning(`${differ.toLocaleString()} node value${differ === 1 ? '' : 's'} differ between files. Click to review them.`, 15,
      clicked => { if (clicked) MT.launchView("conflicts"); }, { action: "Review" });
    MT.reportDateColumns(env.session.data.nodes, env.session.data.nodeFields);
  }
  // Links are done loading: swap the graph's pair lookup for its compact index.
  // (Link objects get null for missing link fields as they're built.)
  env.session.data.graph.freeze();
  let nodeFields = env.session.data.nodeFields;
  env.session.data.nodes.forEach(d => {
    nodeFields.forEach(field => {
      if (!(field in d)) d[field] = null;
    });
  });
  
  // The global menus of node and link variables
  const fill = (id, fields, none = false) => {
    const select = document.getElementById(id);
    MT.fillSelect(select, fields, { none });
    select.value = env.session.style.widgets[id];
  };
  fill("search-field", env.session.data.nodeFields);
  MT.enableSearch(true);
  fill("link-sort-variable", env.session.data.linkFields);
  fill("node-color-variable", env.session.data.nodeFields, true);
  fill("node-timeline-variable", env.session.data.nodeFields, true);
  fill("link-color-variable", env.session.data.linkFields, true);
  try {
    MT.updateThresholdHistogram();
  } catch (error) {
    console.error(error);
    MT.hideModal("loading-information-modal");
    MT.toast.error("Something went wrong! A new session will start in 5 seconds.");
    setTimeout(() => MT.reload(), 5000); // the 5 seconds the message above names
  }
  MT.setLinkVisibility(true);
  env.session.meta.loadTime = Date.now() - env.session.meta.startTime;
  MT.debug("Total load time:", env.session.meta.loadTime.toLocaleString(), "ms");
  if (oldSession) {
    MT.loadLayout(env.session.layout);
  } else {
    MT.launchView(env.session.style.widgets['default-view']);
  }
  MT.tagClusters().then(() => {
    MT.setClusterVisibility(true);
    MT.setLinkVisibility(true);
    MT.setNodeVisibility(true);
    ["cluster", "link", "node"].forEach(thing => MT.events.emit(thing + "-visibility"));
    MT.showStatistics();
    MT.events.emit("session-loaded");
    MT.updateAllViewNeeds();
  });
  db.getItem("stash-auto").then(autostash => {
    if (autostash !== "true") return;
    if (env.temp.autostash) clearInterval(env.temp.autostash.interval);
    // The new copy is written first, and the previous one removed only once
    // it has committed, so a failed write (the quota, say) keeps the old copy.
    // The user is told the first time it fails, not every minute.
    const state = env.temp.autostash = { time: Date.now(), key: null, warned: false, busy: false };
    // (Each minute's copy; tests call it directly)
    state.tick = async () => {
      if (state.busy) return;
      state.busy = true;
      try {
        const newKey = "stash-" + Date.now() + "-autostash";
        MT.syncLayout();
        const text = JSON.stringify(env.session);
        // Nothing has changed since the last copy: it stays, and isn't written again
        if (state.key && text === state.text) {
          state.time = Date.now();
          return;
        }
        await db.setItem(newKey, text);
        state.text = text;
        const oldKey = state.key;
        state.key = newKey;
        state.time = Date.now();
        state.warned = false;
        if (oldKey) await db.removeItem(oldKey).catch(error => console.warn("Couldn't remove the previous autostash:", error));
      } catch (error) {
        console.error("Autostash failed:", error);
        if (!state.warned) {
          state.warned = true;
          MT.toast.error("Autostash couldn't save your session, so the last copy was kept. " + MT.escape(db.describeError(error)), 15);
        }
      } finally {
        state.busy = false;
      }
    };
    state.interval = setInterval(state.tick, 60000);
  });
  document.querySelectorAll(".hideForHIVTrace").forEach(el => el.style.display = "flex");
  setTimeout(() => {
    let files = env.layout.contentItems.find(item => item.componentType === "files");
    if (files) files.remove();
    MT.progressDone();
    MT.hideModal("loading-information-modal");
  }, 1200);
};

// A component of one node is a singleton, not a cluster: the statistics count
// a cluster as having more than one node (visible ones, when filtered by date).
MT.isCluster = nodeCount => nodeCount > 1;

// Clusters are the connected components of the visible links.
MT.tagClusters = () => {
  return new Promise(resolve => {
    let start = Date.now();
    const clusters = [];
    const nodes = env.session.data.nodes;
    const g = env.session.data.graph;
    const lsv = env.session.style.widgets["link-sort-variable"];
    const nodeIndex = nodes.map(d => g.node(d._id));
    const component = g.components();

    // Number clusters in node order, as MicrobeTrace always has
    const clusterOf = new Int32Array(component.length).fill(-1);
    const nodeCluster = new Int32Array(g.nodeCount).fill(-1);
    nodeIndex.forEach(x => {
      const c = component[x];
      if (clusterOf[c] < 0) {
        clusterOf[c] = clusters.length;
        clusters.push({
          id: clusters.length,
          nodes: 0,
          links: 0,
          sum_distances: 0,
          links_per_node: 0,
          mean_genetic_distance: undefined,
          visible: true
        });
      }
    });
    for (let x = 0; x < g.nodeCount; x++) {
      nodeCluster[x] = clusterOf[component[x]];
      if (nodeCluster[x] >= 0) clusters[nodeCluster[x]].nodes++;
    }
    MT.session.setClusters(clusters);
    // (The same clusters as before keep the same array, and what was built
    // from it stays good)
    const before = g.nodeCluster;
    if (!before || before.length !== nodeCluster.length || nodeCluster.some((c, x) => c !== before[x])) g.nodeCluster = nodeCluster;

    const degree = new Uint32Array(g.nodeCount);
    for (let x = 0; x < g.visibleCount; x++) {
      const e = g.visible[x], s = g.source(e), t = g.target(e);
      degree[s]++;
      degree[t]++;
      const cluster = clusters[nodeCluster[s]];
      if (!cluster) continue;
      cluster.links++;
      const v = parseFloat(g.getValue(e, lsv));
      if (!isNaN(v)) cluster.sum_distances += v;
    }
    nodes.forEach((d, i) => {
      d.cluster = nodeCluster[nodeIndex[i]];
      d.degree = degree[nodeIndex[i]];
    });
    clusters.forEach(c => {
      c.links_per_node = c.links / c.nodes;
      c.mean_genetic_distance = c.sum_distances / c.links;
    });
    MT.time('Cluster Tagging', start);
    resolve();
  });
};

// The dates of the nodes' field as times (NaN for the undated), read once
// and again only when a value, the nodes or the field change (stepping the
// timeline asks for them at each step). The order of a date like 3/4/2020
// is that of all the field's values (see MTDates.dateOrderOf).
MT.nodeTimes = field => {
  const nodes = env.session.data.nodes, n = nodes.length;
  const cache = env.temp.nodeTimes;
  if (cache && cache.field === field && cache.raw.length === n) {
    let i = 0;
    while (i < n && nodes[i][field] === cache.raw[i]) i++;
    if (i === n) return cache.times;
  }
  const raw = nodes.map(d => d[field]);
  const order = MTDates.dateOrderOf(raw).order;
  const times = new Float64Array(n);
  raw.forEach((value, i) => {
    const date = MTDates.parseDate(value, order);
    times[i] = date ? +date : NaN;
  });
  env.temp.nodeTimes = { field, raw, times };
  return times;
};

MT.setNodeVisibility = silent => { 
  let start = Date.now();
  let dateField = env.session.style.widgets["timeline-date-field"];
  let nodes = env.session.data.nodes,
    clusters = env.session.data.clusters;
  let n = nodes.length;
  let timeEnd = dateField !== "None" && MT.parseDate(env.session.state.timeEnd);
  const times = timeEnd ? MT.nodeTimes(dateField) : null;
  const until = timeEnd ? +timeEnd : 0;
  for (let i = 0; i < n; i++) {
    let node = nodes[i];
    node.visible = true;
    let cluster = clusters[node.cluster];
    if (cluster) {
      node.visible = node.visible && cluster.visible; 
    }
    // Nodes after the epi curve's brushed range are hidden; undated ones stay
    if (timeEnd) node.visible = node.visible && !(times[i] > until);
  }
  if (!silent) MT.events.emit("node-visibility");
  MT.time('Node Visibility Setting', start);
};

MT.setLinkVisibility = silent => { 
  let start = Date.now();
  let metric = env.session.style.widgets["link-sort-variable"],
    threshold = parseFloat(env.session.style.widgets["link-threshold"]),
    showNN = env.session.style.widgets["link-prune"] !== "none";
  const g = env.session.data.graph;
  const clusters = env.session.data.clusters;
  const nodeCluster = g.nodeCluster;
  const keep = nodeCluster && clusters.length ? s => {
    const cluster = clusters[nodeCluster[s]];
    return !cluster || cluster.visible;
  } : () => true;
  g.computeVisible(metric, threshold, showNN, keep);
  if (!silent) MT.events.emit("link-visibility");
  MT.time('Link Visibility Setting', start);
};

MT.setClusterVisibility = silent => { 
  let start = Date.now();
  let min = env.session.style.widgets["cluster-minimum-size"];
  let clusters = env.session.data.clusters;
  let n = clusters.length;
  for (let i = 0; i < n; i++) {
    let cluster = clusters[i];
    cluster.visible = cluster.nodes >= min;
  }
  if (!silent) MT.events.emit("cluster-visibility");
  MT.time('Cluster Visibility Setting', start);
};

// Copies the network's layout from the GPU into session.network.nodes, for
// what reads it there (saving, the timeline). The network does this itself
// only when its layout settles: reading it back waits for the GPU.
MT.syncLayout = () => {
  if (env.temp.network && env.temp.network.syncPositions) env.temp.network.syncPositions();
};

MT.getNetworkNodes = () => {
  MT.syncLayout();
  // Their own fields, not the values those hold: the places and pins are
  // kept in the copies, and nothing changes what's inside a node
  return env.session.network.nodes.map(node => Object.assign({}, node));
};

MT.updatePinNodes = copy => {
  MT.syncLayout();
  let nodes = env.session.network.nodes;
  let n = nodes.length;
  for (let i = 0; i < n; i++) {
    let node = nodes[i]; 
    if (copy && node.fixed) node.preFixed = true;
    if (!copy && env.session.network.timelineNodes[i].preFixed) {
      node.fixed = true;
      node.fx = node.x;
      node.fy = node.y;
    }
  }
};

// The visible nodes, or copies of them to place (their own fields, not the
// values those hold: a copy through JSON took a second for a few thousand
// nodes, most of it their sequences)
MT.getVisibleNodes = copy => {
  let nodes = env.session.data.nodes;
  let n = nodes.length;
  let out = [];
  if (copy) {
    for (let i = 0; i < n; i++) {
      let node = nodes[i];
      if (node.visible) {
        out.push(Object.assign({}, node));
      }
    }
  } else {
    for (let i = 0; i < n; i++) {
      let node = nodes[i];
      if (node.visible) {
        out.push(node);
      }
    }
  }
  return out;
};

// Link objects for the visible links, built again only when what they hold
// changes: the visible links (a link in both lists keeps its object), their
// data or their clusters. They're shared by every caller, which must not
// change them (nor their origin lists); with copy they're copies of their
// own fields, to place or to change.
MT.getVisibleLinks = copy => {
  const g = env.session.data.graph;
  const fields = env.session.data.linkFields.length;
  let cache = env.temp.visibleLinks;
  // (The data of the links is the same: what's changed is which are visible, or their clusters)
  const kept = cache && cache.graph === g && cache.version === g.version && cache.fields === fields;
  if (!kept || cache.visibleVersion !== g.visibleVersion || cache.nodeCluster !== g.nodeCluster) {
    const old = kept ? new Map(Array.from(cache.edges, (e, x) => [e, cache.links[x]])) : null;
    const links = new Array(g.visibleCount);
    for (let x = 0; x < g.visibleCount; x++) {
      const e = g.visible[x];
      const link = old && old.get(e);
      links[x] = link && link.cluster === (g.nodeCluster ? g.nodeCluster[g.source(e)] : 1) ? link : MT.linkObject(e, true, undefined, true);
    }
    cache = env.temp.visibleLinks = { graph: g, version: g.version, nodeCluster: g.nodeCluster, fields, visibleVersion: g.visibleVersion, edges: g.visible.slice(0, g.visibleCount), links };
  }
  if (copy) return cache.links.map(link => Object.assign({}, link, { origin: link.origin.slice() }));
  return cache.links.slice();
};

MT.updateStatistics = () => {
  if (!env.session.style.widgets["network-statistics-show"]) return;
  let vnodes = MT.getVisibleNodes();
  const g = env.session.data.graph;
  let linkCount = 0;
  let clusterCount = 0;
  if (env.session.style.widgets["timeline-date-field"]=== 'None') {
    linkCount = g.visibleCount;
    clusterCount = env.session.data.clusters.filter(cluster => cluster.visible && MT.isCluster(cluster.nodes)).length;
  } else {
    // (Looked up by ID, as the links name nodes by their ID)
    const visibleIds = new Set();
    vnodes.forEach(d => { visibleIds.add('' + d._id); if (d.id != null) visibleIds.add('' + d.id); });
    // (From the graph, with no link object made for each)
    for (let x = 0; x < g.visibleCount; x++) {
      const e = g.visible[x];
      if (visibleIds.has('' + g.ids[g.source(e)]) && visibleIds.has('' + g.ids[g.target(e)])) linkCount++;
    }

    const sizes = new Map();
    vnodes.forEach(d => sizes.set(d.cluster, (sizes.get(d.cluster) || 0) + 1));
    clusterCount = env.session.data.clusters.filter(cluster => cluster.visible && MT.isCluster(sizes.get(cluster.id))).length;
  }
  let singletons = vnodes.filter(d => d.degree === 0).length;
  const show = (id, n) => { document.getElementById(id).textContent = n.toLocaleString(); };
  show("numberOfSelectedNodes", vnodes.filter(d => d.selected).length);
  show("numberOfNodes", vnodes.length);
  show("numberOfVisibleLinks", linkCount);
  show("numberOfSingletonNodes", singletons);
  show("numberOfDisjointComponents", clusterCount); // #187
};
}
