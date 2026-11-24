// Colors: scales, palettes, the color maps and plot colors.
//
// The color scales and palettes, the node, link and polygon color tables, and
// the colors and layout of the plots.
//
// An ES module (#323) that adds to MT: installX(MT, env), which createMT in common.js calls
// (#341). It uses these MT names from the other files at run time, through MT:
//   links-clusters.js: getVisibleLinks
//   views.js: dockRoom
// It reads the session and temp (and the layout) from env, which is self on the page and a
// fake in tests; the browser and library globals (document, Worker, d3, ...) it reads bare.
// The body of the installer is not indented, so that the diff of the change that wrapped it
// stays small.

// A color (or transparency) for each value, as the color tables list them.
// Their values are text ("0", "null"), so a value is looked up as text too:
// a d3 scale would give 0 or null a new color of its own, unlike its row's.

export function installColors(MT, env) {
MT.colorScale = (range, domain) => {
  const scale = d3.scaleOrdinal(range).domain(domain);
  const lookup = value => scale(String(value));
  lookup.domain = () => scale.domain();
  lookup.range = () => scale.range();
  return lookup;
};

// The value a link is colored by: for origin, the first of its files
MT.linkColorValue = (link, variable) => variable === 'origin' ? [].concat(link.origin)[0] : link[variable];

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
    const seen = env.temp.extendedPalettes || (env.temp.extendedPalettes = {});
    const key = kind + ':' + variable;
    if (!seen[key]) {
      seen[key] = true;
      if (MT.toast && MT.toast.warning) MT.toast.warning(`"${variable}" has ${n} values but the palette has ${colors.length} colours, so the extra values use lighter and darker shades. Edit the colours in the ${kind} colour table, or add a shape, to tell them apart.`, 12);
    }
  }
  return out;
};

MT.createNodeColorMap = () => {
  let variable = env.session.style.widgets["node-color-variable"];
  if (variable === "None") {
    env.temp.style.nodeColorMap = () => env.session.style.widgets["node-color"];
    return [];
  }
  
  let nodeColors;
  if(env.session.style.nodeColorsTable[variable]) {
    nodeColors = env.session.style.nodeColorsTable[variable];
  } else {
    nodeColors = env.session.style.nodeColorsTable[variable] = [...session.style.nodeColors];
  }
  
  let aggregates = {};
  let nodes = env.session.data.nodes;
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
  if(!env.session.style.nodeAlphas) env.session.style.nodeAlphas = new Array(values.length).fill(1);
  if (values.length > env.session.style.nodeAlphas.length) {
    env.session.style.nodeAlphas = env.session.style.nodeAlphas.concat(
      new Array(values.length - env.session.style.nodeAlphas.length).fill(1)
    );
  }

  if (env.session.style.widgets["node-timeline-variable"] === 'None') {
    env.session.style.nodeColorsTableKeys[variable] = values;
    env.session.style.nodeColorsTable[variable] = nodeColors;
  } else {
    
    // During timeline mode, user Pause and switch to a different Node varaible but nodeColorsTableKeys[variable] is not available
    if(!env.session.style.nodeColorsTableKeys[variable]) {
      let aggregatesTL = {};
      let nodesTL = env.session.network.timelineNodes;
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
      env.session.style.nodeColorsTableKeys[variable] = valuesTL;
      env.session.style.nodeColorsTable[variable] = nodeColorsTL;
    }
        
    let key;
    let tempNodeColors=[];
    for(let v of values) {
      let table = env.session.style.nodeColorsTableKeys[variable];
      key = table.findIndex( k => k === v);
      tempNodeColors.push(nodeColors[key]);
    }
    nodeColors = env.temp.style.nodeColor = tempNodeColors; // env.temp node color maps saved only under timeline
    env.temp.style.nodeColorKeys = [...values];
  }
    
  env.temp.style.nodeColorMap = MT.colorScale(nodeColors, values);
  env.temp.style.nodeAlphaMap = MT.colorScale(env.session.style.nodeAlphas, values);

  return aggregates;
};

