(function(self){
  'use strict';

  let MT = {};
  
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
    reference:
      "CCTCAGGTCACTCTTTGGCAACGACCCCTCGTCACAATAAAGATAGGGGGGCAACTAAAGGAAGCTCTATTAGATACAGGAGCAGATGATACAGTATTAGAAGAAATGAGTTTGCCAGGAAGATGGAAACCAAAAATGATAGGGGGAATTGGAGGTTTTATCAAAGTAAGACAGTATGATCAGATACTCATAGAAATCTGTGGACATAAAGCTATAGGTACAGTATTAGTAGGACCTACACCTGTCAACATAATTGGAAGAAATCTGTTGACTCAGATTGGTTGCACTTTAAATTTTCCCATTAGCCCTATTGAGACTGTACCAGTAAAATTAAAGCCAGGAATGGATGGCCCAAAAGTTAAACAATGGCCATTGACAGAAGAAAAAATAAAAGCATTAGTAGAAATTTGTACAGAGATGGAAAAGGAAGGGAAAATTTCAAAAATTGGGCCTGAAAATCCATACAATACTCCAGTATTTGCCATAAAGAAAAAAGACAGTACTAAATGGAGAAAATTAGTAGATTTCAGAGAACTTAATAAGAGAACTCAAGACTTCTGGGAAGTTCAATTAGGAATACCACATCCCGCAGGGTTAAAAAAGAAAAAATCAGTAACAGTACTGGATGTGGGTGATGCATATTTTTCAGTTCCCTTAGATGAAGACTTCAGGAAGTATACTGCATTTACCATACCTAGTATAAACAATGAGACACCAGGGATTAGATATCAGTACAATGTGCTTCCACAGGGATGGAAAGGATCACCAGCAATATTCCAAAGTAGCATGACAAAAATCTTAGAGCCTTTTAGAAAACAAAATCCAGACATAGTTATCTATCAATACATGGATGATTTGTATGTAGGATCTGACTTAGAAATAGGGCAGCATAGAACAAAAATAGAGGAGCTGAGACAACATCTGTTGAGGTGGGGACTTACCACACCAGACAAAAAACATCAGAAAGAACCTCCATTCCTTTGGATGGGTTATGAACTCCATCCTGATAAATGGACAGTACAGCCTATAGTGCTGCCAGAAAAAGACAGCTGGACTGTCAATGACATACAGAAGTTAGTGGGGAAATTGAATTGGGCAAGTCAGATTTACCCAGGGATTAAAGTAAGGCAATTATGTAAACTCCTTAGAGGAACCAAAGCACTAACAGAAGTAATACCACTAACAGAAGAAGCAGAGCTAGAACTGGCAGAAAACAGAGAGATTCTAAAAGAACCAGTACATGGAGTGTATTATGACCCATCAAAAGACTTAATAGCAGAAATACAGAAGCAGGGGCAAGGCCAATGGACATATCAAATTTATCAAGAGCCATTTAAAAATCTGAAAACAGGAAAATATGCAAGAATGAGGGGTGCCCACACTAATGATGTAAAACAATTAACAGAGGCAGTGCAAAAAATAACCACAGAAAGCATAGTAATATGGGGAAAGACTCCTAAATTTAAACTGCCCATACAAAAGGAAACATGGGAAACATGGTGGACAGAGTATTGGCAAGCCACCTGGATTCCTGAGTGGGAGTTTGTTAATACCCCTCCCTTAGTGAAATTATGGTACCAGTTAGAGAAAGAACCCATAGTAGGAGCAGAAACCTTC"
  });
  
  MT.defaultWidgets = {
    // Which floating tables and panels are shown
    "link-color-table-show": true,
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
    "reference-source-file": true,
    "reference-source-first": false,
    "reference-source-consensus": false,
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
    "tree-vertical-stretch": 1,
    "triangulate-false": true
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
      linkAlphaMap: () => 1 - session.style.widgets["link-opacity"],
      linkColorMap: () => session.style.widgets["link-color"],
      nodeAlphaMap: () => 1,
      nodeColorMap: () => session.style.widgets["node-color"],
      nodeSymbolMap: () => session.style.widgets["node-symbol"],
      polygonAlphaMap: () => 0.5,
      polygonColorMap: () => session.style.widgets["polygon-color"]
    },
    trees: {}
  });
  
  MT.defaultNode = () => ({
    index: session.data.nodes.length,
    _id: "",
    selected: false,
    cluster: 1,
    visible: true,
    degree: 0,
    origin: []
  });
  
  let isNumber = a => typeof a == "number";
  
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
  
  // Adds a node, or merges it into the node with the same ID. Returns 1 if
  // the node is new. (check is no longer needed: nodes are always merged.)
  //
  // Given the source it came from (session.data.sources), the node's values
  // are recorded there, and where files disagree the top file's win. Without
  // a source (a saved session, an import), its values replace any already set.
  // Lists node fields (once each) so they appear in variable menus and sessions
  MT.addNodeField = (...names) => {
    const fields = session.data.nodeFields;
    names.forEach(name => { if (!fields.includes(name)) fields.push(name); });
  };

  // An ID as the app keeps it: text, without the spaces around it. Every
  // path that loads data goes through this, so one ID from two sources is one
  // node. (Matching stays case-sensitive: "a" and "A" are different IDs.)
  MT.cleanID = id => id == null ? "" : String(id).trim();

  MT.addNode = (newNode, check, source) => {
    if ('id' in newNode && !('_id' in newNode)) newNode._id = newNode.id;
    newNode._id = MT.cleanID(newNode._id);
    if (session.data.nodeExclusions.indexOf(newNode._id) > -1) return 0;
    const index = session.data.nodeIndex;
    let node = index.get(newNode._id);
    if (!source) {
      if (node) {
        // (Imports may give one origin as text)
        newNode.origin = uniq([].concat(newNode.origin || [], node.origin || []));
        Object.assign(node, newNode);
        return 0;
      }
      node = Object.assign(MT.defaultNode(), newNode);
      session.data.nodes.push(node);
      index.set(node._id, node);
      return 1;
    }
    const added = !node;
    if (added) {
      node = Object.assign(MT.defaultNode(), { _id: newNode._id });
      session.data.nodes.push(node);
      index.set(node._id, node);
    }
    node.origin = uniq([].concat(newNode.origin || []).concat(node.origin));
    const values = {};
    for (const field in newNode) if (field != '_id' && field != 'origin') values[field] = newNode[field];
    source.add(node._id, values);
    // Each field takes the best source's value (an empty one, if none has more)
    const sources = session.data.sources;
    for (const field in values) {
      const value = sources.resolve(node._id, field);
      if (value !== undefined) node[field] = value;
      else if (!(field in node)) node[field] = values[field];
    }
    return added ? 1 : 0;
  };

  // Each file's value for a node's field, top file first, marking the one used
  MT.provenance = (id, field) => session.data.sources.provenance('' + id, field);

  // Where files disagree: each field, with the IDs of the nodes they disagree on
  MT.nodeConflicts = () => session.data.sources.conflicts();

  // Gives nodes their fields' chosen values again, and tells the views
  const resolveNodes = (field, keys) => {
    const sources = session.data.sources, index = session.data.nodeIndex;
    keys.forEach(key => {
      const node = index.get(key), value = sources.resolve(key, field);
      if (node && value !== undefined) node[field] = value;
    });
    MT.events.emit("node-values-change", field);
    // (The views redraw, and the color table follows)
    MT.events.emit("node-visibility");
  };

  // Which file's values a field uses where files disagree: a file's name, or
  // null for the top file's
  MT.preferSource = (field, name) => {
    session.data.sources.prefer(field, name);
    resolveNodes(field, session.data.sources.keys(field));
  };

  // Which file's value a node's field uses (or several nodes'): a file's
  // name, or null for the field's choice
  MT.pickSource = (ids, field, name) => {
    const keys = [].concat(ids).map(id => "" + id);
    keys.forEach(key => session.data.sources.pick(key, field, name));
    resolveNodes(field, keys);
  };
  
  // Adds a link, or merges it into the link between the same two nodes (its
  // fields win, origins are combined). Returns 1 if the link is new.
  MT.addLink = newLink => {
    newLink.source = MT.cleanID(newLink.source);
    newLink.target = MT.cleanID(newLink.target);
    return session.data.graph.addLink(newLink);
  };

  // The link between two node IDs, or undefined.
  MT.getLink = (source, target) => {
    const g = session.data.graph;
    const a = g.index.get('' + source), b = g.index.get('' + target);
    if (a === undefined || b === undefined) return;
    const e = g.edgeBetween(a, b);
    if (e >= 0) return MT.linkObject(e);
  };

  // A plain link object for edge e of the graph.
  MT.linkObject = (e, visible, data) => {
    data = data || session.data;
    const g = data.graph;
    const link = g.link(e);
    data.linkFields.forEach(field => {
      if (!(field in link)) link[field] = null;
    });
    link.visible = visible === undefined ? MT.isLinkVisible(e) : visible;
    link.cluster = g.nodeCluster ? g.nodeCluster[g.source(e)] : 1;
    return link;
  };

  MT.isLinkVisible = e => {
    const g = session.data.graph;
    if (!temp.visibleSet || temp.visibleSet.graph !== g || temp.visibleSet.version !== g.visibleVersion) {
      temp.visibleSet = { graph: g, version: g.visibleVersion, set: new Set(g.visible.subarray(0, g.visibleCount)) };
    }
    return temp.visibleSet.set.has(e);
  };

  // The visible links of node id, as { neighbor: ID, link: link object }.
  MT.getVisibleNeighbors = id => {
    const g = session.data.graph, x = g.index.get('' + id);
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
    data = data || session.data;
    const g = data.graph;
    const visible = new Set(g.visible.subarray(0, g.visibleCount));
    const out = [];
    g.forEachEdge(e => out.push(MT.linkObject(e, visible.has(e), data)));
    return out;
  };

  MT.processSVG = svg => {
    const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
    const all = selector => Array.from(doc.querySelectorAll(selector));
    let nodes = [];
    if (doc.querySelector("#edges")) {
      all("#nodes circle").forEach(node => {
        const gephid = node.getAttribute("class");
        nodes.push(gephid);
        MT.addNode(
          {
            id: gephid + "",
            color: node.getAttribute("fill"),
            size: parseFloat(node.getAttribute("r")),
            origin: ["Scraped Gephi SVG"]
          }
        );
      });
      MT.addNodeField("color", "size");
      all("#edges path").forEach(link => {
        const coords = link.getAttribute("class").split(" ");
        let base = {
          source: coords[0] + "",
          target: coords[1] + "",
          color: link.getAttribute("stroke"),
          origin: ["Scraped MicrobeTrace SVG"]
        };
        base[session.style.widgets['default-distance-metric']] = 0;
        MT.addLink(base);
      });
      session.data.linkFields.push("color");
    } else {
      all(".nodes g").forEach((node, i) => {
        nodes.push(node.getAttribute("transform").slice(10, -1).split(",").map(parseFloat));
        MT.addNode({ id: i + "", origin: ["Scraped SVG"] });
      });
      all("line").forEach(link => {
        const at = name => parseFloat(link.getAttribute(name));
        const source = nodes.findIndex(d => Math.abs(d[0] - at("x1")) < 0.0001 && Math.abs(d[1] - at("y1")) < 0.0001);
        const target = nodes.findIndex(d => Math.abs(d[0] - at("x2")) < 0.0001 && Math.abs(d[1] - at("y2")) < 0.0001);
        if (source < 0 || target < 0) return;
        let base = {
          source: source + "",
          target: target + "",
          origin: ["Scraped SVG"]
        };
        base[session.style.widgets['default-distance-metric']] = 0;
        MT.addLink(base);
      });
    }
    MT.runHamsters();
  };
  
  MT.processJSON = (json, extension) => {
    let data;
    try {
      data = JSON.parse(json);
    } catch (error) {
      MT.toast.error(
        "File Not Recognized! Are you certain this is a MicrobeTrace Session or HIV-TRACE Output File?"
      );
      console.error(error);
      return;
    }
    if (extension == "microbetrace") {
      MT.applySession(data);
    } else {
      if (data.version) {
        MT.applyGHOST(data);
      } else {
        MT.applyHIVTrace(data);
      }
    }
  };
  
  // Returns true if the session opened. A file that is not a valid session is
  // refused before anything is reset, so the current session stays as it is.
  MT.applySession = oldSession => {
    //If anything here seems eccentric, assume it's to maintain compatibility with
    //session files from older versions of MicrobeTrace.
    const check = MTSessionFormat.validate(oldSession);
    if (!check.ok) {
      MT.toast.error(check.error);
      console.error(check.error);
      return false;
    }
  
    MT.events.emit("stop-force-simulation"); // stop previous network ticks so previous polygon won't show up

    MT.reset();
    const launch = document.getElementById("launch");
    if (launch) launch.disabled = true;
    session.files = oldSession.files || [];
    session.state = oldSession.state || session.state;
    session.style = Object.assign({},
      session.style,
      oldSession.style
    );
    if (oldSession.layout) session.layout = oldSession.layout;
    session.meta.startTime = Date.now();
    const nodes = oldSession.data.nodes,
          links = oldSession.data.links,
          n = nodes.length,
          m = links.length;
    for(let i = 0; i < n; i++) MT.addNode(nodes[i]);
    for(let j = 0; j < m; j++) MT.addLink(links[j]);
    // Where the nodes' values came from (sessions from before this have none)
    if (oldSession.data.nodeSources) session.data.nodeSources = oldSession.data.nodeSources;
    ['nodeFields', 'linkFields', 'clusterFields', 'nodeExclusions'].forEach(v => {
      if(oldSession.data[v]) session.data[v] = uniq(session.data[v].concat(oldSession.data[v]));
    });
    // Sessions saved before the ID column was the ID alone list it as a field
    // too: leave it out where it only repeats the ID
    session.data.nodeFields = session.data.nodeFields.filter(field => !(/^id$/i.test(field) &&
      session.data.nodes.every(d => d[field] == null || "" + d[field] == d._id)));
    if(oldSession.network) session.network = oldSession.network;
    // Sessions from before distances were kept under their metric's name (#249)
    // kept the distance metric's as distance: they filter on that
    const widgets = session.style.widgets;
    if (!session.data.linkFields.includes(widgets['link-sort-variable']) && session.data.linkFields.includes('distance')) {
      widgets['link-sort-variable'] = 'distance';
    }
    MT.applyStyle(session.style);
    MT.finishUp(true);
    return true;
  };
  
  MT.applyStyle = style => {
    session.style = style;
    // Sessions from before there were two ways to prune (#236) had an on/off
    // link-show-nn, which ran the minimum spanning tree
    const old = style.widgets && style.widgets["link-show-nn"];
    if (old !== undefined) {
      if (style.widgets["link-prune"] === undefined) style.widgets["link-prune"] = (old === true || old === "true") ? "mst" : "none";
      delete style.widgets["link-show-nn"];
    }
    session.style.widgets = Object.assign({},
      MT.defaultWidgets,
      style.widgets
    );
    MT.createLinkColorMap();
    MT.createNodeColorMap();
    MT.createPolygonColorMap();
    MT.settings.reload();
  };
  
  MT.applyHIVTrace = hivtrace => {
    self.session = MT.sessionSkeleton();
    session.meta.startTime = Date.now();
    hivtrace["trace_results"]["Nodes"].forEach(node => {
      let newNode = JSON.parse(JSON.stringify(node.patient_attributes));
      newNode._id = node._id;
      newNode.origin = "HIVTRACE Import";
      MT.addNode(newNode);
    });
    Object.keys(
      hivtrace["trace_results"]["Nodes"][0]["patient_attributes"]
    ).forEach(key => {
      MT.addNodeField(key);
    });
    let n = hivtrace["trace_results"]["Edges"].length;
    let metric = session.style.widgets['default-distance-metric'];
    for (let i = 0; i < n; i++) {
      let link = hivtrace["trace_results"]["Edges"][i];
      let newLink = {
        source: "" + link.sequences[0],
        target: "" + link.sequences[1],
        origin: ["HIVTRACE Import"],
        visible: true
      };
      newLink[metric] = parseFloat(link.length);
      MT.addLink(newLink);
    }
    session.data.linkFields.push(metric);
    MT.runHamsters();
  };
  
  MT.applyGHOST = ghost => {
    self.session = MT.sessionSkeleton();   
    session.meta.startTime = Date.now();
    ghost["samples"].forEach(node => {     
      let newNode = JSON.parse(JSON.stringify(node));     
      newNode.origin = ["GHOST Import"];     
      newNode.genotypes = Object.keys(newNode.genotypes)[0];     
      newNode.id = "" + newNode.id;     
      MT.addNode(newNode);   
    });
    // (A sample's id is its ID, _id, so isn't listed as a field too)
    MT.addNodeField("genotypes", "group", "name");
    let links = ghost["links"];   
    let n = links.length;   
    for (let i = 0; i < n; i++) {     
      let link = links[i];     
      let newLink = Object.assign({}, link, { 
        source: "" + link.source, 
        target: "" + link.target, 
        [session.style.widgets['default-distance-metric']]: parseFloat(link.dist), 
        origin: ["GHOST Import"], visible: true });     
      MT.addLink(newLink);   
    }
    [ session.style.widgets['default-distance-metric'], "density", "dist", "shared", "src_genotype", "src_haps", "tgt_genotype", "tgt_haps" ].forEach( key => { if (!session.data.linkFields.includes(key)) session.data.linkFields.push(key); });
  //	MT.finishUp(); 
    MT.runHamsters();
  }; 
  
  let decoder = new TextDecoder("utf-8");
  MT.decode = x => decoder.decode(x);
  
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
  const running = new Set();
  let cancelled = false;
  const cancelError = () => Object.assign(new Error("it was cancelled"), { cancelled: true });
  MT.startWork = () => { cancelled = false; };
  MT.cancelWork = () => {
    cancelled = true;
    Array.from(running).forEach(cancel => cancel());
  };
  MT.workCancelled = () => cancelled;

  MT.runWorker = (script, message, { transfer, name, worker, onProgress } = {}) => {
    return new Promise((resolve, reject) => {
      if (cancelled) return reject(cancelError());
      const computer = worker || new Worker(script);
      let settled = false;
      const settle = (fn, value) => {
        if (settled) return;
        settled = true;
        running.delete(stop);
        try { computer.terminate(); } catch (e) { /* already gone */ }
        fn(value);
      };
      const what = name || script;
      const fail = reason => settle(reject, reason instanceof Error ? reason : new Error(reason));
      const stop = () => fail(cancelError());
      running.add(stop);
      computer.onmessage = response => {
        const data = response && response.data;
        if (data === "Error") return fail(what + " failed");
        if (data && typeof data == "object" && data.error) return fail(data.error);
        if (data && typeof data == "object" && Object.keys(data).length == 1 && typeof data.progress == "number") {
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
    const known = typeof total == "number" && total > 0;
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

  // A reply's JSON bytes, parsed
  const decodeJSON = bytes => JSON.parse(MT.decode(new Uint8Array(bytes)));

  MT.parseFASTA = text => MT.runWorker("workers/parse-fasta.js", text, { name: "The FASTA parser" }).then(data => {
    console.log("FASTA Transit time: ", (Date.now() - data.start).toLocaleString(), "ms");
    return decodeJSON(data.nodes);
  });

  MT.parseMEGA = text => MT.runWorker("workers/parse-mega.js", text, { name: "The MEGA parser" }).then(data => {
    console.log("MEGA Transit time: ", (Date.now() - data.start).toLocaleString(), "ms");
    return decodeJSON(data.nodes);
  });
  
  // Reads a distance matrix (CSV text in file.contents) into the graph. Rejects
  // with an Error saying why when the file cannot be read as one.
  MT.parseCSVMatrix = (file, source, nodeOrigin) => {
    return new Promise((resolve, reject) => {
      let check = session.files.length > 1;
      const origin = [file.name];
      let nn = 0,
          nl = 0;
      MT.runWorker("workers/parse-csv-matrix.js", file.contents, { name: "The matrix parser" }).then(response => {
        const data = decodeJSON(response.data);
        console.log("CSV Matrix Transit time: ", (Date.now() - response.start).toLocaleString(), "ms");
        const start = Date.now();
        const nodes = data.nodes;
        const tn = nodes.length;
        for (let i = 0; i < tn; i++) {
          nn += MT.addNode({
            _id: nodes[i],
            origin: nodeOrigin || ['Genetic Distance']
          }, check, source);
        }
        const links = data.links;
        const tl = links.length;
        // Distances go under the distance metric, which the threshold filters on (#213)
        const field = session.style.widgets["default-distance-metric"];
        if (!session.data.linkFields.includes(field)) session.data.linkFields.push(field);
        for (let j = 0; j < tl; j++) {
          nl += MT.addLink(MTGraph.distanceLink(Object.assign(links[j], { origin: origin }), field));
        }
        console.log("CSV Matrix Merge time: ", (Date.now() - start).toLocaleString(), "ms");
        resolve({ nn, nl, tn, tl, ids: nodes, unparseable: data.unparseable || 0, example: data.example });
      }).catch(reject);
    })
  };
  
  MT.r01 = Math.random;
  
  // ported from https://github.com/aaboyles/SeqSpawnR/blob/91d5857dbda5998839a002fbecae0f494dca960a/R/SequenceSpawner.R
  MT.generateSeqs = (idPrefix, count, snps, seed) => {
    let start = Date.now();
    if (!count) count = 1000;
    if (!snps) snps = 100;
    if (!seed) seed = session.data.reference;
  
    let sampleCodons = [
      "GCA",
      "GCC",
      "GCG",
      "GCT",
      "AAC",
      "AAT",
      "GAC",
      "GAT",
      "TGC",
      "TGT",
      "GAC",
      "GAT",
      "GAA",
      "GAG",
      "TTC",
      "TTT",
      "GGA",
      "GGC",
      "GGG",
      "GGT",
      "CAC",
      "CAT",
      "ATA",
      "ATC",
      "ATT",
      "AAA",
      "AAG",
      "CTA",
      "CTC",
      "CTG",
      "CTT",
      "TTA",
      "TTG",
      "ATG",
      "AAC",
      "AAT",
      "CCA",
      "CCC",
      "CCG",
      "CCT",
      "CAA",
      "CAG",
      "AGA",
      "AGG",
      "CGA",
      "CGC",
      "CGG",
      "CGT",
      "AGC",
      "AGT",
      "TCA",
      "TCC",
      "TCG",
      "TCT",
      "ACA",
      "ACC",
      "ACG",
      "ACT",
      "GTA",
      "GTC",
      "GTG",
      "GTT",
      "TGG",
      "TAC",
      "TAT",
      "CAA",
      "CAG",
      "GAA",
      "GAG"
    ];
    let sampleSNPs = ["A", "C", "G", "T"];
  
    let sample = (vec, nCodons) => {
      let samples = [];
      for (let x = 0; x < nCodons; x++) {
        let idx = Math.floor(MT.r01() * vec.length);
        samples.push(vec[idx]);
      }
      return samples;
    }
  
    let seqs = [];
  
    seqs.push({ id: idPrefix + "0", seq: seed });
  
    while (seqs.length < count) {
      // number codons to vary
      let nCodons = Math.floor(MT.r01() * 10) + 1;
  
      // randomly select this many to check for existence
      let randomCodonSet = sample(sampleCodons, nCodons).join("");
  
      // try again if not present
      if (seqs[seqs.length - 1].seq.indexOf(randomCodonSet) == -1) continue;
  
      // sequence to mutate
      let oldseed = seqs[Math.floor(MT.r01() * seqs.length)].seq;
  
      // select codons to replace randomCodonSet
      let replacementCodonSet = sample(sampleCodons, nCodons).join("");
  
      // replace codon set
      let newseed = oldseed.replace(randomCodonSet, replacementCodonSet);
  
      // add snp substitutions randomly across entire sequence
      // - randomly sample addedSNP
      // - randomly pick SNPS to replace
      let addedSNPs = Math.floor(MT.r01() * snps);
      for (let j = 0; j < addedSNPs; j++) {
        let randomSNP = sample(sampleSNPs, 1)[0];
        let locOfSNP = Math.floor(MT.r01() * seed.length);
        newseed =
          newseed.substr(0, locOfSNP) + randomSNP + newseed.substr(locOfSNP + 1);
      }
  
      seqs.push({ id: idPrefix + "" + seqs.length, seq: newseed });
    }
    console.log("Sequence spawn time:", (Date.now() - start).toLocaleString(), 'ms');
    return seqs;
  };
  
  // Puts aligned sequences (nodes with _seq and _padding) on the reference's
  // length: leading gaps for the padding, then cut or padded with gaps at the
  // end. Returns how many had no sequence, lost bases off the end (cut here,
  // or by the aligner, which drops what overhangs the reference; originals
  // are the sequences as they were before alignment, to tell), or were padded
  // with trailing gaps.
  MT.fitToReference = (nodes, referenceLength, minPadding = 0, originals = []) => {
    const fit = { empty: 0, truncated: 0, padded: 0, referenceLength };
    const bases = q => q.replace(/-/g, "").length;
    nodes.forEach((d, i) => {
      if (!d._seq) fit.empty++;
      d._seq = "-".repeat((d._padding || 0) - minPadding) + (d._seq || "");
      let cut = false;
      if (d._seq.length > referenceLength) {
        d._seq = d._seq.substring(0, referenceLength);
        cut = true;
      } else {
        d._seq = d._seq.padEnd(referenceLength, "-");
      }
      if (originals[i] && bases(originals[i]) > bases(d._seq)) cut = true;
      if (cut) fit.truncated++;
      else if (/-$/.test(d._seq) && bases(d._seq) > 0) fit.padded++;
    });
    return fit;
  };

  // Plain-text warnings for what MT.fitToReference reports, or for sequences
  // of differing lengths when nothing aligned them (unaligned: array of lengths)
  MT.lengthWarnings = (fit, unaligned) => {
    const plural = (n, w) => `${n.toLocaleString()} ${w}${n == 1 ? '' : 's'}`;
    const warnings = [];
    if (fit) {
      if (fit.truncated) warnings.push(`${plural(fit.truncated, 'sequence')} extended past the end of the reference and had the excess cut off before distances were computed.`);
      if (fit.padded) warnings.push(`${plural(fit.padded, 'sequence')} did not reach the end of the reference; ${fit.padded == 1 ? 'its' : 'their'} end was filled with gaps.`);
    }
    if (unaligned && unaligned.length) {
      const min = Math.min(...unaligned), max = Math.max(...unaligned);
      if (min != max) warnings.push(`Alignment is off but the sequences differ in length (${min.toLocaleString()} to ${max.toLocaleString()}). Positions will not correspond between sequences, so distances may be wrong. Turn on alignment or align them beforehand.`);
    }
    return warnings;
  };

  MT.align = params => {
    return new Promise((resolve, reject) => {
      if (params.aligner == "none") {
        return resolve(params.nodes);
      }
      let n = params.nodes.length;
      let referenceLength = params.reference.length;
      const originals = params.nodes.map(d => d.seq || "");
      MT.runWorker("workers/align-sw.js", params, { name: "The aligner" }).then(response => {
        let subset = decodeJSON(response.nodes);
        console.log("Alignment transit time: ", (Date.now() - response.start).toLocaleString(), "ms");
        let start = Date.now();
        let minPadding = Infinity,
        d = null;
        for (let i = 0; i < n; i++) {
          d = subset[i];
          if (!d._seq) d._seq = "";
          if (minPadding > d._padding) minPadding = d._padding;
        }
        const fit = MT.fitToReference(subset, referenceLength, minPadding, originals);
        MT.addNodeField('_score', '_padding', '_cigar');
        console.log("Alignment Padding time: ", (Date.now() - start).toLocaleString(), "ms");
        subset.fit = fit;
        resolve(subset);
      }).catch(reject);
    });
  };
  
  MT.computeConsensus = nodes => {
    if (!nodes) nodes = session.data.nodes.filter(d => d.seq);
    return MT.runWorker("workers/compute-consensus.js", nodes, { name: "The consensus computation" }).then(response => {
      console.log("Consensus Transit time: ", (Date.now() - response.start).toLocaleString(), "ms");
      return MT.decode(new Uint8Array(response.consensus));
    });
  };
  
  MT.computeAmbiguityCounts = () => {
    return new Promise((resolve, reject) => {
      let nodes = session.data.nodes;
      let subset = nodes.filter(d => d.seq);
      const subsetLength = subset.length;
      MT.runWorker("workers/compute-ambiguity-counts.js", subset, { name: "The ambiguity count" }).then(response => {
        console.log("Ambiguity Count Transit time: ", (Date.now() - response.start).toLocaleString(), "ms");
        let start = Date.now();
        const dists = new Float32Array(response.counts);
        for (let j = 0; j < subsetLength; j++) {
          nodes[subset[j].index]._ambiguity = dists[j];
        }
        MT.addNodeField('_ambiguity');
        console.log("Ambiguity Count Merge time: ", (Date.now() - start).toLocaleString(), "ms");
        resolve();
      }).catch(reject);
    });
  };
  
  MT.computeConsensusDistances = () => {
    return new Promise((resolve, reject) => {
      let start = Date.now();
      let nodes = session.data.nodes;
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
        consensus: session.data.consensus,
        subset: subset,
        start: start
      }, { name: "The consensus distance computation" }).then(response => {
        let dists = new Uint32Array(response.dists);
        console.log("Consensus Difference Transit time: ", (Date.now() - response.start).toLocaleString(), "ms");
        start = Date.now();
        for (let j = 0; j < subsetLength; j++) {
          nodes[subset[j].index]._diff = dists[j];
        }
        MT.addNodeField('_diff');
        console.log("Consensus Difference Merge time: ", (Date.now() - start).toLocaleString(), "ms");
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
  // any others chosen to compute too (GapMM computes TN93 alone)
  MT.computedMetrics = (widgets = session.style.widgets) => {
    const metric = widgets['default-distance-metric'];
    if ((widgets['ambiguity-resolution-strategy'] || '').toUpperCase() == 'GAPMM') return [metric];
    const also = (widgets['distance-metrics-also'] || []).filter(m => m != metric && MT.distanceMetrics[m]);
    return [metric, ...new Set(also)];
  };

  // The metric a link field holds, if it holds a computed one. Each is kept
  // under its own name (tn93, snps…); sessions from before this kept the
  // distance metric's as distance, which they filter on.
  MT.fieldMetric = field => MT.distanceMetrics[field] ? field : null;

  // The threshold the stored links of a field were limited to, if a threshold
  // above it would show fewer links than the data has (sparse storage), else null.
  MT.storedThresholdBelow = (field, threshold) => {
    const stored = (session.style.widgets['link-stored-thresholds'] || {})[field];
    return stored != null && parseFloat(threshold) > stored ? stored : null;
  };

  MT.computeLinks = async subset => {
    const widgets = session.style.widgets;
    const metrics = MT.computedMetrics(widgets), metric = metrics[0];
    const strategy = (widgets['ambiguity-resolution-strategy'] || 'SKIP').toUpperCase();
    const legacy = strategy == 'GAPMM';
    if (legacy && metric != 'tn93') {
      throw new Error('The GapMM ambiguity strategy is only available for TN93.');
    }

    // HIV-TRACE -g (tn93 -a resolve -g F) decides pair by pair, in the worker:
    // a pair is averaged when its resolvable ambiguity codes (not gaps or N) are
    // at least F times its compared sites, and resolved otherwise.
    const order = subset;

    const n = order.length;
    const pairs = n * (n - 1) / 2;
    const storage = widgets['link-storage'];
    // Each metric kept takes its own 4 bytes a pair
    const sparse = storage == 'threshold' || (storage != 'all' && pairs * metrics.length > MT.maxDenseLinks);
    // Kept within the link threshold for the distance metric, and within their
    // own default thresholds for the others
    const thresholds = sparse ? metrics.map((m, i) => i == 0 ? parseFloat(widgets['link-threshold']) : MT.distanceMetrics[m].threshold) : null;
    if (sparse) console.log(`Keeping only links with ${metrics.map((m, i) => `${m} <= ${thresholds[i]}`).join(', ')} (${pairs.toLocaleString()} pairs)`);

    // Where only links within a threshold are kept, remember it (#228)
    const stored = Object.assign({}, widgets['link-stored-thresholds']);
    metrics.forEach((m, i) => { if (sparse) stored[m] = thresholds[i]; else delete stored[m]; });
    if (MT.settings) MT.settings.set('link-stored-thresholds', stored); else widgets['link-stored-thresholds'] = stored;

    const seqs = order.map(d => d.seq);
    const cores = Math.min(navigator.hardwareConcurrency || 4, 8);
    const workers = Math.max(1, Math.min(cores, Math.ceil(pairs / 1e5)));
    const splits = MT.rowSplits(n, workers);
    const message = {
      seqs,
      metric,
      metrics,
      mode: strategy == 'HIVTRACE-G' ? 'hivtrace-g' : strategy.toLowerCase(),
      fraction: parseFloat(widgets['ambiguity-threshold']),
      threshold: thresholds && thresholds[0],
      thresholds
    };
    // Each worker's results, a part per metric (the legacy worker computes one)
    // Progress is the share of the distance workers done: a worker reports its
    // part as it goes (where it can) and counts as done when it replies
    const done = splits.slice(1).map(() => 0);
    const report = () => MT.progress('Computing distances', done.reduce((a, b) => a + b, 0), done.length);
    report();
    const parts = await Promise.all(splits.slice(1).map((rowEnd, w) => new Promise((resolve, reject) => {
      MT.runWorker(legacy ? 'workers/compute-links-legacy.js' : 'workers/compute-links.js',
        Object.assign({ rowStart: splits[w], rowEnd }, message), { name: "The distance computation",
          onProgress: fraction => { done[w] = fraction; report(); } })
        .then(data => { done[w] = 1; report(); resolve(legacy ? { results: [data], start: data.start } : data); }, reject);
    })));

    console.log('Links Transit time: ', (Date.now() - Math.min(...parts.map(p => p.start))).toLocaleString(), 'ms');
    let start = Date.now();
    const g = session.data.graph;
    const before = g.edgeCount;
    metrics.forEach((m, i) => {
      const field = m;
      if (!session.data.linkFields.includes(field)) session.data.linkFields.push(field);
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
    console.log("Links Merge time: ", (Date.now() - start).toLocaleString(), "ms");
    return g.edgeCount - before;
  };

  // Distances between every pair of nodes, for the given link field, as a
  // condensed upper triangle (NaN where there's no link) over labels.
  MT.getCondensedDM = (metric, labels) => {
    const g = session.data.graph;
    metric = metric || session.style.widgets['link-sort-variable'];
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
      if (typeof v != 'number') v = parseFloat(v); // XLSX link files give strings
      if (i < 0 || j < 0 || isNaN(v)) return;
      if (i > j) [i, j] = [j, i];
      tri[MTGraph.pairIndex(i, j, n)] = v;
    });
    return { labels, tri };
  };

  // The row order of MT.getDM (every node, in session order).
  MT.getDMLabels = () => session.data.nodes.map(d => d._id);

  // The full distance matrix (arrays of arrays, null where there's no link) for
  // the link sort variable, in the order of MT.getDMLabels().
  MT.getDM = () => {
    let start = Date.now();
    return new Promise(resolve => {
      const { labels, tri } = MT.getCondensedDM();
      const n = labels.length;
      let dm = new Array(n);
      for (let i = 0; i < n; i++) {
        dm[i] = new Array(n);
        dm[i][i] = 0;
      }
      let k = 0;
      for (let i = 0; i < n; i++) {
        const row = dm[i];
        for (let j = i + 1; j < n; j++, k++) {
          const v = tri[k];
          // NaN (no link) and Infinity (a saturated distance) are both missing
          row[j] = dm[j][i] = isFinite(v) ? v : null;
        }
      }
      console.log("DM Compute time: ", (Date.now() - start).toLocaleString(), "ms");
      resolve(dm);
    });
  };
  
  MT.computeTree = () => {
    // Every way out settles the promise, as MT.runHamsters waits on it:
    // parsing a tree too deep for patristic throws here, on the main thread (#250)
    return MT.getDM().then(dm => MT.runWorker("workers/compute-tree.js", {
      labels: MT.getDMLabels(),
      matrix: dm,
      round: session.style.widgets["tree-round"]
    }, { name: "The tree computation" })).then(response => {
      temp.tree = patristic.parseJSON(MT.decode(new Uint8Array(response.tree)));
      console.log("Tree Transit time: ", (Date.now() - response.start).toLocaleString(), "ms");
    });
  };
  
  MT.computeDirectionality = () => {
    return new Promise((resolve, reject) => {
      // Directions are inferred from the tree (see MT.runHamsters).
      if (!temp.tree) return resolve();
      const g = session.data.graph;
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
        tree: temp.tree
      }, { name: "The directionality computation" }).then(response => {
        let flips = new Uint8Array(response.output);
        console.log("Directionality Transit time: ", (Date.now() - response.start).toLocaleString(), "ms");
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
        console.log("Directionality Integration time: ", (Date.now() - start).toLocaleString(), "ms");
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
      const g = session.data.graph;
      metric = metric || session.style.widgets['link-sort-variable'];
      const labels = g.ids.slice();
      const { tri } = MT.getCondensedDM(metric, labels);
      MT.runWorker(script, {
        n: labels.length,
        matrix: tri,
        epsilon: session.style.widgets["filtering-epsilon"]
      }, { transfer: [tri.buffer], name }).then(response => {
        let pairs = new Uint32Array(response.pairs);
        console.log(name + " Transit time: ", (Date.now() - response.start).toLocaleString(), "ms");
        const start = Date.now();
        g.clearFlag(MTGraph.NN);
        for (let i = 0; i < pairs.length; i += 2) {
          const e = g.edgeBetween(pairs[i], pairs[i + 1]);
          if (e >= 0) g.setFlag(e, MTGraph.NN, true);
        }
        g.version++;
        console.log(name + " Merge time: ", (Date.now() - start).toLocaleString(), "ms");
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
    const prune = session.style.widgets["link-prune"];
    if (prune == "nn") return MT.computeNN();
    if (prune == "mst") return MT.computeMST();
    return Promise.resolve();
  };
  
  MT.computeTriangulation = () => {
    return new Promise((resolve, reject) => {
      const metric = session.style.widgets['link-sort-variable'];
      MT.getDM().then(dm => MT.runWorker("workers/compute-triangulation.js", { matrix: dm }, { name: "Triangulation" })).then(response => {
        console.log("Triangulation Transit time: ", (Date.now() - response.start).toLocaleString(), "ms");
        let start = Date.now();
        let matrix = decodeJSON(response.matrix);
        const g = session.data.graph;
        let labels = MT.getDMLabels();
        const n = labels.length;
        for(let i = 0; i < n; i++){
          const source = labels[i], a = g.node(source);
          for(let j = 0; j < i; j++){
            const target = labels[j], v = matrix[i][j];
            const e = g.edgeBetween(a, g.node(target));
            if (e < 0) {
              g.addLink({ source: source, target: target, origin: ['Triangulation'], [metric]: v });
            } else if (e < MTGraph.IMPLICIT) {
              g.setValue(e, metric, v);
            } else if (g.denseValues(metric)) {
              g.denseValues(metric)[e - MTGraph.IMPLICIT] = v;
            } else {
              g.addLink({ source: g.ids[g.source(e)], target: g.ids[g.target(e)], [metric]: v });
            }
          }
        }
        g.version++;
        console.log("Triangulation Merge time: ", (Date.now() - start).toLocaleString(), "ms");
        resolve();
      }).catch(reject);
    });
  };
  
  // Directions are inferred from the tree, so with that on, the tree is built
  // first (unless there is one already, from a Newick file) and the links are
  // flipped before finishUp freezes the graph and the views draw it. The tree
  // isn't built otherwise: building it on every load overflowed patristic's
  // stack on large datasets (#250), and only the tree view needs it then, which
  // builds it when opened (and reuses the one built here).
  MT.runHamsters = async () => {
    // if (!session.style.widgets['triangulate-false']) await MT.computeTriangulation(); #236
    // MT.computeNN();
    // MT.computeMST();
    if (!session.style.widgets['infer-directionality-false']) {
      try {
        if (!temp.tree) await MT.computeTree();
        await MT.computeDirectionality();
      } catch (error) {
        console.error(error);
        MT.toast.warning("Couldn't infer the links' directions; they are shown as loaded.", 10);
      }
    }
    return MT.finishUp();
  };
  
  MT.finishUp = async (oldSession) => { 
    clearTimeout(temp.messageTimeout);
    // Where the files just read disagree, say so, and offer to show where
    if (!oldSession) {
      const differ = Array.from(MT.nodeConflicts().values()).reduce((n, ids) => n + ids.length, 0);
      if (differ) MT.toast.warning(`${differ.toLocaleString()} node value${differ == 1 ? '' : 's'} differ between files. Click to review them.`, 15,
        clicked => { if (clicked) MT.launchView("conflicts"); }, { action: "Review" });
      MT.reportDateColumns(session.data.nodes, session.data.nodeFields);
    }
    // Links are done loading: swap the graph's pair lookup for its compact index.
    // (Link objects get null for missing link fields as they're built.)
    session.data.graph.freeze();
    let nodeFields = session.data.nodeFields;
    session.data.nodes.forEach(d => {
      nodeFields.forEach(field => {
        if (!(field in d)) d[field] = null;
      });
    });
    
    // The global menus of node and link variables
    const fill = (id, fields, none = false) => {
      const select = document.getElementById(id);
      MT.fillSelect(select, fields, { none });
      select.value = session.style.widgets[id];
    };
    fill("search-field", session.data.nodeFields);
    MT.enableSearch(true);
    fill("link-sort-variable", session.data.linkFields);
    fill("node-color-variable", session.data.nodeFields, true);
    fill("node-timeline-variable", session.data.nodeFields, true);
    fill("link-color-variable", session.data.linkFields, true);
    try {
      MT.updateThresholdHistogram();
    } catch (error) {
      console.error(error);
      MT.hideModal("loading-information-modal");
      MT.toast.error("Something went wrong! A new session will start in 5 seconds.");
      setTimeout(() => MT.reload(), 5000);
    }
    MT.setLinkVisibility(true);
    session.meta.loadTime = Date.now() - session.meta.startTime;
    console.log("Total load time:", session.meta.loadTime.toLocaleString(), "ms");
    if (oldSession) {
      MT.loadLayout(session.layout);
    } else {
      MT.launchView(session.style.widgets['default-view']);
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
      if (autostash != "true") return;
      if (temp.autostash) clearInterval(temp.autostash.interval);
      // The new copy is written first, and the previous one removed only once
      // it has committed, so a failed write (the quota, say) keeps the old copy.
      // The user is told the first time it fails, not every minute.
      const state = temp.autostash = { time: Date.now(), key: null, warned: false, busy: false };
      state.interval = setInterval(async () => {
        if (state.busy) return;
        state.busy = true;
        try {
          const newKey = "stash-" + Date.now() + "-autostash";
          MT.syncLayout();
          await db.setItem(newKey, JSON.stringify(session));
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
      }, 60000);
    });
    document.querySelectorAll(".hideForHIVTrace").forEach(el => el.style.display = "flex");
    setTimeout(() => {
      let files = layout.contentItems.find(item => item.componentType == "files");
      if (files) files.remove();
      MT.progressDone();
      MT.hideModal("loading-information-modal");
    }, 1200);
  };
  
  // A column heading for a Tabulator table, shown as text (Tabulator reads a
  // plain title as markup, and names come from the loaded files)
  MT.columnTitle = (title, definition) => ({ ...definition, title, titleFormatter: () => document.createTextNode(title) });

  MT.titleize = title => {
    let small = String(title).toLowerCase().replace(/_/g, " ");
    if (small == "null") return "(Empty)";
    if (small == "id" || small == " id") return "ID";
    for (const key in MT.distanceMetrics) {
      if (small == key.replace(/_/g, " ")) return MT.distanceMetrics[key].label;
    }
    if (small == "geo map") return "Map";
    if (small == "timeline") return "Epi Curve";
    if (small == "nn") return "Nearest Neighbor";
    return small.replace(/(?:^|\s|-)\S/g, c => c.toUpperCase());
  };

  // Fills a menu with an option per field: its value prefix + the field, its
  // text label + the field's title. They're built as elements, not markup, so
  // a field named by a loaded file (a session's, say) can't add any (#204).
  //   none: a "None" option first; selected: the value(s) to select;
  //   append: add to the options already there, rather than replace them
  MT.fillSelect = (select, fields, { prefix = "", label = "", none = false, selected, append = false } = {}) => {
    const chosen = [].concat(selected === undefined ? [] : selected).map(String);
    const doc = select.ownerDocument;
    const add = (value, text) => {
      const option = doc.createElement("option");
      option.value = value;
      option.textContent = text;
      if (chosen.includes(value)) option.defaultSelected = option.selected = true;
      select.appendChild(option);
    };
    if (!append) select.replaceChildren();
    if (none) add("None", "None");
    (fields || []).forEach(field => add(prefix + field, label + MT.titleize(field)));
    return select;
  };

  // A component of one node is a singleton, not a cluster: the statistics count
  // a cluster as having more than one node (visible ones, when filtered by date).
  MT.isCluster = nodeCount => nodeCount > 1;

  // Clusters are the connected components of the visible links.
  MT.tagClusters = () => {
    return new Promise(resolve => {
      let start = Date.now();
      let clusters = session.data.clusters = [];
      const nodes = session.data.nodes;
      const g = session.data.graph;
      const lsv = session.style.widgets["link-sort-variable"];
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
      g.nodeCluster = nodeCluster;
      g.version++;

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
      console.log("Cluster Tagging time:", (Date.now() - start).toLocaleString(), "ms");
      resolve();
    });
  };
  
  MT.setNodeVisibility = silent => { 
    let start = Date.now();
    let dateField = session.style.widgets["timeline-date-field"];
    let nodes = session.data.nodes,
      clusters = session.data.clusters;
    let n = nodes.length;
    let timeEnd = dateField != "None" && MT.parseDate(session.state.timeEnd);
    const order = MTDates.dateOrderOf(nodes.map(d => d[dateField])).order;
    for (let i = 0; i < n; i++) {
      let node = nodes[i];
      node.visible = true;
      let cluster = clusters[node.cluster];
      if (cluster) {
        node.visible = node.visible && cluster.visible; 
      }
      // Nodes after the epi curve's brushed range are hidden; undated ones stay
      if (timeEnd) node.visible = node.visible && MTDates.shownAt(node[dateField], timeEnd, order);
    }
    if (!silent) MT.events.emit("node-visibility");
    console.log("Node Visibility Setting time:", (Date.now() - start).toLocaleString(), "ms");
  };
  
  MT.setLinkVisibility = silent => { 
    let start = Date.now();
    let metric = session.style.widgets["link-sort-variable"],
      threshold = parseFloat(session.style.widgets["link-threshold"]),
      showNN = session.style.widgets["link-prune"] != "none";
    const g = session.data.graph;
    const clusters = session.data.clusters;
    const nodeCluster = g.nodeCluster;
    const keep = nodeCluster && clusters.length ? s => {
      const cluster = clusters[nodeCluster[s]];
      return !cluster || cluster.visible;
    } : () => true;
    g.computeVisible(metric, threshold, showNN, keep);
    if (!silent) MT.events.emit("link-visibility");
    console.log("Link Visibility Setting time:", (Date.now() - start).toLocaleString(), "ms");
  };
  
  MT.setClusterVisibility = silent => { 
    let start = Date.now();
    let min = session.style.widgets["cluster-minimum-size"];
    let clusters = session.data.clusters;
    let n = clusters.length;
    for (let i = 0; i < n; i++) {
      let cluster = clusters[i];
      cluster.visible = cluster.nodes >= min;
    }
    if (!silent) MT.events.emit("cluster-visibility");
    console.log("Cluster Visibility Setting time:", (Date.now() - start).toLocaleString(), "ms");
  };

  // Copies the network's layout from the GPU into session.network.nodes, for
  // what reads it there (saving, the timeline). The network does this itself
  // only when its layout settles: reading it back waits for the GPU.
  MT.syncLayout = () => {
    if (temp.network && temp.network.syncPositions) temp.network.syncPositions();
  };

  MT.getNetworkNodes = () => {
    MT.syncLayout();
    let nodes = session.network.nodes;
    let n = nodes.length;
    let out = [];
      for (let i = 0; i < n; i++) {
        let node = nodes[i];
        out.push(JSON.parse(JSON.stringify(node)));
      }
    return out;
  };

  MT.updatePinNodes = copy => {
    MT.syncLayout();
    let nodes = session.network.nodes;
    let n = nodes.length;
    for (let i = 0; i < n; i++) {
      let node = nodes[i]; 
      if (copy && node.fixed) node.preFixed = true;
      if (!copy && session.network.timelineNodes[i].preFixed) {
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
    let nodes = session.data.nodes;
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

  // Link objects for the visible links, built once per change to the graph.
  MT.getVisibleLinks = copy => {
    const g = session.data.graph;
    let cache = temp.visibleLinks;
    if (!cache || cache.graph !== g || cache.version !== g.version) {
      const links = new Array(g.visibleCount);
      for (let x = 0; x < g.visibleCount; x++) links[x] = MT.linkObject(g.visible[x], true);
      cache = temp.visibleLinks = { graph: g, version: g.version, links };
    }
    if (copy) return cache.links.map(link => JSON.parse(JSON.stringify(link)));
    return cache.links.slice();
  };
  
  MT.getVisibleClusters = copy => {
    let clusters = session.data.clusters;
    let n = clusters.length;
    let out = [];
    if (copy) {
      for (let i = 0; i < n; i++) {
        let cluster = clusters[i];
        if (cluster.visible){
          out.push(JSON.parse(JSON.stringify(cluster)));
        }
      }
    } else {
      for (let j = 0; j < n; j++) {
        let cluster = clusters[j];
        if (cluster.visible){
          out.push(cluster);
        }
      }
    }
    return out;
  };
  
  MT.updateStatistics = () => {
    if (!session.style.widgets["network-statistics-show"]) return;
    let vnodes = MT.getVisibleNodes();
    let vlinks = MT.getVisibleLinks();
    let linkCount = 0;
    let clusterCount = 0;
    if (session.style.widgets["timeline-date-field"]== 'None') {
      linkCount = vlinks.length;
      clusterCount = session.data.clusters.filter(cluster => cluster.visible && MT.isCluster(cluster.nodes)).length;
    } else {
      // (Looked up by ID, as the links name nodes by their ID)
      const visibleIds = new Set();
      vnodes.forEach(d => { visibleIds.add('' + d._id); if (d.id != null) visibleIds.add('' + d.id); });
      vlinks.forEach(l => {
        if (visibleIds.has('' + l.source) && visibleIds.has('' + l.target)) linkCount++;
      });

      const sizes = new Map();
      vnodes.forEach(d => sizes.set(d.cluster, (sizes.get(d.cluster) || 0) + 1));
      clusterCount = session.data.clusters.filter(cluster => cluster.visible && MT.isCluster(sizes.get(cluster.id))).length;
    }
    let singletons = vnodes.filter(d => d.degree == 0).length;
    const show = (id, n) => { document.getElementById(id).textContent = n.toLocaleString(); };
    show("numberOfSelectedNodes", vnodes.filter(d => d.selected).length);
    show("numberOfNodes", vnodes.length);
    show("numberOfVisibleLinks", linkCount);
    show("numberOfSingletonNodes", singletons);
    show("numberOfDisjointComponents", clusterCount); // #187
  };
  
  // Whether the user asked their system for less motion (#191)
  MT.reducedMotion = () => !!(self.matchMedia && self.matchMedia('(prefers-reduced-motion: reduce)').matches);

  // A color (or transparency) for each value, as the color tables list them.
  // Their values are text ("0", "null"), so a value is looked up as text too:
  // a d3 scale would give 0 or null a new color of its own, unlike its row's.
  MT.colorScale = (range, domain) => {
    const scale = d3.scaleOrdinal(range).domain(domain);
    const lookup = value => scale(String(value));
    lookup.domain = () => scale.domain();
    lookup.range = () => scale.range();
    return lookup;
  };

  // The value a link is colored by: for origin, the first of its files
  MT.linkColorValue = (link, variable) => variable == 'origin' ? [].concat(link.origin)[0] : link[variable];

  // A value as legends and tables show it: as it is in the data, or (Empty)
  MT.valueLabel = value => value === undefined || value === null || value === '' || value === 'null' || value === 'undefined' ? '(Empty)' : '' + value;

  // The default palette: Okabe-Ito, which stays distinguishable under the common
  // colour-vision deficiencies (the last grey stands in for its black).
  MT.COLOR_BLIND_SAFE = ['#0072b2', '#e69f00', '#009e73', '#cc79a7', '#56b4e9', '#d55e00', '#f0e442', '#999999'];

  // A palette stretched to n colours. Beyond its own colours, each further
  // round is a lighter, then a darker, shade of them, so no two values look
  // the same, and the user is told once that the later ones are only shades.
  MT.extendPalette = (colors, n, kind, variable) => {
    if (n <= colors.length) return colors;
    const out = colors.slice();
    for (let i = colors.length; i < n; i++) {
      const round = Math.floor(i / colors.length), base = colors[i % colors.length];
      const mixed = d3.interpolateRgb(base, round % 2 ? '#ffffff' : '#000000')(Math.min(0.2 + 0.12 * Math.ceil(round / 2), 0.7));
      out.push(d3.color(mixed).formatHex());
    }
    if (kind) {
      const seen = temp.extendedPalettes || (temp.extendedPalettes = {});
      const key = kind + ':' + variable;
      if (!seen[key]) {
        seen[key] = true;
        if (MT.toast && MT.toast.warning) MT.toast.warning(`"${variable}" has ${n} values but the palette has ${colors.length} colours, so the extra values use lighter and darker shades. Edit the colours in the ${kind} colour table, or add a shape, to tell them apart.`, 12);
      }
    }
    return out;
  };

  MT.createNodeColorMap = () => {
    let variable = session.style.widgets["node-color-variable"];
    if (variable == "None") {
      temp.style.nodeColorMap = () => session.style.widgets["node-color"];
      return [];
    }
    
    let nodeColors;
    if(session.style.nodeColorsTable[variable]) {
      nodeColors = session.style.nodeColorsTable[variable];
    } else {
      nodeColors = session.style.nodeColorsTable[variable] = [...session.style.nodeColors];
    }
    
    let aggregates = {};
    let nodes = session.data.nodes;
    let n = nodes.length;
    for (let i = 0; i < n; i++) {
      let d = nodes[i];
      if (!d.visible) continue;
      let dv = d[variable];
      if (dv in aggregates) {
        aggregates[dv]++;
      } else {
        aggregates[dv] = 1;
      }
    }
    let values = Object.keys(aggregates);
    if (values.length > nodeColors.length) {
      nodeColors = MT.extendPalette(nodeColors, values.length, 'node', variable);
    }
    if(!session.style.nodeAlphas) session.style.nodeAlphas = new Array(values.length).fill(1);
    if (values.length > session.style.nodeAlphas.length) {
      session.style.nodeAlphas = session.style.nodeAlphas.concat(
        new Array(values.length - session.style.nodeAlphas.length).fill(1)
      );
    }

    if (session.style.widgets["node-timeline-variable"] == 'None') {
      session.style.nodeColorsTableKeys[variable] = values;
      session.style.nodeColorsTable[variable] = nodeColors;
    } else {
      
      // During timeline mode, user Pause and switch to a different Node varaible but nodeColorsTableKeys[variable] is not available
      if(!session.style.nodeColorsTableKeys[variable]) {
        let aggregatesTL = {};
        let nodesTL = session.network.timelineNodes;
        let n = nodesTL.length;
        let nodeColorsTL = [...session.style.nodeColors];
        for (let i = 0; i < n; i++) {
          let d = nodesTL[i];
          if (!d.visible) continue;
          let dv = d[variable];
          if (dv in aggregatesTL) {
            aggregatesTL[dv]++;
          } else {
            aggregatesTL[dv] = 1;
          }
        }
        let valuesTL = Object.keys(aggregatesTL);
        if (valuesTL.length > nodeColorsTL.length) {
          nodeColorsTL = MT.extendPalette(nodeColorsTL, valuesTL.length);
        }
        session.style.nodeColorsTableKeys[variable] = valuesTL;
        session.style.nodeColorsTable[variable] = nodeColorsTL;
      }
          
      let key;
      let tempNodeColors=[];
      for(let v of values) {
        let table = session.style.nodeColorsTableKeys[variable];
        key = table.findIndex( k => k === v);
        tempNodeColors.push(nodeColors[key]);
      }
      nodeColors = temp.style.nodeColor = tempNodeColors; // temp node color maps saved only under timeline
      temp.style.nodeColorKeys = [...values];
    }
      
    temp.style.nodeColorMap = MT.colorScale(nodeColors, values);
    temp.style.nodeAlphaMap = MT.colorScale(session.style.nodeAlphas, values);

    return aggregates;
  };
  
  MT.createLinkColorMap = () => {
    let variable = session.style.widgets["link-color-variable"];
    if (variable == "None") {
      temp.style.linkColorMap = () => session.style.widgets["link-color"];
      temp.style.linkAlphaMap = () => 1 - session.style.widgets["link-opacity"];
      return [];
    }

    let linkColors;
    if(session.style.linkColorsTable[variable]) {
      linkColors = session.style.linkColorsTable[variable];
    } else {
      linkColors = session.style.linkColorsTable[variable] = [...session.style.linkColors];
    }

    let aggregates = {};
    let links = MT.getVisibleLinks();
    let i = 0,
      n = links.length,
      l;
    if (variable == "origin") {
      while (i < n) {
        l = links[i++];
        if (!l.visible) continue;

        let src = session.data.nodes.find(dd => dd._id == l.source || dd.id == l.source);
        let tgt = session.data.nodes.find(dd => dd._id == l.target || dd.id == l.target);
        if (src === undefined || src.visible === false) continue;
        if (tgt === undefined || tgt.visible === false) continue;
        
        l.origin.forEach(o => {
          if (o in aggregates) {
            aggregates[o]++;
          } else {
            aggregates[o] = 1;
          }
        });
      }
    } else {
      while (i < n) {
        l = links[i++];
        if (!l.visible) continue;
        
        let src = session.data.nodes.find(dd => dd._id == l.source || dd.id == l.source);
        let tgt = session.data.nodes.find(dd => dd._id == l.target || dd.id == l.target);
        if (src === undefined || src.visible === false) continue;
        if (tgt === undefined || tgt.visible === false) continue;  

        let lv = l[variable];
        if (lv in aggregates) {
          aggregates[lv]++;
        } else {
          aggregates[lv] = 1;
        }
      }
    }
    let values = Object.keys(aggregates);      
    if (values.length > linkColors.length) {
      linkColors = MT.extendPalette(linkColors, values.length, 'link', variable);
    }
    if(!session.style.linkAlphas) session.style.linkAlphas = new Array(values.length).fill(1);
    if (values.length > session.style.linkAlphas.length) {
      session.style.linkAlphas = session.style.linkAlphas.concat(
        new Array(values.length - session.style.linkAlphas.length).fill(1)
      );
    }

    if (session.style.widgets["node-timeline-variable"] == 'None') {
      session.style.linkColorsTableKeys[variable] = values;
      session.style.linkColorsTable[variable] = linkColors;
    } else {

      // During timeline mode, user Pause and switch to a different link varaible but linkColorsTableKeys[variable] is not available
      if(!session.style.linkColorsTableKeys[variable]) {
        let aggregatesTL = {};
        let linksTL = MT.getVisibleLinks();
        let linkColorsTL = [...session.style.linkColors];
        let i = 0,
          n = linksTL.length,
          l;
        if (variable == "origin") {
          while (i < n) {
            l = linksTL[i++];
            if (!l.visible) continue;
            let src = session.network.timelineNodes.find(dd => dd._id == l.source || dd.id == l.source);
            let tgt = session.network.timelineNodes.find(dd => dd._id == l.target || dd.id == l.target);
            if (src === undefined || src.visible === false) continue;
            if (tgt === undefined || tgt.visible === false) continue;
            l.origin.forEach(o => {
              if (o in aggregatesTL) {
                aggregatesTL[o]++;
              } else {
                aggregatesTL[o] = 1;
              }
            });
          }
        } else {
          while (i < n) {
            l = linksTL[i++];
            if (!l.visible) continue;
            let src = session.network.timelineNodes.find(dd => dd._id == l.source || dd.id == l.source);
            let tgt = session.network.timelineNodes.find(dd => dd._id == l.target || dd.id == l.target);
            if (src === undefined || src.visible === false) continue;
            if (tgt === undefined || tgt.visible === false) continue;  
            let lv = l[variable];
            if (lv in aggregatesTL) {
              aggregatesTL[lv]++;
            } else {
              aggregatesTL[lv] = 1;
            }
          }
        }       
        let valuesTL = Object.keys(aggregatesTL);      
        if (valuesTL.length > linkColorsTL.length) {
          linkColorsTL = MT.extendPalette(linkColorsTL, valuesTL.length);
        }
        session.style.linkColorsTableKeys[variable] = valuesTL;
        session.style.linkColorsTable[variable] = linkColorsTL;
      }

      let key;
      let tempLinkColors=[];
      for(let v of values) {
        let table = session.style.linkColorsTableKeys[variable];
        key = table.findIndex( k => k === v);
        tempLinkColors.push(linkColors[key]);
      }
      linkColors = temp.style.linkColor = tempLinkColors; // temp link color maps saved only under timeline
      temp.style.linkColorsKeys = [...values];
    }

    temp.style.linkColorMap = MT.colorScale(linkColors, values);
    temp.style.linkAlphaMap = MT.colorScale(session.style.linkAlphas, values);

    return aggregates;
  };

  MT.createPolygonColorMap = () => {
    if (!temp.polygonGroups || !session.style.widgets["polygons-color-show"]) {
      temp.style.polygonColorMap = () => session.style.widgets["polygon-color"];
      return [];
    }

    let aggregates = {};
    let groups = temp.polygonGroups;
    groups.forEach(d => aggregates[d.key] = d.values.length);
    let values = Object.keys(aggregates);

    if (session.style.widgets["polygon-color-table-counts-sort"] == "ASC")
      values.sort(function(a, b) { return aggregates[a] - aggregates[b] });
    else if (session.style.widgets["polygon-color-table-counts-sort"] == "DESC")
      values.sort(function(a, b) { return aggregates[b] - aggregates[a] });
    if (session.style.widgets["polygon-color-table-name-sort"] == "ASC")
      values.sort(function(a, b) { return a - b });
    else if (session.style.widgets["polygon-color-table-name-sort"] == "DESC")
      values.sort(function(a, b) { return b - a });

    if (values.length > session.style.polygonColors.length) {
      let colors = [];
      let m = Math.ceil(values.length / session.style.polygonColors.length);
      while (m-- > 0) {
        colors = colors.concat(session.style.polygonColors);
      }
      session.style.polygonColors = colors;
    }
    if(!session.style.polygonAlphas) session.style.polygonAlphas = new Array(values.length).fill(1);
    if (values.length > session.style.polygonAlphas.length) {
      session.style.polygonAlphas = session.style.polygonAlphas.concat(
        new Array(values.length - session.style.polygonAlphas.length).fill(0.5)
      );
    }
    if (temp.style.polygonColorMap.domain === undefined)
      temp.style.polygonColorMap = d3
        .scaleOrdinal(session.style.polygonColors)
        .domain(values);
    if (temp.style.polygonAlphaMap.domain === undefined)
      temp.style.polygonAlphaMap = d3
        .scaleOrdinal(session.style.polygonAlphas)
        .domain(values);
      
    return aggregates;
  };

  MT.reset = () => {

    // temp variables is affecting the recall file's link visibility when recalling the same file
    // reset temp causing register component error since file view has been registered and 2nd_network view via ansyc call also causing register error
    // reset temp but retain componentCache
    let tempComp = self.temp.componentCache;
    self.temp = MT.tempSkeleton();
    self.temp.componentCache = tempComp;
    
    self.session = MT.sessionSkeleton();
    // The controls show the new session's settings (and the statistics hide,
    // having no network)
    MT.settings.reload();
    MT.enableSearch(false);
    // A new layout also drops the stateChanged listeners the old views added
    MT.createLayout();
    MT.launchView("files");
  };
  
  MT.getMapData = type => {
    return new Promise(resolve => {
      let parts = type.split(".");
      let name = parts[0],
          format = parts[1];
      if (temp.mapData[name]) {
        return resolve(temp.mapData[name]);
      }
      fetch("data/" + type).then(response => format == "json" ? response.json() : response.text()).then(response => {
        if (format == "csv") {
          temp.mapData[name] = Papa.parse(response, { header: true }).data;
        }
        if (format == "json") {
          temp.mapData[name] = response;
        }
        resolve(temp.mapData[name]);
      });
    });
  };
  
  //Adapted from https://24ways.org/2010/calculating-color-contrast/
  MT.contrastColor = hexcolor => {
    let r = parseInt(hexcolor.substr(1, 2), 16);
    let g = parseInt(hexcolor.substr(3, 2), 16);
    let b = parseInt(hexcolor.substr(5, 2), 16);
    let yiq = r * 299 + g * 587 + b * 114;
    return yiq >= 128000 ? "#000000" : "#ffffff";
  };
  
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
    if (self.layout) {
      parkPanels();
      layout.destroy();
    }
    recentViews.length = 0;
    self.layout = new goldenLayout.GoldenLayout(document.getElementById("main-panel"));
    layout.resizeWithContainerAutomatically = true;
    // golden-layout builds a component before its element is in the page, where
    // a view's inline scripts couldn't find their own elements. Components are
    // therefore empty here, and renderView fills each one in once it's attached.
    layout.registerComponentFunction(() => function () {});
    // MicrobeTrace's open views, which golden-layout 1 called contentItems
    Object.defineProperty(layout, "contentItems", { get: () => viewItems(layout.rootItem) });
    layout.loadLayout(emptyLayout);
    layout.on("stateChanged", () => session.layout = MT.cacheLayout(layout.rootItem));
    layout.on("activeContentItemChanged", bringForward);
    layout.on("focus", e => bringForward(e.target));
  };

  // Fetches a view's HTML into temp.componentCache. A failed fetch (offline,
  // 404, or a server answering with something other than HTML) is not cached,
  // so the next attempt tries again, and rejects with a message naming the view.
  const fetchView = view => {
    if (temp.componentCache[view]) return Promise.resolve();
    const fail = () => {
      throw new Error("Could not load the " + MT.titleize(view) + " view. Check your connection and try again.");
    };
    return fetch("components/" + view + ".html").then(response => {
      if (!response.ok) fail();
      return response.text();
    }, fail).then(html => {
      // server.js answers unknown paths with the app shell (index.html)
      if (/^\s*<!doctype/i.test(html)) fail();
      temp.componentCache[view] = html;
    });
  };
  const viewFailed = error => MT.toast.error(error.message);

  // Renders a view's HTML into its (newly attached) layout item
  // (Scripts set as HTML don't run, so each is replaced by a copy that does.)
  const renderView = contentItem => {
    const element = contentItem.container.element;
    element.innerHTML = temp.componentCache[contentItem.componentType];
    element.querySelectorAll("script").forEach(old => {
      const script = document.createElement("script");
      Array.from(old.attributes).forEach(a => script.setAttribute(a.name, a.value));
      script.textContent = old.textContent;
      old.replaceWith(script);
    });
  };

  // The settings store and event bus that views use (see src/settings.js and
  // src/events.js)
  MT.settings = new MTSettings(() => session.style.widgets);
  MT.events = new MTEvents();

  // Closes a Bootstrap dialog by its id
  MT.hideModal = id => {
    const modal = document.getElementById(id);
    if (modal) bootstrap.Modal.getOrCreateInstance(modal).hide();
  };

  // Opens the global settings at their Styling tab
  MT.showColorOptions = () => {
    bootstrap.Tab.getOrCreateInstance(document.getElementById("style-tab")).show();
    setTimeout(() => bootstrap.Modal.getOrCreateInstance(document.getElementById("global-settings-modal")).show(), 250);
  };

  // Views written as modules register a mount function from their component's
  // script:
  //
  //   MT.registerView('histogram', (root, { settings, events }) => {
  //     ...
  //     return { resize() { ... }, destroy() { ... } };
  //   });
  //
  // mount runs once the view is in the layout, with the view's own element as
  // root (query inside it rather than by global ID). resize() runs when the view
  // changes size or its tab is shown, and destroy() when it closes. Views
  // without a mount function are older ones that set themselves up when their
  // script runs.
  MT.views = {};
  MT.registerView = (name, mount) => { MT.views[name] = mount; };

  // Slides a view's settings pane (.left-pane) in or out
  MT.slidePane = (pane, open) => {
    if (pane.slide) pane.slide.cancel();
    const from = getComputedStyle(pane).display == 'none' ? '-400px' : getComputedStyle(pane).left;
    const to = open ? '0px' : '-400px';
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
  const paneRoom = 410, besideAtLeast = 600;
  // The width a view has to draw in: all of it, less what an open pane beside
  // it takes
  MT.viewWidth = root => root.clientWidth - (root.classList.contains('pane-beside-open') ? paneRoom : 0);
  const openPanes = new Set();
  const typing = target => target.isContentEditable || target.tagName == 'TEXTAREA' ||
    (target.tagName == 'INPUT' && !['checkbox', 'radio', 'range', 'button', 'color'].includes(target.type));
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

  // Search works once there are nodes to search
  MT.enableSearch = enabled => {
    ['search', 'search-field'].forEach(id => { document.getElementById(id).disabled = !enabled; });
  };

  // Today, as YYYY-MM-DD in local time
  MT.today = () => {
    const d = new Date(), pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  // A file name as typed, made safe to save: characters no file system takes
  // are dropped, and an extension that will be added anyway (or one of
  // `extensions` that was typed) is stripped, so figure.png does not become
  // figure.png.png. An empty result falls back to `fallback`.
  MT.cleanFilename = (name, extensions = [], fallback = 'microbetrace-' + MT.today()) => {
    let clean = String(name || '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '').trim();
    const typed = /\.([A-Za-z0-9]+)$/.exec(clean);
    if (typed && extensions.includes(typed[1].toLowerCase())) clean = clean.slice(0, -typed[0].length).trim();
    clean = clean.replace(/^\.+/, '').trim();
    return clean || fallback;
  };

  // A filename field that suggests a name each time its dialog opens:
  // microbetrace-<what>-<today>, or microbetrace-<today>, where what() names
  // what's saved. A name typed in is kept.
  MT.defaultFilename = (field, what = () => '') => {
    field.closest('.modal').addEventListener('show.bs.modal', () => {
      if (field.value && field.value != field.dataset.suggested) return;
      field.value = field.dataset.suggested = ['microbetrace', what(), MT.today()].filter(Boolean).join('-');
    });
  };

  // What an export dialog inside a view suggests calling the file: the view's
  // name, e.g. epi-curve
  const exportName = root => {
    const item = layout.contentItems.find(item => item.container.element.contains(root));
    return item ? MT.titleize(item.componentType).toLowerCase().replace(/[^a-z0-9]+/g, '-') : '';
  };

  // Wires a table view's export dialog: a filename field (export-filename), a
  // file type menu (export-filetype) and an .export-button. `formats` maps each
  // file type to a function that saves the file, given the filename.
  MT.tableExport = (root, formats) => {
    const field = name => root.querySelector(`[name="${name}"]`);
    MT.defaultFilename(field('export-filename'), () => exportName(root));
    root.querySelector('.export-button').addEventListener('click', () => {
      const filetype = field('export-filetype').value;
      formats[filetype](field('export-filename').value);
    });
  };

  // A PDF of tables ({ title, headers, rows })
  MT.tablesPDF = (heading, tables, filename) => pdfMake.createPdf({
    content: [
      { text: heading, style: 'header', alignment: 'center' },
      ...tables.map(t => ({
        style: 'paddedTable',
        table: { headerRows: 1, widths: t.headers.map(() => '*'), body: [t.headers].concat(t.rows) }
      }))
    ],
    footer: (currentPage, pageCount) => [{ text: `Page ${currentPage} of ${pageCount}`, alignment: 'center' }],
    styles: {
      header: { fontSize: 22, bold: true },
      paddedTable: { margin: [10, 10, 10, 10] }
    }
  }).download(filename + '.pdf');

  // Turns a <select multiple> into a searchable menu of removable choices (Tom
  // Select). To change its options, destroy() it and make a new one. Its menu
  // opens in the page body, so a panel's edge doesn't cut it off.
  // A Tabulator table, with its ARIA tree mended: Tabulator puts its scrolling
  // holder (focusable, so it can be scrolled with the keys) between the grid
  // and its rows, and marks column groups with a role and an attribute ARIA
  // doesn't have (and puts their columns' headers inside the group's)
  MT.table = (element, options) => {
    const table = new Tabulator(element, options);
    const mend = () => {
      const root = table.element, holder = root.querySelector(':scope > .tabulator-tableholder');
      root.removeAttribute('aria-owns');
      if (holder) {
        holder.setAttribute('role', 'rowgroup');
        holder.querySelectorAll(':scope > .tabulator-table').forEach(body => body.setAttribute('role', 'none'));
      }
      // A group's title heads its columns, which sit beside it in the row
      root.querySelectorAll('[role="columngroup"]').forEach(group => {
        group.setAttribute('role', 'none');
        group.removeAttribute('aria-title');
        group.removeAttribute('aria-sort');
        const title = group.querySelector(':scope > .tabulator-col-content');
        if (title) title.setAttribute('role', 'columnheader');
      });
    };
    table.on('tableBuilt', mend);
    table.on('renderComplete', mend);
    return table;
  };

  MT.multiSelect = (select, { max } = {}) => {
    const label = select.labels && select.labels[0];
    const name = select.getAttribute('aria-label') || (label ? label.textContent.trim() : select.title);
    const menu = new TomSelect(select, {
      plugins: ['remove_button'],
      maxItems: max || null,
      hideSelected: true,
      dropdownParent: 'body'
    });
    // Tom Select moves the label to its own field, leaving the original (kept
    // for forms, but still read out) without a name
    select.setAttribute('aria-label', name);
    if (!menu.control_input.hasAttribute('aria-labelledby')) menu.control_input.setAttribute('aria-label', name);
    return menu;
  };

  // Plotly layout colors for the current background
  MT.plotColors = settings => {
    const background = settings.get('background-color'), contrast = settings.get('background-color-contrast');
    return { paper_bgcolor: background, plot_bgcolor: background, font: { color: contrast } };
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

  // A plot's frame: just below the view's toolbar at the top (Plotly's own
  // margin leaves 100px empty), and clear of the docked tables at the right
  MT.plotLayout = (root, settings) => ({
    margin: { t: 50, r: 20 + MT.dockRoom(root), b: 60, l: 70 },
    ...MT.plotColors(settings)
  });

  // A plot's gridlines: the contrast color, faint enough to sit behind the data
  MT.gridColor = (settings, opacity = 0.15) => {
    const color = d3.color(settings.get('background-color-contrast'));
    color.opacity = opacity;
    return color + '';
  };

  // Choosing a view's variables from the data. Fields that MicrobeTrace keeps
  // for itself, or that identify items, are left out.
  const ownFields = ['index', '_id', 'id', 'selected', 'visible', 'origin', 'seq', 'source', 'target', 'nn', 'directed'];
  const choosable = fields => fields.filter(field => !ownFields.includes(field) && field[0] != '_');
  const valuesOf = (items, field) => items.map(d => d[field]).filter(v => v != null && v !== '');

  // Fields that sort items into a few groups: text with 2 to 20 values
  MT.categoricalFields = (items, fields) => choosable(fields).filter(field => {
    const values = valuesOf(items, field);
    if (!values.length || values.some(v => typeof v != 'string')) return false;
    const distinct = new Set(values).size;
    return distinct >= 2 && distinct <= 20;
  });

  // Fields of measurements: numbers with at least 3 values (cluster IDs aren't)
  MT.numericFields = (items, fields) => choosable(fields).filter(field => {
    if (field == 'cluster') return false;
    const values = valuesOf(items, field);
    return values.length > 0 && values.every(v => typeof v == 'number' && isFinite(v)) && new Set(values).size >= 3;
  });

  // Whether a value is a date: a Date, or text that reads as one (in the given
  // order, see MTDates.dateOrderOf). Numbers aren't, nor text that's just a
  // number (as spreadsheets give), though MT.parseDate reads them as times.
  MT.isDate = (value, order) => value instanceof Date ? !isNaN(value) :
    typeof value == 'string' && isNaN(value) && !!MT.parseDate(value, order);

  // A column's values read as dates: how many are present, how many read, and
  // how many distinct dates they are, all in the column's order
  MT.dateColumn = values => {
    const present = values.filter(v => v != null && v !== '');
    const { order, status } = MTDates.dateOrderOf(present);
    const dates = present.filter(v => MT.isDate(v, order));
    return { order, status, present: present.length, readable: dates.length, distinct: new Set(dates).size };
  };

  // Fields of dates: at least half the values are dates, with at least 2
  // distinct. The rest are undated (see MT.reportDateColumns). Those named for
  // dates come first.
  MT.dateFields = (items, fields) => choosable(fields).filter(field => {
    const { present, readable, distinct } = MT.dateColumn(valuesOf(items, field));
    return readable > 0 && readable * 2 >= present && distinct >= 2;
  }).sort((a, b) => /date|time|day/i.test(b) - /date|time|day/i.test(a));

  // Says, when a file is read, how each date field was read: values that
  // couldn't be (so are undated), and columns whose day-first and month-first
  // dates are mixed or can't be told apart
  MT.reportDateColumns = (items, fields) => {
    const lines = [];
    MT.dateFields(items, fields).forEach(field => {
      const { status, present, readable } = MT.dateColumn(valuesOf(items, field));
      const notes = [];
      if (status == 'inconsistent') notes.push('mixes day-first and month-first dates, so it is read month-first');
      if (status == 'ambiguous') notes.push('has dates that could be day-first or month-first (such as 03/04/2020), so it is read month-first');
      const unreadable = present - readable;
      if (unreadable) notes.push(`${unreadable.toLocaleString()} value${unreadable == 1 ? ' could' : 's could'} not be read as ${unreadable == 1 ? 'a date' : 'dates'} and ${unreadable == 1 ? 'is' : 'are'} undated`);
      if (notes.length) lines.push(`<strong>${MT.escape(field)}</strong>: ${notes.join('; ')}.`);
    });
    if (lines.length) MT.toast.warning(lines.join('<br>'), 15);
  };

  // A floating table (such as a view's legend) with a drag handle and a
  // context menu. The menu's items say what they do with data-action: drag
  // (show or hide the drag handle), hide, expand (or contract), and counts or
  // frequencies (call onCounts or onFrequencies). onHide hides the table.
  // Tables sit in their view's panel dock (MT.panelDock); dragging one moves it
  // from its place there. Returns a function that disconnects it.
  MT.floatingTable = (wrapper, menu, { onHide, onCounts, onFrequencies } = {}) => {
    const handle = wrapper.querySelector('.draghandle');
    let opener = null, row = null;
    const closeMenu = () => { menu.style.display = 'none'; };
    const items = () => Array.from(menu.querySelectorAll('[data-action]'));
    const openMenu = (x, y, from) => {
      opener = from || null;
      Object.assign(menu.style, { display: 'block', position: 'fixed', left: x + 'px', top: y + 'px', zIndex: 1060 });
    };
    wrapper.addEventListener('contextmenu', e => {
      e.preventDefault();
      row = e.target.closest('[data-value]');
      openMenu(e.clientX, e.clientY, row);
    });
    // The same menu without a mouse (#185): an options button on the table, and
    // the menu key or Shift+F10 on anything in it. The menu takes the focus, its
    // arrows move between the items, and Escape closes it and gives the focus back.
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'floater-menu-button btn btn-light btn-sm';
    button.title = 'Table options: hide, expand, rename values (or right-click the table)';
    button.setAttribute('aria-label', 'Table options');
    button.setAttribute('aria-haspopup', 'menu');
    button.innerHTML = '<span class="bi bi-three-dots" aria-hidden="true"></span>';
    wrapper.prepend(button);
    const openFrom = (target, box) => {
      row = target.closest && target.closest('[data-value]');
      openMenu(box.left, box.bottom, target);
      const first = items()[0];
      if (first) first.focus();
    };
    button.addEventListener('click', e => { e.stopPropagation(); openFrom(button, button.getBoundingClientRect()); });
    wrapper.addEventListener('keydown', e => {
      if (e.key == 'ContextMenu' || (e.key == 'F10' && e.shiftKey)) {
        e.preventDefault();
        openFrom(e.target, e.target.getBoundingClientRect());
      }
    });
    // (Taken before Bootstrap's own dropdown keys, which look for a toggle this
    // menu doesn't have)
    const menuKeys = e => {
      if (!menu.contains(e.target)) return;
      const list = items(), at = list.indexOf(document.activeElement);
      if (['ArrowDown', 'ArrowUp', 'Escape', 'Tab', ' '].includes(e.key)) e.stopPropagation();
      if (e.key == 'ArrowDown' || e.key == 'ArrowUp') {
        e.preventDefault();
        list[(at + (e.key == 'ArrowDown' ? 1 : list.length - 1)) % list.length].focus();
      } else if (e.key == ' ') {
        e.preventDefault();
        document.activeElement.click();
      } else if (e.key == 'Escape' || e.key == 'Tab') {
        if (e.key == 'Escape') e.preventDefault();
        closeMenu();
        if (opener) opener.focus();
      }
    };
    window.addEventListener('keydown', menuKeys, true);
    const outside = e => { if (!menu.contains(e.target)) closeMenu(); };
    document.addEventListener('click', outside);
    menu.addEventListener('click', e => {
      const item = e.target.closest('[data-action]');
      if (!item) return;
      e.preventDefault();
      closeMenu();
      const action = item.dataset.action;
      if (action == 'drag') {
        handle.hidden = !handle.hidden;
        item.textContent = handle.hidden ? 'Drag' : 'Pin';
      } else if (action == 'hide') {
        if (onHide) onHide();
      } else if (action == 'rename') {
        // The value the menu was opened on, or the first
        const cell = (row && row.isConnected ? row : null) || wrapper.querySelector('[data-value]');
        if (cell) cell.dispatchEvent(new Event('mt-rename'));
        return;
      } else if (action == 'expand') {
        const expand = item.textContent == 'Expand';
        wrapper.classList.toggle('expanded', expand);
        item.textContent = expand ? 'Contract' : 'Expand';
      } else if (action == 'counts' && onCounts) {
        onCounts();
      } else if (action == 'frequencies' && onFrequencies) {
        onFrequencies();
      }
      if (action != 'hide' && opener && opener.isConnected) opener.focus();
    });
    let offset = [0, 0];
    handle.addEventListener('mousedown', e => {
      e.preventDefault();
      const move = e => {
        offset = [offset[0] + e.movementX, offset[1] + e.movementY];
        wrapper.style.translate = offset[0] + 'px ' + offset[1] + 'px';
      };
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', () => document.removeEventListener('mousemove', move), { once: true });
    });
    return () => {
      document.removeEventListener('click', outside);
      window.removeEventListener('keydown', menuKeys, true);
    };
  };

  // A legend value you can rename (#185): double-click it, or focus it and press
  // F2 or Enter (or choose Rename in the table's menu). Enter keeps the new
  // name and Escape puts the old one back; the caller keeps the name on focusout.
  MT.renamable = cell => {
    let before = '';
    const start = () => {
      before = cell.textContent;
      cell.contentEditable = true;
      cell.focus();
      getSelection().selectAllChildren(cell);
    };
    cell.tabIndex = 0;
    cell.title = 'Double-click to rename';
    cell.setAttribute('aria-keyshortcuts', 'F2 Enter');
    cell.addEventListener('dblclick', start);
    cell.addEventListener('mt-rename', start);
    cell.addEventListener('keydown', e => {
      const editing = cell.isContentEditable;
      if (!editing && (e.key == 'F2' || e.key == 'Enter')) {
        e.preventDefault();
        start();
      } else if (editing && (e.key == 'Enter' || e.key == 'Escape')) {
        e.preventDefault();
        e.stopPropagation();
        if (e.key == 'Escape') cell.textContent = before;
        cell.blur();
        cell.focus();
      }
    });
    return start;
  };

  // A color table's controls: a header's sort button, and a row's
  // transparency button (which opens the shared slider)
  MT.sortButton = () => {
    const button = document.createElement('a');
    button.setAttribute('role', 'button');
    button.className = 'icon-action table-control ms-1';
    button.title = 'Sort';
    button.contentEditable = false; // inside an editable header
    button.innerHTML = '<span class="bi bi-arrow-down-up"></span>';
    return button;
  };
  MT.transparencyButton = '<a role="button" class="icon-action table-control ms-1" title="Transparency"><span class="bi bi-droplet-half"></span></a>';
  // Names a color or shape table row's controls for the value it's for, as in
  // "G0 color" and "G0 transparency"
  MT.nameRow = (row, value) => {
    const input = row.querySelector('input[type="color"]'), button = row.querySelector('.table-control'), select = row.querySelector('select');
    if (input) input.setAttribute('aria-label', value + ' color');
    if (button) button.setAttribute('aria-label', value + ' transparency');
    if (select) select.setAttribute('aria-label', value + ' shape');
  };

  // html5sortable, without the roles it gives the list and its items: it marks
  // them as a listbox's options, which they aren't (a table's rows, a list of
  // menus), and hides from assistive technology the controls inside them.
  MT.sortable = (element, options) => {
    const result = sortable(element, options);
    if (options != 'destroy') {
      element.removeAttribute('aria-dropeffect');
      element.querySelectorAll('[role="option"][aria-grabbed]').forEach(item => {
        item.removeAttribute('role');
        item.removeAttribute('aria-grabbed');
      });
    }
    return result;
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
    if (!self.layout || !layout.rootItem) return parkPanels();
    const views = layout.contentItems.filter(inFront)
      .sort((a, b) => (recentViews.indexOf(a) + 1 || Infinity) - (recentViews.indexOf(b) + 1 || Infinity));
    Object.entries(pagePanels).forEach(([kind, id]) => {
      const panel = document.getElementById(id);
      if (!panel) return;
      const host = views.find(item => (typeof item.panels == 'function' ? item.panels() : item.panels || []).includes(kind));
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

  // Wires the export dialog of a view drawn as an SVG. The dialog (inside root)
  // has fields named export-filename, -filetype, -scale and -quality,
  // an .export-advanced-button, an .export-dimensions readout and an .export-button. Image formats save getSVG(); `formats`
  // maps other file types to functions that save them, given the filename.
  MT.svgExport = (root, getSVG, settings, formats = {}, done) => {
    const $ = selector => root.querySelector(selector);
    const field = name => $(`[name="${name}"]`);
    const modal = $('.export-button').closest('.modal');
    MT.defaultFilename(field('export-filename'), () => exportName(root));
    const advancedButton = $('.export-advanced-button');
    const advanced = $(advancedButton.dataset.bsTarget);
    field('export-filetype').addEventListener('change', e => {
      const image = ['png', 'jpeg', 'webp'].includes(e.target.value);
      advancedButton.hidden = !image;
      if (!image) bootstrap.Collapse.getOrCreateInstance(advanced, { toggle: false }).hide();
    });
    const showDimensions = () => {
      const scale = parseFloat(field('export-scale').value);
      $('.export-dimensions').textContent = Math.round(root.clientWidth * scale) + 'x' + Math.round(root.clientHeight * scale) + 'px';
    };
    field('export-scale').addEventListener('input', showDimensions);
    modal.addEventListener('show.bs.modal', showDimensions);

    $('.export-button').addEventListener('click', () => {
      const filetype = field('export-filetype').value;
      const filename = MT.cleanFilename(field('export-filename').value, [filetype, 'jpg', 'png', 'jpeg', 'webp', 'svg'], ['microbetrace', exportName(root), MT.today()].filter(Boolean).join('-'));
      if (formats[filetype]) return formats[filetype](filename);
      const svg = getSVG();
      if (filetype == 'svg') {
        MT.saveAs(new Blob([MT.unparseSVG(svg)], { type: 'image/svg+xml;charset=utf-8' }), filename + '.' + filetype);
        if (done) done(svg);
      } else {
        MT.svgImage(svg, {
          scale: parseFloat(field('export-scale').value),
          backgroundColor: settings.get('background-color'),
          type: 'image/' + filetype,
          quality: parseFloat(field('export-quality').value)
        }).then(blob => MT.saveImage(blob, filename + '.' + filetype), error => {
          console.error(error);
          MT.toast.error('The image could not be made (' + error.message + '). Try a smaller scale.');
        }).finally(() => {
          if (done) done(svg);
        });
      }
    });
  };

  // The export dialog of a view drawn with Plotly (see MT.svgExport)
  MT.plotExport = (root, plot, settings, formats = {}) => MT.svgExport(root, () => {
    const svg = plot.querySelector('.main-svg');
    // Plotly draws axis titles in a second SVG layer; bring them into this one
    const titles = plot.querySelector('.main-svg .infolayer');
    if (titles) svg.appendChild(titles);
    return svg;
  }, settings, formats);

  // The online tile layers the map views offer
  MT.tileLayers = () => ({
    basemap: L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20
    }),
    satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles &copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community',
      maxZoom: 19
    })
  });

  // Adds a map's layer and removes it, as `show` says
  MT.showLayer = (map, layer, show) => {
    if (!layer) return;
    if (show && !map.hasLayer(layer)) layer.addTo(map);
    if (!show && map.hasLayer(layer)) layer.remove();
  };

  // Lets the user add GeoJSON files to a map: each file chosen with `input` is
  // given to add(data, color), which draws it and returns { setColor(color),
  // remove() }. Each is listed in `list` with a color picker and a remove
  // button.
  MT.geoJSONUpload = (input, list, add, color = '#000000') => {
    input.addEventListener('change', () => {
      Array.from(input.files).forEach(file => {
        if (!/\.(geo)?json$/i.test(file.name)) return MT.toast.error('"' + MT.escape(file.name) + '" is not a GeoJSON file. Choose a file ending in .geojson or .json.');
        file.text().then(text => {
          const layer = add(JSON.parse(text), color);
          const name = document.createElement('div'), remove = document.createElement('a'), colorCell = document.createElement('div'), picker = document.createElement('input');
          name.className = 'col-9';
          name.textContent = file.name.split('.').slice(0, -1).join('.');
          remove.href = '#';
          remove.className = 'icon-action bi bi-x-circle align-middle p-1';
          remove.title = 'Remove this file';
          name.prepend(remove);
          colorCell.className = 'col-3';
          picker.type = 'color';
          picker.className = 'w-100';
          picker.value = color;
          colorCell.append(picker);
          picker.addEventListener('change', () => layer.setColor(picker.value));
          remove.addEventListener('click', e => {
            e.preventDefault();
            name.remove();
            colorCell.remove();
            layer.remove();
          });
          list.append(name, colorCell);
        });
      });
      input.value = '';
    });
  };

  // MT.geoJSONUpload onto a Leaflet map. Returns the set of the added layers.
  MT.leafletGeoJSONUpload = (input, list, map) => {
    const added = new Set();
    MT.geoJSONUpload(input, list, (data, color) => {
      const layer = L.geoJSON(data, { color, weight: 0.75, fillColor: '#fafaf8', fillOpacity: 0.5 }).addTo(map);
      added.add(layer);
      return {
        setColor: color => layer.setStyle({ color }),
        remove: () => { layer.remove(); added.delete(layer); }
      };
    });
    return added;
  };

  // Placing nodes on a map. The kinds of location field, from the least
  // precise to the most: a node takes the most precise location it has.
  MT.locationKinds = ['country', 'state', 'county', 'zipcode', 'tract'];

  // With none of a view's location fields (prefix + kind) chosen, node fields
  // named for them are used
  MT.pickLocationFields = (settings, prefix) => {
    const kinds = [...MT.locationKinds, 'lat', 'lon'];
    if (kinds.some(kind => ![undefined, null, 'None'].includes(settings.get(prefix + kind)))) return;
    kinds.forEach(kind => {
      if (session.data.nodeFields.includes(kind)) settings.set(prefix + kind, kind);
    });
  };

  // Where each of `nodes` is, as a Map of _id to [lat, lon]. field(kind) is
  // the node field holding that kind of location (or a latitude, 'lat', or
  // longitude, 'lon'), or null.
  MT.locateNodes = async (nodes, field) => {
    const files = {
      countries: field('country') && 'countries.json',
      states: (field('state') || field('county')) && 'states.json',
      counties: field('county') && 'counties.json',
      zipcodes: field('zipcode') && 'zipcodes.csv',
      tracts: field('tract') && 'tracts.csv'
    };
    const data = {};
    await Promise.all(Object.entries(files).filter(([, file]) => file).map(([name, file]) => MT.getMapData(file).then(rows => data[name] = rows)));

    // Each map file, indexed by the values that match its places
    const index = (rows, keys) => {
      const index = new Map();
      rows.forEach(row => keys(row).forEach(k => {
        if (k != null && k === k && k !== '') index.set(String(k), row);
      }));
      return index;
    };
    const lookup = (index, value) => {
      if (value == null || value === '') return;
      const number = parseFloat(value);
      return index.get(String(value)) || (isFinite(number) && index.get(String(number))) || undefined;
    };
    const at = place => place && [parseFloat(place._lat), parseFloat(place._lon)];
    const coordinate = (value, negative) => typeof value == 'string' ? (value.toUpperCase().includes(negative) ? -1 : 1) * parseFloat(value) : value;

    const places = {};
    if (data.countries) {
      const i = index(data.countries.features, f => [f.id, f.properties.name]);
      places.country = d => { const c = lookup(i, d[field('country')]); return c && at(c.properties); };
    }
    let stateOf = () => undefined;
    if (data.states) {
      const i = index(data.states.features, f => [f.properties.usps, f.properties.name, f.properties.name.toLowerCase()]);
      stateOf = d => {
        const v = field('state') && d[field('state')];
        if (v == null || v === '') return;
        return lookup(i, v) || lookup(i, String(v).toUpperCase()) || lookup(i, String(v).toLowerCase());
      };
      if (field('state')) places.state = d => { const s = stateOf(d); return s && at(s.properties); };
    }
    if (data.counties) {
      const i = index(data.counties.features, f => [f.properties.fips]);
      places.county = d => {
        const v = d[field('county')];
        let county = lookup(i, v);
        // Otherwise by name, within the node's state
        if (!county && typeof v == 'string' && v) {
          const state = stateOf(d), name = v.toLowerCase();
          if (state) county = data.counties.features.find(c => c.properties.state == state.properties.usps &&
            (c.properties.name.includes(name) || name.includes(c.properties.name)));
        }
        return county && at(county.properties);
      };
    }
    if (data.zipcodes) {
      const i = index(data.zipcodes, z => [z.zipcode]);
      places.zipcode = d => at(lookup(i, d[field('zipcode')]));
    }
    if (data.tracts) {
      const i = index(data.tracts, t => [t.tract]);
      places.tract = d => at(lookup(i, d[field('tract')]));
    }
    const lat = field('lat'), lon = field('lon');
    const positions = new Map();
    nodes.forEach(d => {
      let position;
      MT.locationKinds.forEach(kind => {
        const p = places[kind] && places[kind](d);
        if (p && isFinite(p[0]) && isFinite(p[1])) position = p;
      });
      if (lat && lon) {
        const p = [coordinate(d[lat], 'S'), coordinate(d[lon], 'W')];
        if (typeof p[0] == 'number' && typeof p[1] == 'number' && isFinite(p[0]) && isFinite(p[1])) position = p;
      }
      if (position) positions.set(d._id, position);
    });
    return positions;
  };

  // Random offsets for map positions, as the jitter setting (a power of 2, or
  // -2 for none) says. at(id, [lat, lon]) moves a position; reroll() picks new
  // offsets.
  MT.jitterer = amount => {
    const offsets = new Map();
    return {
      at(id, [lat, lon]) {
        const scale = amount() == -2 ? 0 : Math.pow(2, amount());
        if (!scale) return [lat, lon];
        if (!offsets.has(id)) offsets.set(id, [MT.r01() * Math.PI * 2, MT.r01()]);
        const [theta, j] = offsets.get(id);
        return [lat + scale * j * Math.sin(theta), lon + scale * j * Math.cos(theta)];
      },
      reroll: () => offsets.clear()
    };
  };

  // Reads a date field (see src/dates.js): null if it is not a date.
  MT.parseDate = MTDates.parseDate;

  // Downloads a Blob as a file
  MT.saveAs = (blob, filename) => {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    // Some browsers read the URL after the click returns
    setTimeout(() => URL.revokeObjectURL(link.href), 60000);
  };

  // Papa.unparse with the settings every export needs. escapeFormulae stops a
  // cell such as =HYPERLINK(...) from being evaluated when a spreadsheet opens
  // the file. Rows that are objects get the union of their keys as columns, in
  // first-seen order (Papa would use the first row's alone), unless opts.columns
  // says otherwise. Rows that are arrays, or {fields, data}, pass through.
  MT.toCSV = (rows, opts = {}) => {
    const config = { escapeFormulae: true, ...opts };
    if (Array.isArray(rows) && !config.columns && rows.some(r => r && typeof r == 'object' && !Array.isArray(r))) {
      const seen = new Set();
      rows.forEach(r => { if (r && typeof r == 'object') Object.keys(r).forEach(k => seen.add(k)); });
      config.columns = Array.from(seen);
    }
    return Papa.unparse(rows, config);
  };

  // Saves an image Blob; a null one (canvas.toBlob gives null for a canvas too
  // large to encode) is reported to the user instead of thrown.
  MT.saveImage = (blob, filename) => {
    if (!blob) {
      MT.toast.error('The image could not be made. It may be too large: try a smaller scale.');
      return false;
    }
    MT.saveAs(blob, filename);
    return true;
  };

  // Loads an image, crossOrigin so that drawing it leaves a canvas readable.
  // Resolves to null if it doesn't load.
  const loadImage = src => new Promise(resolve => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });

  const blobToDataURL = blob => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  // Draws an SVG element as a raster image, as a Blob. An SVG drawn as an
  // image can't reach the page, so the stylesheet rules that apply inside it
  // and the images it links are copied into it first.
  MT.svgImage = async (svg, { scale = 1, backgroundColor, type = 'image/png', quality } = {}) => {
    const box = svg.getBoundingClientRect();
    const width = box.width || parseFloat(svg.getAttribute('width')), height = box.height || parseFloat(svg.getAttribute('height'));
    const copy = svg.cloneNode(true);
    copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    if (!copy.getAttribute('viewBox')) copy.setAttribute('viewBox', `0 0 ${width} ${height}`);
    copy.setAttribute('width', width * scale);
    copy.setAttribute('height', height * scale);

    let css = '';
    for (const sheet of document.styleSheets) {
      let rules;
      try { rules = sheet.cssRules; } catch (e) { continue; } // another origin's
      for (const rule of rules || []) {
        if (!rule.selectorText) continue;
        try {
          if (svg.matches(rule.selectorText) || svg.querySelector(rule.selectorText)) css += rule.cssText + '\n';
        } catch (e) { /* a selector this browser can't match, like ::-moz- */ }
      }
    }
    if (css) {
      const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
      style.textContent = css;
      copy.insertBefore(style, copy.firstChild);
    }

    await Promise.all(Array.from(copy.querySelectorAll('image')).map(async image => {
      const href = image.getAttribute('href') || image.getAttribute('xlink:href');
      if (!href || href.startsWith('data:')) return;
      try {
        const data = await blobToDataURL(await (await fetch(href)).blob());
        image.setAttribute('href', data);
        image.removeAttribute('xlink:href');
      } catch (e) {
        image.remove();
      }
    }));

    // A data URL, since the page's Content Security Policy refuses blob: images
    const image = await loadImage('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(copy)));
    if (!image) throw new Error('The SVG could not be drawn');
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const context = canvas.getContext('2d');
    if (backgroundColor) {
      context.fillStyle = backgroundColor;
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return new Promise(resolve => canvas.toBlob(resolve, type, quality));
  };

  // Saves an image of a Leaflet map: its background, its tiles, the vector
  // layers it draws on canvases, and its image markers, in the order Leaflet
  // stacks them.
  // draw(context, canvas), if given, adds to the image before it is saved.
  MT.mapImage = async (map, filename, filetype, draw) => {
    const container = map.getContainer(), box = container.getBoundingClientRect();
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(box.width);
    canvas.height = Math.round(box.height);
    const context = canvas.getContext('2d');
    // The map's own background, where no layer covers it
    context.fillStyle = getComputedStyle(container).backgroundColor;
    context.fillRect(0, 0, canvas.width, canvas.height);
    const layers = Array.from(container.querySelector('.leaflet-map-pane').querySelectorAll('img.leaflet-tile-loaded, canvas, img.leaflet-marker-icon'));
    // Tiles come from other servers: load them again, asking for CORS, so the
    // canvas can still be saved. Tiles that won't load that way are left out.
    const images = await Promise.all(layers.map(el => el.tagName == 'IMG' ? loadImage(el.src) : el));
    layers.forEach((el, i) => {
      const image = images[i], rect = el.getBoundingClientRect();
      if (!image || !rect.width || !rect.height) return;
      const layer = el.closest('.leaflet-layer');
      context.globalAlpha = layer ? parseFloat(getComputedStyle(layer).opacity) : 1;
      context.drawImage(image, rect.left - box.left, rect.top - box.top, rect.width, rect.height);
    });
    context.globalAlpha = 1;
    if (draw) draw(context, canvas);
    canvas.toBlob(blob => MT.saveImage(blob, filename + '.' + filetype), 'image/' + filetype);
  };

  // Shows the shared tooltip at a mouse event, or hides it (html == null)
  MT.tooltip = (html, event) => {
    const tooltip = document.getElementById('tooltip');
    if (html == null) {
      tooltip.style.opacity = 0;
      tooltip.style.zIndex = -1;
      return;
    }
    tooltip.innerHTML = html;
    tooltip.style.left = (event.clientX + 8) + 'px';
    tooltip.style.top = (event.clientY + 18) + 'px';
    tooltip.style.zIndex = 1001;
    tooltip.style.opacity = 1;
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
    const nodes = () => session.data.nodes.filter(d => d.visible !== false).length;
    const links = () => session.data.links.filter(d => d.visible !== false).length;
    const refresh = () => {
      let text = '';
      try { text = summary ? summary({ nodes: nodes(), links: links() }) : ''; } catch (e) { /* the name stands alone */ }
      note.textContent = (text ? text + ' ' : '') + 'The Table view lists the same data.';
    };
    refresh();
    const events = MT.events, names = ['node-visibility', 'link-visibility', 'session-loaded'];
    const offs = names.map(n => events.on(n, refresh));
    return () => { offs.forEach(off => typeof off == 'function' && off()); note.remove(); };
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
    const mount = MT.views[contentItem.componentType];
    if (!mount) return;
    const container = contentItem.container;
    const handle = mount(container.element, { settings: MT.settings, events: MT.events, container }) || {};
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
    if (!temp.componentCache[view]) {
      fetchView(view).then(() => MT.launchView(view, callback), viewFailed);
    } else {
      let contentItem = layout.contentItems.find(item => item.componentType == view);
      if (contentItem) {
        contentItem.parent.setActiveComponentItem(contentItem, true);
        setupView(contentItem);
      } else {
        if (!layout.rootItem) layout.loadLayout(emptyLayout);
        let lastStack = peek(stacks(layout.rootItem)) || layout.rootItem;
        contentItem = lastStack.newComponent(view, undefined, MT.titleize(view));
        renderView(contentItem);
        setupView(contentItem);
        mountView(contentItem);
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
    fill("select.nodeVariables", session.data.nodeFields);
    fill("select.linkVariables", session.data.linkFields);
    element.querySelectorAll("select.mixedVariables").forEach(select => {
      MT.fillSelect(select, session.data.linkFields, { none: true, prefix: "links-", label: "Link " });
      MT.fillSelect(select, session.data.nodeFields, { prefix: "nodes-", label: "Node ", append: true });
    });
    fill("select.branch-variables", ["id", "depth", "height", "length", "value"]);
    element.querySelectorAll(".launch-color-options").forEach(button => button.addEventListener("click", MT.showColorOptions));
    if (navigator.onLine) MT.showOnline(element);
    MT.updateViewNeeds(contentItem);
  };

  // Shows the parts of a page that need the internet
  MT.showOnline = element => element.querySelectorAll(".ifOnline").forEach(el => {
    el.style.display = el.classList.contains("row") ? "flex" : "block";
  });

  // Loads the demo outbreak, as the #demo address does
  MT.loadDemo = () => fetch("demo/Demo_outbreak_session.microbetrace")
    .then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
    .then(MT.applySession)
    .catch(error => {
      console.error(error);
      MT.toast.error(navigator.onLine ? "The demo data couldn't be loaded." : "The demo data couldn't be loaded. This browser is offline and hasn't saved it yet.");
    });

  // What each view needs of the session. A view lacking it opens with a short
  // note (see MT.updateViewNeeds) saying what to add, rather than blank. Each
  // entry returns the note's text, or "" when the session has what the view needs.
  const hasLinks = () => session.data.graph.edgeCount > 0;
  const hasSequences = () => session.data.nodes.some(d => d.seq);
  const FILES_HINT = "Add them in the Files view (the File menu's Add Data).";
  const chosenField = key => { const v = MT.settings.get(key); return v != null && v != "None" && v !== ""; };
  const MAP_NEEDS = name => "The " + name + " places nodes by latitude and longitude columns, or by country, state, county, zipcode or census tract. Choose the columns that hold them in this view's settings (the gear). If the data has none, add a node list that does.";
  MT.viewNeeds = {
    sequences: () => hasSequences() ? "" : "This view lines up nodes' sequences, and none of these nodes has one. Add a FASTA file, or a node list with a sequence column. " + FILES_HINT,
    phylogenetic_tree: () => hasLinks() || hasSequences() || session.files.some(f => f.format == "newick") ? "" :
      "A tree needs sequences, a distance matrix, or a Newick tree file. " + FILES_HINT,
    heatmap: () => hasLinks() || hasSequences() ? "" : "The heatmap draws the distances between nodes, which needs sequences (a FASTA file) or a distance matrix. " + FILES_HINT,
    waterfall: () => hasLinks() ? "" : "This view lists each cluster's links, and there are none. Links come from a link list, a distance matrix, or sequences close enough to link. " + FILES_HINT,
    geo_map: () => MT.settingsHaveLocation("map-field-") ? "" : MAP_NEEDS("map"),
    globe: () => MT.settingsHaveLocation("globe-field-") ? "" : MAP_NEEDS("globe"),
    choropleth: () => chosenField("choropleth-aggregate-on") ? "" :
      "The choropleth shades regions by how many nodes are in each, so it needs a column of countries, states or counties. Choose it in this view's settings (the gear), or load a GeoJSON file there. If the data has none, add a node list that does.",
    timeline: () => MT.dateFields(session.data.nodes, session.data.nodeFields).length || chosenField("timeline-date-field") ? "" :
      "The epi curve counts nodes by date, and no column holds dates. Add a node list with a date column. " + FILES_HINT,
    gantt: () => MT.dateFields(session.data.nodes, session.data.nodeFields).length || (MT.settings.get("gantt-dates") || []).length ? "" :
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
    if (!session.data.nodes.length) {
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
    const empty = !session.data.nodes.length;
    note.querySelector(".view-needs-title").textContent = empty ? "No data yet" : MT.titleize(view) + " needs more data";
    note.querySelector(".view-needs-text").textContent = text;
    // The demo replaces the session, so only an empty one offers it
    note.querySelector(".view-needs-demo").hidden = !empty;
  };
  MT.updateAllViewNeeds = () => layout.contentItems.forEach(MT.updateViewNeeds);

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
      layout.loadLayout(Object.assign({}, emptyLayout, { root }));
      layout.contentItems.forEach(item => {
        renderView(item);
        setupView(item);
        mountView(item);
      });
    }, viewFailed);
  };
  
  MT.unparseSVG = svgNode => {
    svgNode.setAttribute("xlink", "http://www.w3.org/1999/xlink");
    let selectorTextArr = [];
  
    // Add Parent element Id and Classes to the list
    selectorTextArr.push("#" + svgNode.id);
    let nClasses = svgNode.classList.length;
    for (let c = 0; c < nClasses; c++) {
      if (!("." + svgNode.classList[c]).includes(selectorTextArr)) {
        selectorTextArr.push("." + svgNode.classList[c]);
      }
    }
  
    // Add Children element Ids and Classes to the list
    let nodes = svgNode.getElementsByTagName("*");
    let nNodes = nodes.length;
    for (let i = 0; i < nNodes; i++) {
      let id = nodes[i]._id;
      if (!("#" + id).includes(selectorTextArr)) {
        selectorTextArr.push("#" + id);
      }
      let classes = nodes[i].classList;
      for (let d = 0; d < classes.length; d++) {
        if (!("." + classes[d]).includes(selectorTextArr)) {
          selectorTextArr.push("." + classes[d]);
        }
      }
    }
  
    // Extract CSS Rules
    let extractedCSSText = "";
    let nStylesheets = document.styleSheets.length;
    for (let j = 0; j < nStylesheets; j++) {
      let s = document.styleSheets[j];
      try {
        if (!s.cssRules) continue;
      } catch (e) {
        if (e.name !== "SecurityError") throw e; // for Firefox
        continue;
      }
      let cssRules = s.cssRules;
      let nRules = cssRules.length;
      for (let r = 0; r < nRules; r++) {
        let rule = cssRules[r];
        if (!rule.selectorText) continue;
        if (rule.selectorText.includes(selectorTextArr)) {
          extractedCSSText += rule.cssText;
        }
        if (rule.selectorText == 'body') {  // issue #110
          extractedCSSText += rule.cssText.replace("body" , "text");;
        }
        // if (rule.selectorText == '.nodes path.selected') {  // issue #156
        //   extractedCSSText += rule.cssText;
        // }
      }
    }
    
    extractedCSSText += ".nodes path.selected { stroke: rgb(255, 131, 0); stroke-width: 4px; }";  // issue #201

    let styleElement = document.createElement("style");
    styleElement.setAttribute("type", "text/css");
    styleElement.innerHTML = extractedCSSText;
    let refNode = svgNode.hasChildNodes() ? svgNode.children[0] : null;
    svgNode.insertBefore(styleElement, refNode);
    let serializer = new XMLSerializer();
    return serializer.serializeToString(svgNode);
  };
  
  MT.exportHIVTRACE = () => {
    let links = MT.getVisibleLinks();
    let geneticLinks = links.filter(l => l.origin.includes("Genetic Distance"));
    let sequences = new Set(
      geneticLinks.map(l => l.source).concat(
      geneticLinks.map(l => l.target))
    ).size;
    let pas = {};
    session.data.nodes.forEach(d => {
      Object.keys(d).forEach(key => {
        if (pas[key]) return;
        pas[key] = {
          label: key,
          type: MT.titleize(typeof d[key])
        };
      });
    });
    return JSON.stringify(
      {
        trace_results: {
          "Cluster sizes": session.data.clusters.map(c => c.size),
          Degrees: {
            Distribution: [],
            Model: "Waring",
            fitted: [],
            rho: 0,
            "rho CI": [-1, 1]
          },
          "Directed Edges": {
            Count: 0,
            "Reasons for unresolved directions": {
              "Missing dates": links.length
            }
          },
          "Edge Stages": {},
          Edges: links.map(l => ({
            attributes: ["BULK"],
            directed: false,
            length: l[session.style.widgets["link-sort-variable"]],
            removed: false,
            sequences: [l.source, l.target],
            source: session.data.nodes.findIndex(d => d._id == l.source),
            support: 0,
            target: session.data.nodes.findIndex(d => d._id == l.target)
          })),
          "HIV Stages": {
            "A-1": 0,
            "A-2": 0,
            "A-3": 0,
            Chronic: session.data.nodes.length,
            "E-1": 0,
            "E-2": 0,
            "E-3": 0
          },
          "Multiple sequences": {
            "Followup, days": null,
            "Subjects with": 0
          },
          "Network Summary": {
            Clusters: session.data.clusters.length,
            Edges: links.length,
            Nodes: session.data.nodes.length,
            "Sequences used to make links": sequences
          },
          Nodes: session.data.nodes.map(d => ({
            attributes: [],
            baseline: null,
            cluster: d.cluster,
            edi: null,
            id: d._id,
            patient_attributes: d
          })),
          patient_attribute_schema: pas,
          Settings: {
            "contaminant-ids": [],
            contaminants: "remove",
            "edge-filtering": "remove",
            threshold: session.style.widgets["link-threshold"]
          }
        }
      },
      null,
      2
    );
  };
  
  MT.size = thing => {
    if(!thing) thing = session;
    return (JSON.stringify(thing).length/1024/1024).toLocaleString()+'MB';
  };
  
  MT.HXB2 = "TGGAAGGGCTAATTCACTCCCAACGAAGACAAGATATCCTTGATCTGTGGATCTACCACACACAAGGCTACTTCCCTGATTAGCAGAACTACACACCAGGGCCAGGGATCAGATATCCACTGACCTTTGGATGGTGCTACAAGCTAGTACCAGTTGAGCCAGAGAAGTTAGAAGAAGCCAACAAAGGAGAGAACACCAGCTTGTTACACCCTGTGAGCCTGCATGGAATGGATGACCCGGAGAGAGAAGTGTTAGAGTGGAGGTTTGACAGCCGCCTAGCATTTCATCACATGGCCCGAGAGCTGCATCCGGAGTACTTCAAGAACTGCTGACATCGAGCTTGCTACAAGGGACTTTCCGCTGGGGACTTTCCAGGGAGGCGTGGCCTGGGCGGGACTGGGGAGTGGCGAGCCCTCAGATCCTGCATATAAGCAGCTGCTTTTTGCCTGTACTGGGTCTCTCTGGTTAGACCAGATCTGAGCCTGGGAGCTCTCTGGCTAACTAGGGAACCCACTGCTTAAGCCTCAATAAAGCTTGCCTTGAGTGCTTCAAGTAGTGTGTGCCCGTCTGTTGTGTGACTCTGGTAACTAGAGATCCCTCAGACCCTTTTAGTCAGTGTGGAAAATCTCTAGCAGTGGCGCCCGAACAGGGACCTGAAAGCGAAAGGGAAACCAGAGGAGCTCTCTCGACGCAGGACTCGGCTTGCTGAAGCGCGCACGGCAAGAGGCGAGGGGCGGCGACTGGTGAGTACGCCAAAAATTTTGACTAGCGGAGGCTAGAAGGAGAGAGATGGGTGCGAGAGCGTCAGTATTAAGCGGGGGAGAATTAGATCGATGGGAAAAAATTCGGTTAAGGCCAGGGGGAAAGAAAAAATATAAATTAAAACATATAGTATGGGCAAGCAGGGAGCTAGAACGATTCGCAGTTAATCCTGGCCTGTTAGAAACATCAGAAGGCTGTAGACAAATACTGGGACAGCTACAACCATCCCTTCAGACAGGATCAGAAGAACTTAGATCATTATATAATACAGTAGCAACCCTCTATTGTGTGCATCAAAGGATAGAGATAAAAGACACCAAGGAAGCTTTAGACAAGATAGAGGAAGAGCAAAACAAAAGTAAGAAAAAAGCACAGCAAGCAGCAGCTGACACAGGACACAGCAATCAGGTCAGCCAAAATTACCCTATAGTGCAGAACATCCAGGGGCAAATGGTACATCAGGCCATATCACCTAGAACTTTAAATGCATGGGTAAAAGTAGTAGAAGAGAAGGCTTTCAGCCCAGAAGTGATACCCATGTTTTCAGCATTATCAGAAGGAGCCACCCCACAAGATTTAAACACCATGCTAAACACAGTGGGGGGACATCAAGCAGCCATGCAAATGTTAAAAGAGACCATCAATGAGGAAGCTGCAGAATGGGATAGAGTGCATCCAGTGCATGCAGGGCCTATTGCACCAGGCCAGATGAGAGAACCAAGGGGAAGTGACATAGCAGGAACTACTAGTACCCTTCAGGAACAAATAGGATGGATGACAAATAATCCACCTATCCCAGTAGGAGAAATTTATAAAAGATGGATAATCCTGGGATTAAATAAAATAGTAAGAATGTATAGCCCTACCAGCATTCTGGACATAAGACAAGGACCAAAGGAACCCTTTAGAGACTATGTAGACCGGTTCTATAAAACTCTAAGAGCCGAGCAAGCTTCACAGGAGGTAAAAAATTGGATGACAGAAACCTTGTTGGTCCAAAATGCGAACCCAGATTGTAAGACTATTTTAAAAGCATTGGGACCAGCGGCTACACTAGAAGAAATGATGACAGCATGTCAGGGAGTAGGAGGACCCGGCCATAAGGCAAGAGTTTTGGCTGAAGCAATGAGCCAAGTAACAAATTCAGCTACCATAATGATGCAGAGAGGCAATTTTAGGAACCAAAGAAAGATTGTTAAGTGTTTCAATTGTGGCAAAGAAGGGCACACAGCCAGAAATTGCAGGGCCCCTAGGAAAAAGGGCTGTTGGAAATGTGGAAAGGAAGGACACCAAATGAAAGATTGTACTGAGAGACAGGCTAATTTTTTAGGGAAGATCTGGCCTTCCTACAAGGGAAGGCCAGGGAATTTTCTTCAGAGCAGACCAGAGCCAACAGCCCCACCAGAAGAGAGCTTCAGGTCTGGGGTAGAGACAACAACTCCCCCTCAGAAGCAGGAGCCGATAGACAAGGAACTGTATCCTTTAACTTCCCTCAGGTCACTCTTTGGCAACGACCCCTCGTCACAATAAAGATAGGGGGGCAACTAAAGGAAGCTCTATTAGATACAGGAGCAGATGATACAGTATTAGAAGAAATGAGTTTGCCAGGAAGATGGAAACCAAAAATGATAGGGGGAATTGGAGGTTTTATCAAAGTAAGACAGTATGATCAGATACTCATAGAAATCTGTGGACATAAAGCTATAGGTACAGTATTAGTAGGACCTACACCTGTCAACATAATTGGAAGAAATCTGTTGACTCAGATTGGTTGCACTTTAAATTTTCCCATTAGCCCTATTGAGACTGTACCAGTAAAATTAAAGCCAGGAATGGATGGCCCAAAAGTTAAACAATGGCCATTGACAGAAGAAAAAATAAAAGCATTAGTAGAAATTTGTACAGAGATGGAAAAGGAAGGGAAAATTTCAAAAATTGGGCCTGAAAATCCATACAATACTCCAGTATTTGCCATAAAGAAAAAAGACAGTACTAAATGGAGAAAATTAGTAGATTTCAGAGAACTTAATAAGAGAACTCAAGACTTCTGGGAAGTTCAATTAGGAATACCACATCCCGCAGGGTTAAAAAAGAAAAAATCAGTAACAGTACTGGATGTGGGTGATGCATATTTTTCAGTTCCCTTAGATGAAGACTTCAGGAAGTATACTGCATTTACCATACCTAGTATAAACAATGAGACACCAGGGATTAGATATCAGTACAATGTGCTTCCACAGGGATGGAAAGGATCACCAGCAATATTCCAAAGTAGCATGACAAAAATCTTAGAGCCTTTTAGAAAACAAAATCCAGACATAGTTATCTATCAATACATGGATGATTTGTATGTAGGATCTGACTTAGAAATAGGGCAGCATAGAACAAAAATAGAGGAGCTGAGACAACATCTGTTGAGGTGGGGACTTACCACACCAGACAAAAAACATCAGAAAGAACCTCCATTCCTTTGGATGGGTTATGAACTCCATCCTGATAAATGGACAGTACAGCCTATAGTGCTGCCAGAAAAAGACAGCTGGACTGTCAATGACATACAGAAGTTAGTGGGGAAATTGAATTGGGCAAGTCAGATTTACCCAGGGATTAAAGTAAGGCAATTATGTAAACTCCTTAGAGGAACCAAAGCACTAACAGAAGTAATACCACTAACAGAAGAAGCAGAGCTAGAACTGGCAGAAAACAGAGAGATTCTAAAAGAACCAGTACATGGAGTGTATTATGACCCATCAAAAGACTTAATAGCAGAAATACAGAAGCAGGGGCAAGGCCAATGGACATATCAAATTTATCAAGAGCCATTTAAAAATCTGAAAACAGGAAAATATGCAAGAATGAGGGGTGCCCACACTAATGATGTAAAACAATTAACAGAGGCAGTGCAAAAAATAACCACAGAAAGCATAGTAATATGGGGAAAGACTCCTAAATTTAAACTGCCCATACAAAAGGAAACATGGGAAACATGGTGGACAGAGTATTGGCAAGCCACCTGGATTCCTGAGTGGGAGTTTGTTAATACCCCTCCCTTAGTGAAATTATGGTACCAGTTAGAGAAAGAACCCATAGTAGGAGCAGAAACCTTCTATGTAGATGGGGCAGCTAACAGGGAGACTAAATTAGGAAAAGCAGGATATGTTACTAATAGAGGAAGACAAAAAGTTGTCACCCTAACTGACACAACAAATCAGAAGACTGAGTTACAAGCAATTTATCTAGCTTTGCAGGATTCGGGATTAGAAGTAAACATAGTAACAGACTCACAATATGCATTAGGAATCATTCAAGCACAACCAGATCAAAGTGAATCAGAGTTAGTCAATCAAATAATAGAGCAGTTAATAAAAAAGGAAAAGGTCTATCTGGCATGGGTACCAGCACACAAAGGAATTGGAGGAAATGAACAAGTAGATAAATTAGTCAGTGCTGGAATCAGGAAAGTACTATTTTTAGATGGAATAGATAAGGCCCAAGATGAACATGAGAAATATCACAGTAATTGGAGAGCAATGGCTAGTGATTTTAACCTGCCACCTGTAGTAGCAAAAGAAATAGTAGCCAGCTGTGATAAATGTCAGCTAAAAGGAGAAGCCATGCATGGACAAGTAGACTGTAGTCCAGGAATATGGCAACTAGATTGTACACATTTAGAAGGAAAAGTTATCCTGGTAGCAGTTCATGTAGCCAGTGGATATATAGAAGCAGAAGTTATTCCAGCAGAAACAGGGCAGGAAACAGCATATTTTCTTTTAAAATTAGCAGGAAGATGGCCAGTAAAAACAATACATACTGACAATGGCAGCAATTTCACCGGTGCTACGGTTAGGGCCGCCTGTTGGTGGGCGGGAATCAAGCAGGAATTTGGAATTCCCTACAATCCCCAAAGTCAAGGAGTAGTAGAATCTATGAATAAAGAATTAAAGAAAATTATAGGACAGGTAAGAGATCAGGCTGAACATCTTAAGACAGCAGTACAAATGGCAGTATTCATCCACAATTTTAAAAGAAAAGGGGGGATTGGGGGGTACAGTGCAGGGGAAAGAATAGTAGACATAATAGCAACAGACATACAAACTAAAGAATTACAAAAACAAATTACAAAAATTCAAAATTTTCGGGTTTATTACAGGGACAGCAGAAATCCACTTTGGAAAGGACCAGCAAAGCTCCTCTGGAAAGGTGAAGGGGCAGTAGTAATACAAGATAATAGTGACATAAAAGTAGTGCCAAGAAGAAAAGCAAAGATCATTAGGGATTATGGAAAACAGATGGCAGGTGATGATTGTGTGGCAAGTAGACAGGATGAGGATTAGAACATGGAAAAGTTTAGTAAAACACCATATGTATGTTTCAGGGAAAGCTAGGGGATGGTTTTATAGACATCACTATGAAAGCCCTCATCCAAGAATAAGTTCAGAAGTACACATCCCACTAGGGGATGCTAGATTGGTAATAACAACATATTGGGGTCTGCATACAGGAGAAAGAGACTGGCATTTGGGTCAGGGAGTCTCCATAGAATGGAGGAAAAAGAGATATAGCACACAAGTAGACCCTGAACTAGCAGACCAACTAATTCATCTGTATTACTTTGACTGTTTTTCAGACTCTGCTATAAGAAAGGCCTTATTAGGACACATAGTTAGCCCTAGGTGTGAATATCAAGCAGGACATAACAAGGTAGGATCTCTACAATACTTGGCACTAGCAGCATTAATAACACCAAAAAAGATAAAGCCACCTTTGCCTAGTGTTACGAAACTGACAGAGGATAGATGGAACAAGCCCCAGAAGACCAAGGGCCACAGAGGGAGCCACACAATGAATGGACACTAGAGCTTTTAGAGGAGCTTAAGAATGAAGCTGTTAGACATTTTCCTAGGATTTGGCTCCATGGCTTAGGGCAACATATCTATGAAACTTATGGGGATACTTGGGCAGGAGTGGAAGCCATAATAAGAATTCTGCAACAACTGCTGTTTATCCATTTTCAGAATTGGGTGTCGACATAGCAGAATAGGCGTTACTCGACAGAGGAGAGCAAGAAATGGAGCCAGTAGATCCTAGACTAGAGCCCTGGAAGCATCCAGGAAGTCAGCCTAAAACTGCTTGTACCAATTGCTATTGTAAAAAGTGTTGCTTTCATTGCCAAGTTTGTTTCATAACAAAAGCCTTAGGCATCTCCTATGGCAGGAAGAAGCGGAGACAGCGACGAAGAGCTCATCAGAACAGTCAGACTCATCAAGCTTCTCTATCAAAGCAGTAAGTAGTACATGTAACGCAACCTATACCAATAGTAGCAATAGTAGCATTAGTAGTAGCAATAATAATAGCAATAGTTGTGTGGTCCATAGTAATCATAGAATATAGGAAAATATTAAGACAAAGAAAAATAGACAGGTTAATTGATAGACTAATAGAAAGAGCAGAAGACAGTGGCAATGAGAGTGAAGGAGAAATATCAGCACTTGTGGAGATGGGGGTGGAGATGGGGCACCATGCTCCTTGGGATGTTGATGATCTGTAGTGCTACAGAAAAATTGTGGGTCACAGTCTATTATGGGGTACCTGTGTGGAAGGAAGCAACCACCACTCTATTTTGTGCATCAGATGCTAAAGCATATGATACAGAGGTACATAATGTTTGGGCCACACATGCCTGTGTACCCACAGACCCCAACCCACAAGAAGTAGTATTGGTAAATGTGACAGAAAATTTTAACATGTGGAAAAATGACATGGTAGAACAGATGCATGAGGATATAATCAGTTTATGGGATCAAAGCCTAAAGCCATGTGTAAAATTAACCCCACTCTGTGTTAGTTTAAAGTGCACTGATTTGAAGAATGATACTAATACCAATAGTAGTAGCGGGAGAATGATAATGGAGAAAGGAGAGATAAAAAACTGCTCTTTCAATATCAGCACAAGCATAAGAGGTAAGGTGCAGAAAGAATATGCATTTTTTTATAAACTTGATATAATACCAATAGATAATGATACTACCAGCTATAAGTTGACAAGTTGTAACACCTCAGTCATTACACAGGCCTGTCCAAAGGTATCCTTTGAGCCAATTCCCATACATTATTGTGCCCCGGCTGGTTTTGCGATTCTAAAATGTAATAATAAGACGTTCAATGGAACAGGACCATGTACAAATGTCAGCACAGTACAATGTACACATGGAATTAGGCCAGTAGTATCAACTCAACTGCTGTTAAATGGCAGTCTAGCAGAAGAAGAGGTAGTAATTAGATCTGTCAATTTCACGGACAATGCTAAAACCATAATAGTACAGCTGAACACATCTGTAGAAATTAATTGTACAAGACCCAACAACAATACAAGAAAAAGAATCCGTATCCAGAGAGGACCAGGGAGAGCATTTGTTACAATAGGAAAAATAGGAAATATGAGACAAGCACATTGTAACATTAGTAGAGCAAAATGGAATAACACTTTAAAACAGATAGCTAGCAAATTAAGAGAACAATTTGGAAATAATAAAACAATAATCTTTAAGCAATCCTCAGGAGGGGACCCAGAAATTGTAACGCACAGTTTTAATTGTGGAGGGGAATTTTTCTACTGTAATTCAACACAACTGTTTAATAGTACTTGGTTTAATAGTACTTGGAGTACTGAAGGGTCAAATAACACTGAAGGAAGTGACACAATCACCCTCCCATGCAGAATAAAACAAATTATAAACATGTGGCAGAAAGTAGGAAAAGCAATGTATGCCCCTCCCATCAGTGGACAAATTAGATGTTCATCAAATATTACAGGGCTGCTATTAACAAGAGATGGTGGTAATAGCAACAATGAGTCCGAGATCTTCAGACCTGGAGGAGGAGATATGAGGGACAATTGGAGAAGTGAATTATATAAATATAAAGTAGTAAAAATTGAACCATTAGGAGTAGCACCCACCAAGGCAAAGAGAAGAGTGGTGCAGAGAGAAAAAAGAGCAGTGGGAATAGGAGCTTTGTTCCTTGGGTTCTTGGGAGCAGCAGGAAGCACTATGGGCGCAGCCTCAATGACGCTGACGGTACAGGCCAGACAATTATTGTCTGGTATAGTGCAGCAGCAGAACAATTTGCTGAGGGCTATTGAGGCGCAACAGCATCTGTTGCAACTCACAGTCTGGGGCATCAAGCAGCTCCAGGCAAGAATCCTGGCTGTGGAAAGATACCTAAAGGATCAACAGCTCCTGGGGATTTGGGGTTGCTCTGGAAAACTCATTTGCACCACTGCTGTGCCTTGGAATGCTAGTTGGAGTAATAAATCTCTGGAACAGATTTGGAATCACACGACCTGGATGGAGTGGGACAGAGAAATTAACAATTACACAAGCTTAATACACTCCTTAATTGAAGAATCGCAAAACCAGCAAGAAAAGAATGAACAAGAATTATTGGAATTAGATAAATGGGCAAGTTTGTGGAATTGGTTTAACATAACAAATTGGCTGTGGTATATAAAATTATTCATAATGATAGTAGGAGGCTTGGTAGGTTTAAGAATAGTTTTTGCTGTACTTTCTATAGTGAATAGAGTTAGGCAGGGATATTCACCATTATCGTTTCAGACCCACCTCCCAACCCCGAGGGGACCCGACAGGCCCGAAGGAATAGAAGAAGAAGGTGGAGAGAGAGACAGAGACAGATCCATTCGATTAGTGAACGGATCCTTGGCACTTATCTGGGACGATCTGCGGAGCCTGTGCCTCTTCAGCTACCACCGCTTGAGAGACTTACTCTTGATTGTAACGAGGATTGTGGAACTTCTGGGACGCAGGGGGTGGGAAGCCCTCAAATATTGGTGGAATCTCCTACAGTATTGGAGTCAGGAACTAAAGAATAGTGCTGTTAGCTTGCTCAATGCCACAGCCATAGCAGTAGCTGAGGGGACAGATAGGGTTATAGAAGTAGTACAAGGAGCTTGTAGAGCTATTCGCCACATACCTAGAAGAATAAGACAGGGCTTGGAAAGGATTTTGCTATAAGATGGGTGGCAAGTGGTCAAAAAGTAGTGTGATTGGATGGCCTACTGTAAGGGAAAGAATGAGACGAGCTGAGCCAGCAGCAGATAGGGTGGGAGCAGCATCTCGAGACCTGGAAAAACATGGAGCAATCACAAGTAGCAATACAGCAGCTACCAATGCTGCTTGTGCCTGGCTAGAAGCACAAGAGGAGGAGGAGGTGGGTTTTCCAGTCACACCTCAGGTACCTTTAAGACCAATGACTTACAAGGCAGCTGTAGATCTTAGCCACTTTTTAAAAGAAAAGGGGGGACTGGAAGGGCTAATTCACTCCCAAAGAAGACAAGATATCCTTGATCTGTGGATCTACCACACACAAGGCTACTTCCCTGATTAGCAGAACTACACACCAGGGCCAGGGGTCAGATATCCACTGACCTTTGGATGGTGCTACAAGCTAGTACCAGTTGAGCCAGATAAGATAGAAGAGGCCAATAAAGGAGAGAACACCAGCTTGTTACACCCTGTGAGCCTGCATGGGATGGATGACCCGGAGAGAGAAGTGTTAGAGTGGAGGTTTGACAGCCGCCTAGCATTTCATCACGTGGCCCGAGAGCTGCATCCGGAGTACTTCAAGAACTGCTGACATCGAGCTTGCTACAAGGGACTTTCCGCTGGGGACTTTCCAGGGAGGCGTGGCCTGGGCGGGACTGGGGAGTGGCGAGCCCTCAGATCCTGCATATAAGCAGCTGCTTTTTGCCTGTACTGGGTCTCTCTGGTTAGACCAGATCTGAGCCTGGGAGCTCTCTGGCTAACTAGGGAACCCACTGCTTAAGCCTCAATAAAGCTTGCCTTGAGTGCTTCAAGTAGTGTGTGCCCGTCTGTTGTGTGACTCTGGTAACTAGAGATCCCTCAGACCCTTTTAGTCAGTGTGGAAAATCTCTAGCA";
  
  (function () {

    var container;
    var nextId = 0;

    function init() {
      container = document.getElementById('mt-toast-container');
      if (!container) {
        container = document.createElement('div');
        container.id = 'mt-toast-container';
        container.className = 'mt-toast-container position-fixed bottom-0 end-0 p-3';
        container.style.zIndex = '9999';
        document.body.appendChild(container);
      }
    }

    // options.action names the button a toast with a callback shows (default
    // "Open"). A toast with a callback is an offer the user may want to take
    // after reading, so it stays until dismissed (WCAG 2.2.1); other toasts
    // time out, but not while the pointer or focus is in them (Bootstrap holds
    // the timer then).
    function show(message, type, duration, callback, options) {
      init();
      if (!duration && duration !== 0) duration = 5000;
      if (callback) duration = 0;

      var id = 'mt-toast-' + (++nextId);
      var bgClass = {
        success: 'bg-success text-white',
        danger: 'bg-danger text-white',
        warning: 'bg-warning text-dark',
        info: 'bg-info text-white'
      }[type] || 'bg-secondary text-white';
      var light = !/text-dark/.test(bgClass);

      var el = document.createElement('div');
      el.id = id;
      el.className = 'toast toast-custom ' + bgClass;
      el.setAttribute('role', 'alert');
      el.setAttribute('aria-atomic', 'true');
      el.setAttribute('data-bs-delay', duration);
      // (message is markup, as it always was: callers escape what they include)
      el.innerHTML = '<div class="toast-inner">' +
        '<div class="toast-body" data-bs-dismiss="toast">' + message + '</div>' +
        '<div class="toast-actions">' +
        (callback ? '<button type="button" class="btn btn-sm ' + (light ? 'btn-light' : 'btn-dark') + ' toast-action" data-bs-dismiss="toast"></button>' : '') +
        '<button type="button" class="btn-close' + (light ? ' btn-close-white' : '') + ' toast-close" data-bs-dismiss="toast" aria-label="Dismiss notification"></button>' +
        '</div></div>';
      if (callback) el.querySelector('.toast-action').textContent = (options && options.action) || 'Open';
      container.appendChild(el);

      var bsToast = new bootstrap.Toast(el, { autohide: duration > 0 });
      var callbackFired = false, clicked = false;
      // The message and the action button dismiss the toast, and the callback
      // is told whether that is why it closed, as alertify's was; the close
      // button is a dismissal that isn't an answer
      el.addEventListener('click', function (e) { clicked = !e.target.closest('.toast-close'); });
      el.addEventListener('hidden.bs.toast', function () {
        if (callback && !callbackFired) {
          callbackFired = true;
          var shouldClose = callback(clicked);
          if (shouldClose === false) {
            bsToast.show(); // re-show if callback returned false (alertify compat)
          }
        }
      });

      bsToast.show();
    }

    // Simple alertify-compatible API: success, error, warning
    function createSimple(type) {
      return function (message, duration, callback, options) {
        // Normalize arguments like alertify does
        // alertify signatures:
        //   warning(message, callback)        → duration is the callback (no autohide)
        //   warning(message, 10, callback)    → duration is seconds, then callback
        //   warning(message, 3000)             → duration is ms, no callback
        if (typeof duration === 'function') {
          // message + callback only, no autohide
          show('' + message, type, 0, duration, callback);
        } else if (typeof duration === 'number') {
          // Could be ms (large number like 3000) or seconds (small number like 10)
          // alertify uses seconds, so treat as seconds → ms
          if (duration < 60000) {
            // Likely seconds: convert to ms
            show('' + message, type, duration * 1000, callback, options);
          } else {
            // Already in ms, no callback
            show('' + message, type, duration);
          }
        } else {
          show('' + message, type, 0, duration, callback);
        }
      };
    }

    MT.toast = show;
    MT.toast.success = createSimple('success');
    MT.toast.error = createSimple('danger');
    MT.toast.warning = createSimple('warning');
    MT.toast.info = createSimple('info');
  })();

  // Announcements: the one polite live region (#mt-status), for what changes
  // without moving focus (search results, selection). Repeats are announced
  // again, and a burst of changes is announced once, as its last.
  (function () {
    var timer;
    MT.announce = function (message) {
      clearTimeout(timer);
      timer = setTimeout(function () {
        var region = document.getElementById('mt-status');
        if (!region) return;
        region.textContent = '';
        // (Emptied first, in its own turn, so an unchanged message is a change)
        setTimeout(function () { region.textContent = message; }, 50);
      }, 400);
    };
  })();

  // Icon-only buttons (a gear, a camera) have a title and nothing else: that is
  // a name for the accessibility tree, but only on hover. Each gets an
  // aria-label from its title, its icon is hidden from assistive technology,
  // and its name shows beside it while it has keyboard focus (Escape hides it).
  // Done for whatever is in the page, and for what is added to it later.
  (function () {
    var tip;
    var hideTip = function () { if (tip) tip.hidden = true; };
    MT.nameIconButtons = function (root) {
      (root || document).querySelectorAll('button[title], a[role="button"][title], a.btn[title]').forEach(function (el) {
        if (el.dataset.mtName) return;
        var title = el.getAttribute('title').trim();
        if (!title || el.textContent.trim()) return; // has a name in its text
        if (!el.hasAttribute('aria-label') && !el.hasAttribute('aria-labelledby')) el.setAttribute('aria-label', title);
        el.dataset.mtName = title;
        el.querySelectorAll('.bi, .fa, .fas, .far, [class*="bi-"]').forEach(function (icon) { icon.setAttribute('aria-hidden', 'true'); });
      });
    };
    document.addEventListener('focusin', function (e) {
      var el = e.target.closest && e.target.closest('[data-mt-name]');
      if (!el) return hideTip();
      var visible = false;
      try { visible = el.matches(':focus-visible'); } catch (error) { visible = true; }
      if (!visible) return hideTip();
      if (!tip) {
        tip = document.createElement('div');
        tip.id = 'mt-focus-tip';
        tip.setAttribute('role', 'tooltip');
        document.body.appendChild(tip);
      }
      tip.textContent = el.dataset.mtName;
      tip.hidden = false;
      var box = el.getBoundingClientRect();
      var below = box.bottom + 6;
      tip.style.top = (below + tip.offsetHeight > window.innerHeight ? Math.max(0, box.top - tip.offsetHeight - 6) : below) + 'px';
      tip.style.left = Math.max(0, Math.min(box.left, window.innerWidth - tip.offsetWidth - 4)) + 'px';
    });
    document.addEventListener('focusout', hideTip);
    document.addEventListener('keydown', function (e) { if (e.key == 'Escape') hideTip(); });
    var pending = false;
    var sweep = function () {
      if (pending) return;
      pending = true;
      requestAnimationFrame(function () { pending = false; MT.nameIconButtons(document); });
    };
    MT.nameIconButtons(document);
    new MutationObserver(sweep).observe(document.body, { childList: true, subtree: true });
  })();

  self.MT = MT;
  })(self ? self : window);
  