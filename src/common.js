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
      "distance",
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
    "bubble-size": 5,
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
    "histogram-variable": "links-distance",
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
    "link-show-nn": false,
    "link-sort-variable": "distance",
    "link-storage": "auto",
    "link-threshold": 0.015,
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
    "scatterplot-xVar": "index",
    "scatterplot-yVar": "distance",
    "scatterplot-logScale": false,
    "scatterplot-showNodes": false,
    "search-field": "_id",
    //#298
    "search-case-sensitive": false,
    "search-whole-word" : false,
    "selected-color": "#ff8300",
    "selected-color-contrast": "#000000",
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
    "tree-leaf-node-size": 9,
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
      linkColors: d3.schemePaired,
      linkValueNames: {},
      nodeAlphas: [1],
      nodeColors: [d3.schemeCategory10[0]].concat(d3.schemeCategory10.slice(2)),
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
  
  MT.addNode = (newNode, check) => {
    if ('id' in newNode){
      if('_id' in newNode){
        //This is here because the logic won't negate for some reason. I don't get it...
      } else {
        newNode._id = newNode.id;
      }
    }
    if (isNumber(newNode._id)) newNode._id = "" + newNode._id;
    if (session.data.nodeExclusions.indexOf(newNode._id) > -1) return 0;
    if (check) {
      let nodes = session.data.nodes;
      const n = nodes.length;
      for (let i = 0; i < n; i++) {
        let node = nodes[i];
        if (node._id == newNode._id) {
          newNode.origin = uniq(newNode.origin.concat(node.origin));
          Object.assign(node, newNode);
          return 0;
        }
      }
    }
    session.data.nodes.push(Object.assign(MT.defaultNode(), newNode));
    return 1;
  };
  
  // Adds a link, or merges it into the link between the same two nodes (its
  // fields win, origins are combined). Returns 1 if the link is new.
  MT.addLink = newLink => session.data.graph.addLink(newLink);

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
          },
          false
        );
      });
      session.data.nodeFields.push("color");
      session.data.nodeFields.push("size");
      all("#edges path").forEach(link => {
        const coords = link.getAttribute("class").split(" ");
        let base = {
          source: coords[0] + "",
          target: coords[1] + "",
          color: link.getAttribute("stroke"),
          origin: ["Scraped MicrobeTrace SVG"]
        };
        base[session.style.widgets['default-distance-metric']] = 0;
        MT.addLink(base, true);
      });
      session.data.linkFields.push("color");
    } else {
      all(".nodes g").forEach((node, i) => {
        nodes.push(node.getAttribute("transform").slice(10, -1).split(",").map(parseFloat));
        MT.addNode({ id: i + "", origin: ["Scraped SVG"] }, false);
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
        MT.addLink(base, true);
      });
    }
    MT.runHamsters();
  };
  
  MT.processJSON = (json, extension) => {
    let data;
    try {
      data = JSON.parse(json);
    } catch (error) {
      alertify.error(
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
  
  MT.applySession = oldSession => {
    //If anything here seems eccentric, assume it's to maintain compatibility with
    //session files from older versions of MicrobeTrace.
  
    MT.events.emit("stop-force-simulation"); // stop previous network ticks so previous polygon won't show up

    MT.reset();
    const launch = document.getElementById("launch");
    if (launch) launch.disabled = true;
    session.files = oldSession.files;
    session.state = oldSession.state;
    session.style = Object.assign({},
      session.style,
      oldSession.style
    );
    session.layout = oldSession.layout;
    session.meta.startTime = Date.now();
    const nodes = oldSession.data.nodes,
          links = oldSession.data.links,
          n = nodes.length,
          m = links.length;
    for(let i = 0; i < n; i++) MT.addNode(nodes[i]);
    for(let j = 0; j < m; j++) MT.addLink(links[j]);
    ['nodeFields', 'linkFields', 'clusterFields', 'nodeExclusions'].forEach(v => {
      if(oldSession.data[v]) session.data[v] = uniq(session.data[v].concat(oldSession.data[v]));
    });
    if(oldSession.network) session.network = oldSession.network;
    MT.applyStyle(session.style);
    // if(!links[0]['distance']){  #249
    //   if(links[0]['tn93']){
    //     session.style.widgets['link-sort-variable'] = 'tn93';
    //   } else {
    //     session.style.widgets['link-sort-variable'] = 'snps';
    //   }
    // }
    MT.finishUp(true);
  };
  
  MT.applyStyle = style => {
    session.style = style;
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
      MT.addNode(newNode, false);
    });
    Object.keys(
      hivtrace["trace_results"]["Nodes"][0]["patient_attributes"]
    ).forEach(key => {
      if (!session.data.nodeFields.includes(key))
        session.data.nodeFields.push(key);
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
      MT.addLink(newLink, false);
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
      MT.addNode(newNode, false);   
    });
    ["genotypes", "group", "id", "name"].forEach(key => {     
      if (!session.data.nodeFields.includes(key)){
        session.data.nodeFields.push(key);     
      }   
    });
    let links = ghost["links"];   
    let n = links.length;   
    for (let i = 0; i < n; i++) {     
      let link = links[i];     
      let newLink = Object.assign({}, link, { 
        source: "" + link.source, 
        target: "" + link.target, 
        distance: parseFloat(link.dist), 
        origin: ["GHOST Import"], visible: true });     
      MT.addLink(newLink, false);   
    }
    [ "density", "dist", "shared", "src_genotype", "src_haps", "tgt_genotype", "tgt_haps" ].forEach( key => { if (!session.data.linkFields.includes(key)) session.data.linkFields.push(key); });
  //	MT.finishUp(); 
    MT.runHamsters();
  }; 
  
  let decoder = new TextDecoder("utf-8");
  MT.decode = x => decoder.decode(x);
  
  MT.parseFASTA = text => {
    return new Promise(resolve => {
      let computer = new Worker("workers/parse-fasta.js");
      computer.onmessage = response => {
        let nodes = JSON.parse(MT.decode(new Uint8Array(response.data.nodes)));
        console.log("FASTA Transit time: ", (Date.now() - response.data.start).toLocaleString(), "ms");
        resolve(nodes);
      };
      computer.postMessage(text);
    });
  };

  MT.parseMEGA = text => {
    return new Promise(resolve => {
      let computer = new Worker("workers/parse-mega.js");
      computer.onmessage = response => {
        let nodes = JSON.parse(MT.decode(new Uint8Array(response.data.nodes)));
        console.log("MEGA Transit time: ", (Date.now() - response.data.start).toLocaleString(), "ms");
        resolve(nodes);
      };
      computer.postMessage(text);
    });
  };
  
  MT.parseCSVMatrix = file => {
    return new Promise(resolve => {
      let check = session.files.length > 1;
      const origin = [file.name];
      let nn = 0,
          nl = 0;
      let computer = new Worker("workers/parse-csv-matrix.js");
      computer.onmessage = response => {
        const data = JSON.parse(MT.decode(new Uint8Array(response.data.data)));
        console.log("CSV Matrix Transit time: ", (Date.now() - response.data.start).toLocaleString(), "ms");
        const start = Date.now();
        const nodes = data.nodes;
        const tn = nodes.length;
        for (let i = 0; i < tn; i++) {
          nn += MT.addNode({
            _id: filterXSS(nodes[i]),
            origin: ['Genetic Distance']
          }, check);
        }
        const links = data.links;
        const tl = links.length;
        for (let j = 0; j < tl; j++) {
          nl += MT.addLink(Object.assign(links[j], { origin: origin }), check);
        }
        console.log("CSV Matrix Merge time: ", (Date.now() - start).toLocaleString(), "ms");
        resolve({ nn, nl, tn, tl });
      };
      computer.postMessage(file.contents);
    })
  };
  
  MT.r01 = Math.random;
  
  // ported from https://github.com/CDCgov/SeqSpawnR/blob/91d5857dbda5998839a002fbecae0f494dca960a/R/SequenceSpawner.R
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
  
  MT.align = params => {
    return new Promise(resolve => {
      if (params.aligner == "none") {
        return resolve(params.nodes);
      }
      let n = params.nodes.length;
      let referenceLength = params.reference.length;
      let aligner = new Worker("workers/align-sw.js");
      aligner.onmessage = response => {
        let subset = JSON.parse(MT.decode(new Uint8Array(response.data.nodes)));
        console.log("Alignment transit time: ", (Date.now() - response.data.start).toLocaleString(), "ms");
        let start = Date.now();
        let minPadding = Infinity,
        d = null;
        for (let i = 0; i < n; i++) {
          d = subset[i];
          if (!d._seq) d._seq = "";
          if (minPadding > d._padding) minPadding = d._padding;
        }
        for (let j = 0; j < n; j++) {
          d = subset[j];
          d._seq = "-".repeat(d._padding - minPadding) + d._seq;
          if (d._seq.length > referenceLength){
            d._seq = d._seq.substring(0, referenceLength);
          } else {
            d._seq = d._seq.padEnd(referenceLength, "-");
          }
        }
        session.data.nodeFields.push('_score');
        session.data.nodeFields.push('_padding');
        session.data.nodeFields.push('_cigar');
        console.log("Alignment Padding time: ", (Date.now() - start).toLocaleString(), "ms");
        resolve(subset);
      };
      aligner.postMessage(params);
    });
  };
  
  MT.computeConsensus = nodes => {
    if (!nodes) nodes = session.data.nodes.filter(d => d.seq);
    return new Promise(resolve => {
      let computer = new Worker("workers/compute-consensus.js");
      computer.onmessage = response => {
        console.log("Consensus Transit time: ", (Date.now() - response.data.start).toLocaleString(), "ms");
        resolve(MT.decode(new Uint8Array(response.data.consensus)));
      };
      computer.postMessage(nodes);
    });
  };
  
  MT.computeAmbiguityCounts = () => {
    return new Promise(resolve => {
      let nodes = session.data.nodes;
      let subset = nodes.filter(d => d.seq);
      const subsetLength = subset.length;
      let computer = new Worker("workers/compute-ambiguity-counts.js");
      computer.onmessage = response => {
        console.log("Ambiguity Count Transit time: ", (Date.now() - response.data.start).toLocaleString(), "ms");
        let start = Date.now();
        const dists = new Float32Array(response.data.counts);
        for (let j = 0; j < subsetLength; j++) {
          nodes[subset[j].index]._ambiguity = dists[j];
        }
        session.data.nodeFields.push('_ambiguity');
        console.log("Ambiguity Count Merge time: ", (Date.now() - start).toLocaleString(), "ms");
        resolve();
      };
      computer.postMessage(subset);
    });
  };
  
  MT.computeConsensusDistances = () => {
    return new Promise(resolve => {
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
      let computer = new Worker("workers/compute-consensus-distances.js");
      computer.onmessage = response => {
        let dists = new Uint16Array(response.data.dists);
        console.log("Consensus Difference Transit time: ", (Date.now() - response.data.start).toLocaleString(), "ms");
        start = Date.now();
        for (let j = 0; j < subsetLength; j++) {
          nodes[subset[j].index]._diff = dists[j];
        }
        session.data.nodeFields.push('_diff');
        console.log("Consensus Difference Merge time: ", (Date.now() - start).toLocaleString(), "ms");
        resolve();
      };
      computer.postMessage({
        consensus: session.data.consensus,
        subset: subset,
        start: start
      });
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

  MT.computeLinks = async subset => {
    const widgets = session.style.widgets;
    const metric = widgets['default-distance-metric'];
    const strategy = (widgets['ambiguity-resolution-strategy'] || 'SKIP').toUpperCase();
    const legacy = strategy == 'GAPMM';
    if (legacy && metric != 'tn93') {
      throw new Error('The GapMM ambiguity strategy is only available for TN93.');
    }

    // HIV-TRACE -g averages ambiguities for pairs with a too-ambiguous sequence:
    // putting those sequences first makes those pairs the first rows.
    let order = subset, averageRows = 0;
    if (strategy == 'HIVTRACE-G') {
      const t = parseFloat(widgets['ambiguity-threshold']);
      const high = subset.filter(d => !(d['_ambiguity'] < t));
      order = high.concat(subset.filter(d => d['_ambiguity'] < t));
      averageRows = high.length;
    }

    const n = order.length;
    const pairs = n * (n - 1) / 2;
    const storage = widgets['link-storage'];
    const sparse = storage == 'threshold' || (storage != 'all' && pairs > MT.maxDenseLinks);
    const threshold = sparse ? parseFloat(widgets['link-threshold']) : null;
    if (sparse) console.log(`Keeping only links with ${metric} <= ${threshold} (${pairs.toLocaleString()} pairs)`);

    const seqs = order.map(d => d.seq);
    const cores = Math.min(navigator.hardwareConcurrency || 4, 8);
    const workers = Math.max(1, Math.min(cores, Math.ceil(pairs / 1e5)));
    const splits = MT.rowSplits(n, workers);
    const message = {
      seqs,
      metric,
      mode: strategy == 'HIVTRACE-G' ? 'hivtrace-g' : strategy.toLowerCase(),
      averageRows,
      threshold
    };
    const parts = await Promise.all(splits.slice(1).map((rowEnd, w) => new Promise((resolve, reject) => {
      const computer = new Worker(legacy ? 'workers/compute-links-legacy.js' : 'workers/compute-links.js');
      computer.onmessage = response => resolve(response.data);
      computer.onerror = reject;
      computer.postMessage(Object.assign({ rowStart: splits[w], rowEnd }, message));
    })));

    console.log('Links Transit time: ', (Date.now() - Math.min(...parts.map(p => p.start))).toLocaleString(), 'ms');
    let start = Date.now();
    const g = session.data.graph;
    const before = g.edgeCount;
    if (sparse) {
      parts.forEach(({ source, target, distance }) => {
        const m = distance.length;
        for (let l = 0; l < m; l++) {
          g.addLink({
            source: order[target[l]]._id,
            target: order[source[l]]._id,
            distance: distance[l],
            origin: ['Genetic Distance']
          });
        }
      });
    } else {
      // The parts are consecutive runs of the upper triangle, in order.
      const tri = new Float32Array(pairs);
      let offset = 0;
      parts.forEach(part => {
        tri.set(part.distances, offset);
        offset += part.distances.length;
      });
      g.setDistances(order.map(d => d._id), tri, 'distance', 'Genetic Distance');
    }
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
          row[j] = dm[j][i] = v == v ? v : null;
        }
      }
      console.log("DM Compute time: ", (Date.now() - start).toLocaleString(), "ms");
      resolve(dm);
    });
  };
  
  MT.computeTree = () => {
    return new Promise((resolve, reject) => {
      let computer = new Worker("workers/compute-tree.js");
      computer.onmessage = response => {
        temp.tree = patristic.parseJSON(MT.decode(new Uint8Array(response.data.tree)));
        console.log("Tree Transit time: ", (Date.now() - response.data.start).toLocaleString(), "ms");
        resolve();
      };
      computer.onerror = e => {
        console.error(e);
        reject(e);
      };
      MT.getDM().then(dm => {
        computer.postMessage({
          labels: MT.getDMLabels(),
          matrix: dm,
          round: session.style.widgets["tree-round"]
        });
      });
    });
  };
  
  MT.computeDirectionality = () => {
    return new Promise(resolve => {
      // Directions are inferred from the tree, which only exists once the
      // phylogenetic tree view has computed it.
      if (!temp.tree) return resolve();
      const g = session.data.graph;
      const ids = new Uint32Array(g.edgeCount), sources = [], targets = [];
      let x = 0;
      g.forEachEdge((e, s, t) => {
        ids[x++] = e;
        sources.push(g.ids[s]);
        targets.push(g.ids[t]);
      });
      let computer = new Worker("workers/compute-directionality.js");
      computer.onmessage = response => {
        let flips = new Uint8Array(response.data.output);
        console.log("Directionality Transit time: ", (Date.now() - response.data.start).toLocaleString(), "ms");
        let start = Date.now();
        let n = flips.length;
        for (let i = 0; i < n; i++) {
          if (flips[i]) {
            const e = g.flip(ids[i]);
            if (e >= 0) g.setFlag(e, MTGraph.DIRECTED, true);
          }
        }
        g.version++;
        console.log("Directionality Integration time: ", (Date.now() - start).toLocaleString(), "ms");
        resolve();
      };
      computer.postMessage({
        sources: sources,
        targets: targets,
        tree: temp.tree
      });
    });
  };

  // Runs a worker that takes the condensed distance matrix for the link sort
  // variable and returns pairs of node positions, and flags those links as
  // nearest neighbors.
  MT.computeNNFlags = (script, name) => {
    return new Promise((resolve, reject) => {
      const g = session.data.graph;
      const metric = session.style.widgets['link-sort-variable'];
      const labels = g.ids.slice();
      const { tri } = MT.getCondensedDM(metric, labels);
      let machine = new Worker(script);
      machine.onmessage = response => {
        if (response.data == "Error") {
          return reject(name + " washed out");
        }
        let pairs = new Uint32Array(response.data.pairs);
        console.log(name + " Transit time: ", (Date.now() - response.data.start).toLocaleString(), "ms");
        const start = Date.now();
        g.clearFlag(MTGraph.NN);
        for (let i = 0; i < pairs.length; i += 2) {
          const e = g.edgeBetween(pairs[i], pairs[i + 1]);
          if (e >= 0) g.setFlag(e, MTGraph.NN, true);
        }
        g.version++;
        console.log(name + " Merge time: ", (Date.now() - start).toLocaleString(), "ms");
        resolve();
      };
      machine.onerror = (e) => {
        console.log(e);
        resolve();
      };
      machine.postMessage({
        n: labels.length,
        matrix: tri,
        epsilon: session.style.widgets["filtering-epsilon"]
      }, [tri.buffer]);
    });
  };

  MT.computeMST = () => MT.computeNNFlags("workers/compute-mst.js", "MST");

  MT.computeNN = () => MT.computeNNFlags("workers/compute-nn.js", "NN");
  
  MT.computeTriangulation = () => {
    return new Promise((resolve, reject) => {
      const metric = session.style.widgets['link-sort-variable'];
      let machine = new Worker("workers/compute-triangulation.js");
      machine.onmessage = response => {
        if (response.data == "Error") return reject("Triangulation washed out");
        console.log("Triangulation Transit time: ", (Date.now() - response.data.start).toLocaleString(), "ms");
        let start = Date.now();
        let matrix = JSON.parse(MT.decode(new Uint8Array(response.data.matrix)));
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
            } else if (metric == g.dense.field) {
              g.dense.tri[e - MTGraph.IMPLICIT] = v;
            } else {
              g.addLink({ source: g.ids[g.source(e)], target: g.ids[g.target(e)], [metric]: v });
            }
          }
        }
        g.version++;
        console.log("Triangulation Merge time: ", (Date.now() - start).toLocaleString(), "ms");
        resolve();
      };
      MT.getDM().then(dm => {
        machine.postMessage({
          matrix: dm
        });
      });
    });
  };
  
  MT.runHamsters = async () => {
    // if (!session.style.widgets['triangulate-false']) await MT.computeTriangulation(); #236
    // MT.computeNN();
    // MT.computeMST();
    // await MT.computeTree();
    if(!session.style.widgets['infer-directionality-false']) MT.computeDirectionality();
    MT.finishUp();
  };
  
  MT.finishUp = async (oldSession) => { 
    clearTimeout(temp.messageTimeout);
    // Links are done loading: swap the graph's pair lookup for its compact index.
    // (Link objects get null for missing link fields as they're built.)
    session.data.graph.freeze();
    let nodeFields = session.data.nodeFields;
    session.data.nodes.forEach(d => {
      nodeFields.forEach(field => {
        if (!(field in d)) d[field] = null;
      });
    });
    
    // patch missing date fields to earliest date in the the data
    let fields = session.data["nodeFields"];
    let nodeSkeleton = MT.dataSkeleton();
    let fieldsToCheck = fields.filter(f => !nodeSkeleton.nodeFields.includes(f) && f != '_ambiguity' && f != '_diff'); 
    let n = session.data.nodes.length;
    let k = fieldsToCheck.length;
    outerloop:
    for (let j = 0; j < k; j++) {
      let field = fieldsToCheck[j];
      let times = [];
      for (let i = 0; i < n; i++) {
        let node = session.data.nodes[i];
        if (node[field] != null) {
          let time = MT.parseDate(node[field]);
          if (time)
            times.push(time);
          else
            continue outerloop;
        }
      }      
      if (times.length < n) {
        let minTime = Math.min(...times);
        let minTimeString = new Date(minTime).toString();
        session.data.nodes.forEach(d => {
          if (d[field] == null) {
            d[field] = minTimeString;
          } 
        });
      } 
    };

    // The global menus of node and link variables
    const options = fields => fields.map(field => '<option value="' + field + '">' + MT.titleize(field) + "</option>").join("\n");
    const fill = (id, html) => {
      const select = document.getElementById(id);
      select.innerHTML = html;
      select.value = session.style.widgets[id];
    };
    fill("search-field", options(session.data.nodeFields));
    MT.enableSearch(true);
    fill("link-sort-variable", options(session.data.linkFields));
    fill("node-color-variable", "<option>None</option>" + options(session.data.nodeFields));
    fill("node-timeline-variable", "<option>None</option>" + options(session.data.nodeFields));
    fill("link-color-variable", "<option>None</option>" + options(session.data.linkFields));
    try {
      MT.updateThresholdHistogram();
    } catch (error) {
      console.error(error);
      MT.hideModal("loading-information-modal");
      alertify
        .error("Something went wrong! Please click here to start a new session and try again.")
        .delay(0)
        .ondismiss(() => MT.reload());
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
    });
    localforage.getItem("stash-auto").then(autostash => {
      if (autostash == "true") {
        temp.autostash = {
          time: Date.now(),
          interval: setInterval(() => {
            let newTime = Date.now();
            localforage.setItem("stash-" + newTime + "-autostash", JSON.stringify(session));
            localforage.removeItem("stash-" + temp.autostash.time + "-autostash");
            temp.autostash.time = newTime;
          }, 60000)
        };
      }  
    })
    document.querySelectorAll(".hideForHIVTrace").forEach(el => el.style.display = "flex");
    setTimeout(() => {
      let files = layout.contentItems.find(item => item.componentType == "files");
      if (files) files.remove();
      MT.hideModal("loading-information-modal");
    }, 1200);
  };
  
  MT.titleize = title => {
    let small = title.toLowerCase().replace(/_/g, " ");
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
    for (let i = 0; i < n; i++) {
      let node = nodes[i];
      node.visible = true;
      let cluster = clusters[node.cluster];
      if (cluster) {
        node.visible = node.visible && cluster.visible; 
      }
      // Nodes after the epi curve's brushed range are hidden; undated ones stay
      if (timeEnd && node[dateField] != null && node[dateField] !== "") {
        let time = MT.parseDate(node[dateField]);
        node.visible = node.visible && !!time && time <= timeEnd;
      }
    }
    if (!silent) MT.events.emit("node-visibility");
    console.log("Node Visibility Setting time:", (Date.now() - start).toLocaleString(), "ms");
  };
  
  MT.setLinkVisibility = silent => { 
    let start = Date.now();
    let metric = session.style.widgets["link-sort-variable"],
      threshold = parseFloat(session.style.widgets["link-threshold"]),
      showNN = session.style.widgets["link-show-nn"];
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

  MT.getNetworkNodes = () => {
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

  MT.getVisibleNodes = copy => {
    let nodes = session.data.nodes;
    let n = nodes.length;
    let out = [];
    if (copy) {
      for (let i = 0; i < n; i++) {
        let node = nodes[i];
        if (node.visible) {
          out.push(JSON.parse(JSON.stringify(node)));
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
      clusterCount = session.data.clusters.filter(cluster => cluster.visible && cluster.nodes > 1).length;
    } else {
      let n = vlinks.length;
      for (let i = 0; i < n; i++) {
        let src = vnodes.find(d => d._id == vlinks[i].source || d.id == vlinks[i].source);
        let tgt = vnodes.find(d => d._id == vlinks[i].target || d.id == vlinks[i].target);
        if (src && tgt) linkCount++;
      }
	  
      n = vnodes.length;
      let clusters = {};
      for (let i = 0; i < n; i++) {
        let id = vnodes[i].cluster;
        if (clusters[id]) clusters[id]++;
        else clusters[id] = 1;
      }
      clusterCount = session.data.clusters.filter(cluster => clusters[cluster.id] && clusters[cluster.id]>2 && cluster.visible && cluster.nodes > 1).length;
    }
    let singletons = vnodes.filter(d => d.degree == 0).length;
    const show = (id, n) => { document.getElementById(id).textContent = n.toLocaleString(); };
    show("numberOfSelectedNodes", vnodes.filter(d => d.selected).length);
    show("numberOfNodes", vnodes.length);
    show("numberOfVisibleLinks", linkCount);
    show("numberOfSingletonNodes", singletons);
    show("numberOfDisjointComponents", clusterCount); // #187
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
      let colors = [];
      let m = Math.ceil(values.length / nodeColors.length);
      while (m-- > 0) {
        colors = colors.concat(nodeColors);
      }
      nodeColors = colors;
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
          let colors = [];
          let m = Math.ceil(valuesTL.length / nodeColorsTL.length);
          while (m-- > 0) {
            colors = colors.concat(nodeColorsTL);
          }
          nodeColorsTL = colors;
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
      
    temp.style.nodeColorMap = d3
      .scaleOrdinal(nodeColors)
      .domain(values);
  
    temp.style.nodeAlphaMap = d3
      .scaleOrdinal(session.style.nodeAlphas)
      .domain(values);

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
      let colors = [];
      let cycles = Math.ceil(values.length / linkColors.length);
      while (cycles-- > 0) colors = colors.concat(linkColors);
      linkColors = colors;
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
          let colors = [];
          let cycles = Math.ceil(valuesTL.length / linkColorsTL.length);
          while (cycles-- > 0) colors = colors.concat(linkColorsTL);
          linkColorsTL = colors;
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

    temp.style.linkColorMap = d3
      .scaleOrdinal(linkColors)
      .domain(values);
  
    temp.style.linkAlphaMap = d3
      .scaleOrdinal(session.style.linkAlphas)
      .domain(values);

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

  // Fetches a view's HTML into temp.componentCache
  const fetchView = view => new Promise(resolve => {
    if (temp.componentCache[view]) return resolve();
    fetch("components/" + view + ".html").then(response => response.text()).then(response => {
      temp.componentCache[view] = response;
      resolve();
    });
  });

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
  // moved aside while the pane is open instead of covered by it.
  const openPanes = new Set();
  const typing = target => target.isContentEditable || target.tagName == 'TEXTAREA' ||
    (target.tagName == 'INPUT' && !['checkbox', 'radio', 'range', 'button', 'color'].includes(target.type));
  // In the capture phase, before a menu that Escape closes has closed
  document.addEventListener('keydown', e => {
    if (e.key != 'Escape' || typing(e.target) || document.querySelector('.modal.show, .ts-wrapper.dropdown-active, .dropdown-menu.show')) return;
    openPanes.forEach(close => close());
  }, true);
  MT.paneToggle = (button, pane, open = false, { push } = {}) => {
    const set = value => {
      open = value;
      button.classList.toggle('active', open);
      MT.slidePane(pane, open);
      if (push) push.classList.toggle('pane-pushed', open);
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

  // A PDF of tables ({ title, headers, rows }) under MicrobeTrace's watermark
  MT.tablesPDF = (heading, tables, filename) => pdfMake.createPdf({
    content: [
      { image: MT.watermark },
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
  // Select). To change its options, destroy() it and make a new one.
  MT.multiSelect = (select, { max } = {}) => new TomSelect(select, {
    plugins: ['remove_button'],
    maxItems: max || null,
    hideSelected: true
  });

  // Plotly layout colors for the current background
  MT.plotColors = settings => {
    const background = settings.get('background-color'), contrast = settings.get('background-color-contrast');
    return { paper_bgcolor: background, plot_bgcolor: background, font: { color: contrast } };
  };

  // A floating table (such as a view's legend) with a drag handle and a
  // context menu. The menu's items say what they do with data-action: drag
  // (show or hide the drag handle), hide, expand (or contract), and counts or
  // frequencies (call onCounts or onFrequencies). onHide hides the table.
  // Tables sit in their view's panel dock (MT.panelDock); dragging one moves it
  // from its place there. Returns a function that disconnects it.
  MT.floatingTable = (wrapper, menu, { onHide, onCounts, onFrequencies } = {}) => {
    const handle = wrapper.querySelector('.draghandle');
    const closeMenu = () => { menu.style.display = 'none'; };
    wrapper.addEventListener('contextmenu', e => {
      e.preventDefault();
      Object.assign(menu.style, { display: 'block', position: 'fixed', left: e.clientX + 'px', top: e.clientY + 'px', zIndex: 1060 });
    });
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
      } else if (action == 'expand') {
        const expand = item.textContent == 'Expand';
        wrapper.classList.toggle('expanded', expand);
        item.textContent = expand ? 'Contract' : 'Expand';
      } else if (action == 'counts' && onCounts) {
        onCounts();
      } else if (action == 'frequencies' && onFrequencies) {
        onFrequencies();
      }
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
    return () => document.removeEventListener('click', outside);
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
  // mount function returns) to show them: the color tables in views that draw
  // node or link colors, the statistics in the network. Each sits in the dock of
  // the view in front that shows it, or nowhere if there's none.
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
      const host = views.find(item => (item.panels || []).includes(kind));
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
  // has fields named export-filename, -filetype, -scale, -quality and
  // -opacity, an .export-advanced-button, an .export-dimensions readout and an
  // .export-button. Image formats save getSVG() with a watermark; `formats`
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
      const filename = field('export-filename').value, filetype = field('export-filetype').value;
      if (formats[filetype]) return formats[filetype](filename);
      const svg = getSVG();
      const watermark = d3.select(svg).append('image')
        .attr('xlink:href', MT.watermark)
        .attr('height', 128)
        .attr('width', 128)
        .attr('x', 10)
        .style('opacity', field('export-opacity').value);
      if (filetype == 'svg') {
        MT.saveAs(new Blob([MT.unparseSVG(svg)], { type: 'image/svg+xml;charset=utf-8' }), filename + '.' + filetype);
        watermark.remove();
        if (done) done(svg);
      } else {
        MT.svgImage(svg, {
          scale: parseFloat(field('export-scale').value),
          backgroundColor: settings.get('background-color'),
          type: 'image/' + filetype,
          quality: parseFloat(field('export-quality').value)
        }).then(blob => MT.saveAs(blob, filename + '.' + filetype), console.error).finally(() => {
          watermark.remove();
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
        if (!file.name.endsWith('json')) return alert('Only GeoJSON Files are currently Supported.');
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

  // Reads a date field: a Date, a time in milliseconds, or text. Dates written
  // without a time (2020, 2020-03, 2020-03-14 or 20200314) are local midnight,
  // as people mean them (Date alone reads the dashed ones as UTC). Anything
  // else is read as Date reads it. Returns null if it isn't a date.
  MT.parseDate = value => {
    if (value == null || value === '') return null;
    let time;
    if (value instanceof Date || typeof value == 'number') {
      time = new Date(value);
    } else {
      const text = String(value).trim();
      const day = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?|(\d{2})(\d{2}))?$/.exec(text);
      if (day) {
        const year = +day[1], month = +(day[2] || day[4] || 1) - 1, date = +(day[3] || day[5] || 1);
        time = new Date(year, month, date);
        time.setFullYear(year); // years before 100 aren't 19xx
        if (time.getMonth() != month || time.getDate() != date) return null;
      } else {
        time = new Date(text);
      }
    }
    return isNaN(time) ? null : time;
  };

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
    canvas.toBlob(blob => MT.saveAs(blob, filename + '.' + filetype), 'image/' + filetype);
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

  const mountView = contentItem => {
    const mount = MT.views[contentItem.componentType];
    if (!mount) return;
    const container = contentItem.container;
    const handle = mount(container.element, { settings: MT.settings, events: MT.events, container }) || {};
    contentItem.panels = handle.panels || [];
    const resize = () => handle.resize && handle.resize();
    container.on('resize', resize);
    container.on('show', resize);
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
      fetchView(view).then(() => MT.launchView(view, callback));
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
    const fill = (selector, html) => element.querySelectorAll(selector).forEach(select => { select.innerHTML = "<option>None</option>" + html; });
    const options = (fields, prefix = "", label = "") => fields.map(field => '<option value="' + prefix + field + '">' + label + MT.titleize(field) + "</option>").join("\n");
    fill("select.nodeVariables", options(session.data.nodeFields));
    fill("select.linkVariables", options(session.data.linkFields));
    fill("select.mixedVariables", options(session.data.linkFields, "links-", "Links ") + options(session.data.nodeFields, "nodes-", "Nodes "));
    fill("select.branch-variables", options(["id", "depth", "height", "length", "value"]));
    element.querySelectorAll(".launch-color-options").forEach(button => button.addEventListener("click", MT.showColorOptions));
    if (navigator.onLine) MT.showOnline(element);
  };

  // Shows the parts of a page that need the internet
  MT.showOnline = element => element.querySelectorAll(".ifOnline").forEach(el => {
    el.style.display = el.classList.contains("row") ? "flex" : "block";
  });

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
    });
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
  
  MT.watermark =
    "data:image/png;base64,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";
  
  MT.HXB2 = "TGGAAGGGCTAATTCACTCCCAACGAAGACAAGATATCCTTGATCTGTGGATCTACCACACACAAGGCTACTTCCCTGATTAGCAGAACTACACACCAGGGCCAGGGATCAGATATCCACTGACCTTTGGATGGTGCTACAAGCTAGTACCAGTTGAGCCAGAGAAGTTAGAAGAAGCCAACAAAGGAGAGAACACCAGCTTGTTACACCCTGTGAGCCTGCATGGAATGGATGACCCGGAGAGAGAAGTGTTAGAGTGGAGGTTTGACAGCCGCCTAGCATTTCATCACATGGCCCGAGAGCTGCATCCGGAGTACTTCAAGAACTGCTGACATCGAGCTTGCTACAAGGGACTTTCCGCTGGGGACTTTCCAGGGAGGCGTGGCCTGGGCGGGACTGGGGAGTGGCGAGCCCTCAGATCCTGCATATAAGCAGCTGCTTTTTGCCTGTACTGGGTCTCTCTGGTTAGACCAGATCTGAGCCTGGGAGCTCTCTGGCTAACTAGGGAACCCACTGCTTAAGCCTCAATAAAGCTTGCCTTGAGTGCTTCAAGTAGTGTGTGCCCGTCTGTTGTGTGACTCTGGTAACTAGAGATCCCTCAGACCCTTTTAGTCAGTGTGGAAAATCTCTAGCAGTGGCGCCCGAACAGGGACCTGAAAGCGAAAGGGAAACCAGAGGAGCTCTCTCGACGCAGGACTCGGCTTGCTGAAGCGCGCACGGCAAGAGGCGAGGGGCGGCGACTGGTGAGTACGCCAAAAATTTTGACTAGCGGAGGCTAGAAGGAGAGAGATGGGTGCGAGAGCGTCAGTATTAAGCGGGGGAGAATTAGATCGATGGGAAAAAATTCGGTTAAGGCCAGGGGGAAAGAAAAAATATAAATTAAAACATATAGTATGGGCAAGCAGGGAGCTAGAACGATTCGCAGTTAATCCTGGCCTGTTAGAAACATCAGAAGGCTGTAGACAAATACTGGGACAGCTACAACCATCCCTTCAGACAGGATCAGAAGAACTTAGATCATTATATAATACAGTAGCAACCCTCTATTGTGTGCATCAAAGGATAGAGATAAAAGACACCAAGGAAGCTTTAGACAAGATAGAGGAAGAGCAAAACAAAAGTAAGAAAAAAGCACAGCAAGCAGCAGCTGACACAGGACACAGCAATCAGGTCAGCCAAAATTACCCTATAGTGCAGAACATCCAGGGGCAAATGGTACATCAGGCCATATCACCTAGAACTTTAAATGCATGGGTAAAAGTAGTAGAAGAGAAGGCTTTCAGCCCAGAAGTGATACCCATGTTTTCAGCATTATCAGAAGGAGCCACCCCACAAGATTTAAACACCATGCTAAACACAGTGGGGGGACATCAAGCAGCCATGCAAATGTTAAAAGAGACCATCAATGAGGAAGCTGCAGAATGGGATAGAGTGCATCCAGTGCATGCAGGGCCTATTGCACCAGGCCAGATGAGAGAACCAAGGGGAAGTGACATAGCAGGAACTACTAGTACCCTTCAGGAACAAATAGGATGGATGACAAATAATCCACCTATCCCAGTAGGAGAAATTTATAAAAGATGGATAATCCTGGGATTAAATAAAATAGTAAGAATGTATAGCCCTACCAGCATTCTGGACATAAGACAAGGACCAAAGGAACCCTTTAGAGACTATGTAGACCGGTTCTATAAAACTCTAAGAGCCGAGCAAGCTTCACAGGAGGTAAAAAATTGGATGACAGAAACCTTGTTGGTCCAAAATGCGAACCCAGATTGTAAGACTATTTTAAAAGCATTGGGACCAGCGGCTACACTAGAAGAAATGATGACAGCATGTCAGGGAGTAGGAGGACCCGGCCATAAGGCAAGAGTTTTGGCTGAAGCAATGAGCCAAGTAACAAATTCAGCTACCATAATGATGCAGAGAGGCAATTTTAGGAACCAAAGAAAGATTGTTAAGTGTTTCAATTGTGGCAAAGAAGGGCACACAGCCAGAAATTGCAGGGCCCCTAGGAAAAAGGGCTGTTGGAAATGTGGAAAGGAAGGACACCAAATGAAAGATTGTACTGAGAGACAGGCTAATTTTTTAGGGAAGATCTGGCCTTCCTACAAGGGAAGGCCAGGGAATTTTCTTCAGAGCAGACCAGAGCCAACAGCCCCACCAGAAGAGAGCTTCAGGTCTGGGGTAGAGACAACAACTCCCCCTCAGAAGCAGGAGCCGATAGACAAGGAACTGTATCCTTTAACTTCCCTCAGGTCACTCTTTGGCAACGACCCCTCGTCACAATAAAGATAGGGGGGCAACTAAAGGAAGCTCTATTAGATACAGGAGCAGATGATACAGTATTAGAAGAAATGAGTTTGCCAGGAAGATGGAAACCAAAAATGATAGGGGGAATTGGAGGTTTTATCAAAGTAAGACAGTATGATCAGATACTCATAGAAATCTGTGGACATAAAGCTATAGGTACAGTATTAGTAGGACCTACACCTGTCAACATAATTGGAAGAAATCTGTTGACTCAGATTGGTTGCACTTTAAATTTTCCCATTAGCCCTATTGAGACTGTACCAGTAAAATTAAAGCCAGGAATGGATGGCCCAAAAGTTAAACAATGGCCATTGACAGAAGAAAAAATAAAAGCATTAGTAGAAATTTGTACAGAGATGGAAAAGGAAGGGAAAATTTCAAAAATTGGGCCTGAAAATCCATACAATACTCCAGTATTTGCCATAAAGAAAAAAGACAGTACTAAATGGAGAAAATTAGTAGATTTCAGAGAACTTAATAAGAGAACTCAAGACTTCTGGGAAGTTCAATTAGGAATACCACATCCCGCAGGGTTAAAAAAGAAAAAATCAGTAACAGTACTGGATGTGGGTGATGCATATTTTTCAGTTCCCTTAGATGAAGACTTCAGGAAGTATACTGCATTTACCATACCTAGTATAAACAATGAGACACCAGGGATTAGATATCAGTACAATGTGCTTCCACAGGGATGGAAAGGATCACCAGCAATATTCCAAAGTAGCATGACAAAAATCTTAGAGCCTTTTAGAAAACAAAATCCAGACATAGTTATCTATCAATACATGGATGATTTGTATGTAGGATCTGACTTAGAAATAGGGCAGCATAGAACAAAAATAGAGGAGCTGAGACAACATCTGTTGAGGTGGGGACTTACCACACCAGACAAAAAACATCAGAAAGAACCTCCATTCCTTTGGATGGGTTATGAACTCCATCCTGATAAATGGACAGTACAGCCTATAGTGCTGCCAGAAAAAGACAGCTGGACTGTCAATGACATACAGAAGTTAGTGGGGAAATTGAATTGGGCAAGTCAGATTTACCCAGGGATTAAAGTAAGGCAATTATGTAAACTCCTTAGAGGAACCAAAGCACTAACAGAAGTAATACCACTAACAGAAGAAGCAGAGCTAGAACTGGCAGAAAACAGAGAGATTCTAAAAGAACCAGTACATGGAGTGTATTATGACCCATCAAAAGACTTAATAGCAGAAATACAGAAGCAGGGGCAAGGCCAATGGACATATCAAATTTATCAAGAGCCATTTAAAAATCTGAAAACAGGAAAATATGCAAGAATGAGGGGTGCCCACACTAATGATGTAAAACAATTAACAGAGGCAGTGCAAAAAATAACCACAGAAAGCATAGTAATATGGGGAAAGACTCCTAAATTTAAACTGCCCATACAAAAGGAAACATGGGAAACATGGTGGACAGAGTATTGGCAAGCCACCTGGATTCCTGAGTGGGAGTTTGTTAATACCCCTCCCTTAGTGAAATTATGGTACCAGTTAGAGAAAGAACCCATAGTAGGAGCAGAAACCTTCTATGTAGATGGGGCAGCTAACAGGGAGACTAAATTAGGAAAAGCAGGATATGTTACTAATAGAGGAAGACAAAAAGTTGTCACCCTAACTGACACAACAAATCAGAAGACTGAGTTACAAGCAATTTATCTAGCTTTGCAGGATTCGGGATTAGAAGTAAACATAGTAACAGACTCACAATATGCATTAGGAATCATTCAAGCACAACCAGATCAAAGTGAATCAGAGTTAGTCAATCAAATAATAGAGCAGTTAATAAAAAAGGAAAAGGTCTATCTGGCATGGGTACCAGCACACAAAGGAATTGGAGGAAATGAACAAGTAGATAAATTAGTCAGTGCTGGAATCAGGAAAGTACTATTTTTAGATGGAATAGATAAGGCCCAAGATGAACATGAGAAATATCACAGTAATTGGAGAGCAATGGCTAGTGATTTTAACCTGCCACCTGTAGTAGCAAAAGAAATAGTAGCCAGCTGTGATAAATGTCAGCTAAAAGGAGAAGCCATGCATGGACAAGTAGACTGTAGTCCAGGAATATGGCAACTAGATTGTACACATTTAGAAGGAAAAGTTATCCTGGTAGCAGTTCATGTAGCCAGTGGATATATAGAAGCAGAAGTTATTCCAGCAGAAACAGGGCAGGAAACAGCATATTTTCTTTTAAAATTAGCAGGAAGATGGCCAGTAAAAACAATACATACTGACAATGGCAGCAATTTCACCGGTGCTACGGTTAGGGCCGCCTGTTGGTGGGCGGGAATCAAGCAGGAATTTGGAATTCCCTACAATCCCCAAAGTCAAGGAGTAGTAGAATCTATGAATAAAGAATTAAAGAAAATTATAGGACAGGTAAGAGATCAGGCTGAACATCTTAAGACAGCAGTACAAATGGCAGTATTCATCCACAATTTTAAAAGAAAAGGGGGGATTGGGGGGTACAGTGCAGGGGAAAGAATAGTAGACATAATAGCAACAGACATACAAACTAAAGAATTACAAAAACAAATTACAAAAATTCAAAATTTTCGGGTTTATTACAGGGACAGCAGAAATCCACTTTGGAAAGGACCAGCAAAGCTCCTCTGGAAAGGTGAAGGGGCAGTAGTAATACAAGATAATAGTGACATAAAAGTAGTGCCAAGAAGAAAAGCAAAGATCATTAGGGATTATGGAAAACAGATGGCAGGTGATGATTGTGTGGCAAGTAGACAGGATGAGGATTAGAACATGGAAAAGTTTAGTAAAACACCATATGTATGTTTCAGGGAAAGCTAGGGGATGGTTTTATAGACATCACTATGAAAGCCCTCATCCAAGAATAAGTTCAGAAGTACACATCCCACTAGGGGATGCTAGATTGGTAATAACAACATATTGGGGTCTGCATACAGGAGAAAGAGACTGGCATTTGGGTCAGGGAGTCTCCATAGAATGGAGGAAAAAGAGATATAGCACACAAGTAGACCCTGAACTAGCAGACCAACTAATTCATCTGTATTACTTTGACTGTTTTTCAGACTCTGCTATAAGAAAGGCCTTATTAGGACACATAGTTAGCCCTAGGTGTGAATATCAAGCAGGACATAACAAGGTAGGATCTCTACAATACTTGGCACTAGCAGCATTAATAACACCAAAAAAGATAAAGCCACCTTTGCCTAGTGTTACGAAACTGACAGAGGATAGATGGAACAAGCCCCAGAAGACCAAGGGCCACAGAGGGAGCCACACAATGAATGGACACTAGAGCTTTTAGAGGAGCTTAAGAATGAAGCTGTTAGACATTTTCCTAGGATTTGGCTCCATGGCTTAGGGCAACATATCTATGAAACTTATGGGGATACTTGGGCAGGAGTGGAAGCCATAATAAGAATTCTGCAACAACTGCTGTTTATCCATTTTCAGAATTGGGTGTCGACATAGCAGAATAGGCGTTACTCGACAGAGGAGAGCAAGAAATGGAGCCAGTAGATCCTAGACTAGAGCCCTGGAAGCATCCAGGAAGTCAGCCTAAAACTGCTTGTACCAATTGCTATTGTAAAAAGTGTTGCTTTCATTGCCAAGTTTGTTTCATAACAAAAGCCTTAGGCATCTCCTATGGCAGGAAGAAGCGGAGACAGCGACGAAGAGCTCATCAGAACAGTCAGACTCATCAAGCTTCTCTATCAAAGCAGTAAGTAGTACATGTAACGCAACCTATACCAATAGTAGCAATAGTAGCATTAGTAGTAGCAATAATAATAGCAATAGTTGTGTGGTCCATAGTAATCATAGAATATAGGAAAATATTAAGACAAAGAAAAATAGACAGGTTAATTGATAGACTAATAGAAAGAGCAGAAGACAGTGGCAATGAGAGTGAAGGAGAAATATCAGCACTTGTGGAGATGGGGGTGGAGATGGGGCACCATGCTCCTTGGGATGTTGATGATCTGTAGTGCTACAGAAAAATTGTGGGTCACAGTCTATTATGGGGTACCTGTGTGGAAGGAAGCAACCACCACTCTATTTTGTGCATCAGATGCTAAAGCATATGATACAGAGGTACATAATGTTTGGGCCACACATGCCTGTGTACCCACAGACCCCAACCCACAAGAAGTAGTATTGGTAAATGTGACAGAAAATTTTAACATGTGGAAAAATGACATGGTAGAACAGATGCATGAGGATATAATCAGTTTATGGGATCAAAGCCTAAAGCCATGTGTAAAATTAACCCCACTCTGTGTTAGTTTAAAGTGCACTGATTTGAAGAATGATACTAATACCAATAGTAGTAGCGGGAGAATGATAATGGAGAAAGGAGAGATAAAAAACTGCTCTTTCAATATCAGCACAAGCATAAGAGGTAAGGTGCAGAAAGAATATGCATTTTTTTATAAACTTGATATAATACCAATAGATAATGATACTACCAGCTATAAGTTGACAAGTTGTAACACCTCAGTCATTACACAGGCCTGTCCAAAGGTATCCTTTGAGCCAATTCCCATACATTATTGTGCCCCGGCTGGTTTTGCGATTCTAAAATGTAATAATAAGACGTTCAATGGAACAGGACCATGTACAAATGTCAGCACAGTACAATGTACACATGGAATTAGGCCAGTAGTATCAACTCAACTGCTGTTAAATGGCAGTCTAGCAGAAGAAGAGGTAGTAATTAGATCTGTCAATTTCACGGACAATGCTAAAACCATAATAGTACAGCTGAACACATCTGTAGAAATTAATTGTACAAGACCCAACAACAATACAAGAAAAAGAATCCGTATCCAGAGAGGACCAGGGAGAGCATTTGTTACAATAGGAAAAATAGGAAATATGAGACAAGCACATTGTAACATTAGTAGAGCAAAATGGAATAACACTTTAAAACAGATAGCTAGCAAATTAAGAGAACAATTTGGAAATAATAAAACAATAATCTTTAAGCAATCCTCAGGAGGGGACCCAGAAATTGTAACGCACAGTTTTAATTGTGGAGGGGAATTTTTCTACTGTAATTCAACACAACTGTTTAATAGTACTTGGTTTAATAGTACTTGGAGTACTGAAGGGTCAAATAACACTGAAGGAAGTGACACAATCACCCTCCCATGCAGAATAAAACAAATTATAAACATGTGGCAGAAAGTAGGAAAAGCAATGTATGCCCCTCCCATCAGTGGACAAATTAGATGTTCATCAAATATTACAGGGCTGCTATTAACAAGAGATGGTGGTAATAGCAACAATGAGTCCGAGATCTTCAGACCTGGAGGAGGAGATATGAGGGACAATTGGAGAAGTGAATTATATAAATATAAAGTAGTAAAAATTGAACCATTAGGAGTAGCACCCACCAAGGCAAAGAGAAGAGTGGTGCAGAGAGAAAAAAGAGCAGTGGGAATAGGAGCTTTGTTCCTTGGGTTCTTGGGAGCAGCAGGAAGCACTATGGGCGCAGCCTCAATGACGCTGACGGTACAGGCCAGACAATTATTGTCTGGTATAGTGCAGCAGCAGAACAATTTGCTGAGGGCTATTGAGGCGCAACAGCATCTGTTGCAACTCACAGTCTGGGGCATCAAGCAGCTCCAGGCAAGAATCCTGGCTGTGGAAAGATACCTAAAGGATCAACAGCTCCTGGGGATTTGGGGTTGCTCTGGAAAACTCATTTGCACCACTGCTGTGCCTTGGAATGCTAGTTGGAGTAATAAATCTCTGGAACAGATTTGGAATCACACGACCTGGATGGAGTGGGACAGAGAAATTAACAATTACACAAGCTTAATACACTCCTTAATTGAAGAATCGCAAAACCAGCAAGAAAAGAATGAACAAGAATTATTGGAATTAGATAAATGGGCAAGTTTGTGGAATTGGTTTAACATAACAAATTGGCTGTGGTATATAAAATTATTCATAATGATAGTAGGAGGCTTGGTAGGTTTAAGAATAGTTTTTGCTGTACTTTCTATAGTGAATAGAGTTAGGCAGGGATATTCACCATTATCGTTTCAGACCCACCTCCCAACCCCGAGGGGACCCGACAGGCCCGAAGGAATAGAAGAAGAAGGTGGAGAGAGAGACAGAGACAGATCCATTCGATTAGTGAACGGATCCTTGGCACTTATCTGGGACGATCTGCGGAGCCTGTGCCTCTTCAGCTACCACCGCTTGAGAGACTTACTCTTGATTGTAACGAGGATTGTGGAACTTCTGGGACGCAGGGGGTGGGAAGCCCTCAAATATTGGTGGAATCTCCTACAGTATTGGAGTCAGGAACTAAAGAATAGTGCTGTTAGCTTGCTCAATGCCACAGCCATAGCAGTAGCTGAGGGGACAGATAGGGTTATAGAAGTAGTACAAGGAGCTTGTAGAGCTATTCGCCACATACCTAGAAGAATAAGACAGGGCTTGGAAAGGATTTTGCTATAAGATGGGTGGCAAGTGGTCAAAAAGTAGTGTGATTGGATGGCCTACTGTAAGGGAAAGAATGAGACGAGCTGAGCCAGCAGCAGATAGGGTGGGAGCAGCATCTCGAGACCTGGAAAAACATGGAGCAATCACAAGTAGCAATACAGCAGCTACCAATGCTGCTTGTGCCTGGCTAGAAGCACAAGAGGAGGAGGAGGTGGGTTTTCCAGTCACACCTCAGGTACCTTTAAGACCAATGACTTACAAGGCAGCTGTAGATCTTAGCCACTTTTTAAAAGAAAAGGGGGGACTGGAAGGGCTAATTCACTCCCAAAGAAGACAAGATATCCTTGATCTGTGGATCTACCACACACAAGGCTACTTCCCTGATTAGCAGAACTACACACCAGGGCCAGGGGTCAGATATCCACTGACCTTTGGATGGTGCTACAAGCTAGTACCAGTTGAGCCAGATAAGATAGAAGAGGCCAATAAAGGAGAGAACACCAGCTTGTTACACCCTGTGAGCCTGCATGGGATGGATGACCCGGAGAGAGAAGTGTTAGAGTGGAGGTTTGACAGCCGCCTAGCATTTCATCACGTGGCCCGAGAGCTGCATCCGGAGTACTTCAAGAACTGCTGACATCGAGCTTGCTACAAGGGACTTTCCGCTGGGGACTTTCCAGGGAGGCGTGGCCTGGGCGGGACTGGGGAGTGGCGAGCCCTCAGATCCTGCATATAAGCAGCTGCTTTTTGCCTGTACTGGGTCTCTCTGGTTAGACCAGATCTGAGCCTGGGAGCTCTCTGGCTAACTAGGGAACCCACTGCTTAAGCCTCAATAAAGCTTGCCTTGAGTGCTTCAAGTAGTGTGTGCCCGTCTGTTGTGTGACTCTGGTAACTAGAGATCCCTCAGACCCTTTTAGTCAGTGTGGAAAATCTCTAGCA";
  
  self.MT = MT;
  })(self ? self : window);
  