MT.createLinkColorMap = () => {
  let variable = env.session.style.widgets["link-color-variable"];
  if (variable === "None") {
    env.temp.style.linkColorMap = () => env.session.style.widgets["link-color"];
    env.temp.style.linkAlphaMap = () => 1 - env.session.style.widgets["link-opacity"];
    return [];
  }

  let linkColors;
  if(env.session.style.linkColorsTable[variable]) {
    linkColors = env.session.style.linkColorsTable[variable];
  } else {
    linkColors = env.session.style.linkColorsTable[variable] = [...session.style.linkColors];
  }

  // A node is found by either its _id or its id (as text, so 1 and "1" match);
  // the first node in the list wins, as it did with a linear search
  const byId = nodes => {
    const index = new Map();
    for (let k = 0; k < nodes.length; k++) {
      const d = nodes[k];
      if (d._id != null && !index.has(String(d._id))) index.set(String(d._id), d);
      if (d.id != null && !index.has(String(d.id))) index.set(String(d.id), d);
    }
    return index;
  };
  const find = (index, id) => id == null ? undefined : index.get(String(id));
  const nodeIndex = byId(env.session.data.nodes);

  let aggregates = {};
  let links = MT.getVisibleLinks();
  let i = 0,
    n = links.length,
    l;
  if (variable === "origin") {
    while (i < n) {
      l = links[i++];
      if (!l.visible) continue;

      let src = find(nodeIndex, l.source);
      let tgt = find(nodeIndex, l.target);
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
      
      let src = find(nodeIndex, l.source);
      let tgt = find(nodeIndex, l.target);
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
  if(!env.session.style.linkAlphas) env.session.style.linkAlphas = new Array(values.length).fill(1);
  if (values.length > env.session.style.linkAlphas.length) {
    env.session.style.linkAlphas = env.session.style.linkAlphas.concat(
      new Array(values.length - env.session.style.linkAlphas.length).fill(1)
    );
  }

  if (env.session.style.widgets["node-timeline-variable"] === 'None') {
    env.session.style.linkColorsTableKeys[variable] = values;
    env.session.style.linkColorsTable[variable] = linkColors;
  } else {

    // During timeline mode, user Pause and switch to a different link varaible but linkColorsTableKeys[variable] is not available
    if(!env.session.style.linkColorsTableKeys[variable]) {
      let aggregatesTL = {};
      // The timeline's nodes are found by ID as the links are, which is what
      // byId (above) is for; this branch is the only one that uses it
      const timelineIndex = byId(env.session.network.timelineNodes);
      let linksTL = MT.getVisibleLinks();
      let linkColorsTL = [...session.style.linkColors];
      let i = 0,
        n = linksTL.length,
        l;
      if (variable === "origin") {
        while (i < n) {
          l = linksTL[i++];
          if (!l.visible) continue;
          let src = find(timelineIndex, l.source);
          let tgt = find(timelineIndex, l.target);
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
          let src = find(timelineIndex, l.source);
          let tgt = find(timelineIndex, l.target);
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
      env.session.style.linkColorsTableKeys[variable] = valuesTL;
      env.session.style.linkColorsTable[variable] = linkColorsTL;
    }

    let key;
    let tempLinkColors=[];
    for(let v of values) {
      let table = env.session.style.linkColorsTableKeys[variable];
      key = table.findIndex( k => k === v);
      tempLinkColors.push(linkColors[key]);
    }
    linkColors = env.temp.style.linkColor = tempLinkColors; // env.temp link color maps saved only under timeline
    env.temp.style.linkColorsKeys = [...values];
  }

  env.temp.style.linkColorMap = MT.colorScale(linkColors, values);
  env.temp.style.linkAlphaMap = MT.colorScale(env.session.style.linkAlphas, values);

  return aggregates;
};

MT.createPolygonColorMap = () => {
  if (!env.temp.polygonGroups || !env.session.style.widgets["polygons-color-show"]) {
    env.temp.style.polygonColorMap = () => env.session.style.widgets["polygon-color"];
    return [];
  }

  let aggregates = {};
  let groups = env.temp.polygonGroups;
  groups.forEach(d => aggregates[d.key] = d.values.length);
  let values = Object.keys(aggregates);

  if (env.session.style.widgets["polygon-color-table-counts-sort"] === "ASC")
    values.sort(function(a, b) { return aggregates[a] - aggregates[b] });
  else if (env.session.style.widgets["polygon-color-table-counts-sort"] === "DESC")
    values.sort(function(a, b) { return aggregates[b] - aggregates[a] });
  if (env.session.style.widgets["polygon-color-table-name-sort"] === "ASC")
    values.sort(function(a, b) { return a - b });
  else if (env.session.style.widgets["polygon-color-table-name-sort"] === "DESC")
    values.sort(function(a, b) { return b - a });

  if (values.length > env.session.style.polygonColors.length) {
    let colors = [];
    let m = Math.ceil(values.length / env.session.style.polygonColors.length);
    while (m-- > 0) {
      colors = colors.concat(env.session.style.polygonColors);
    }
    env.session.style.polygonColors = colors;
  }
  if(!env.session.style.polygonAlphas) env.session.style.polygonAlphas = new Array(values.length).fill(1);
  if (values.length > env.session.style.polygonAlphas.length) {
    env.session.style.polygonAlphas = env.session.style.polygonAlphas.concat(
      new Array(values.length - env.session.style.polygonAlphas.length).fill(0.5)
    );
  }
  if (env.temp.style.polygonColorMap.domain === undefined)
    env.temp.style.polygonColorMap = d3
      .scaleOrdinal(env.session.style.polygonColors)
      .domain(values);
  if (env.temp.style.polygonAlphaMap.domain === undefined)
    env.temp.style.polygonAlphaMap = d3
      .scaleOrdinal(env.session.style.polygonAlphas)
      .domain(values);
    
  return aggregates;
};

//Adapted from https://24ways.org/2010/calculating-color-contrast/
MT.contrastColor = hexcolor => {
  let r = parseInt(hexcolor.substr(1, 2), 16);
  let g = parseInt(hexcolor.substr(3, 2), 16);
  let b = parseInt(hexcolor.substr(5, 2), 16);
  let yiq = r * 299 + g * 587 + b * 114;
  return yiq >= 128000 ? "#000000" : "#ffffff";
};

// Plotly layout colors for the current background
MT.plotColors = settings => {
  const background = settings.get('background-color'), contrast = settings.get('background-color-contrast');
  return { paper_bgcolor: background, plot_bgcolor: background, font: { color: contrast } };
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
}
