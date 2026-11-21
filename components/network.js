(() => {
  // The network view, in named pieces (#240). Everything a view instance owns lives on one
  // object, `view`, that the functions below take as their first parameter: its elements,
  // its settings and events, and the graph's state.

  const SPACE = 4096;
  // The stroke patterns a link can take, in the order a dash variable's values
  // get them. cosmos.gl draws each by its LinkStyle; the legend and the export
  // draw the same patterns with these attributes.
  const LINK_PATTERNS = ['Solid', 'Dashed', 'Dotted'];
  const DASH_ATTRIBUTES = {
    Dashed: { 'stroke-dasharray': '15, 15' },
    Dotted: { 'stroke-dasharray': '0, 15', 'stroke-linecap': 'round' }
  };
  const isNumber = a => typeof a === 'number';

  // The scripts that load cosmos.gl, once however many networks are opened
  function loadCosmos() {
    self.cosmosLoading = self.cosmosLoading || new Promise((resolve, reject) => {
      if (self.Cosmos) return resolve();
      const script = document.createElement('script');
      script.src = 'vendor/cosmos.min.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  // The view's elements, its settings and events, and the state that its pieces share
  function createViewState(root, settings, events) {
    const $ = selector => root.querySelector(selector);
    return {
      root, settings, events, $,
      get: key => settings.get(key),
      pane: $('.left-pane'),
      container: $('.network-view'),
      cosmosDiv: $('.network-cosmos'),
      underlay: $('.network-underlay'),
      overlay: $('.network-overlay'),
      brushLayer: $('.network-brush'),
      brushRect: $('.network-brush-rect'),
      menu: $('.network-context-menu'),
      symbolWrapper: $('.node-symbol-table-wrapper'), symbolTable: $('.node-symbol-table'),
      polygonWrapper: $('.polygon-color-table-wrapper'), polygonTable: $('.polygon-color-table'),
      dashWrapper: $('.link-dash-table-wrapper'), dashTable: $('.link-dash-table'),
      live: $('.network-live'),
      keysButton: $('.keys-button'), keysPanel: $('.network-keys'),

      graph: null,
      points: [],
      pointIndex: new Map(),
      links: [],
      mouse: { clientX: 0, clientY: 0 },
      lastFit: 0,
      diameters: new Float32Array(0), maxDiameter: 0,
      autoFit: true,
      destroyed: false,
      // What the last overlay frame drew (for tests)
      drawn: { labels: 0, polygons: 0, focus: 0 },
      shapeOf: () => 0,
      refreshQueued: null,
      calmTimer: null,
      renderQueued: false,
      // Behind another view the network stops laying out, and what changes
      // meanwhile is drawn when it's shown again
      hidden: false, wasRunning: false, stale: false,
      menuNode: null,
      groups: [],
      exportExtras: [],
      brushStart: null,
      overlayQueued: false,
      hovered: undefined, hoverQueued: false,
      resizeTimer: null,
      // Keyboard and screen readers: one node at a time has the keyboard focus
      focused: undefined, focusId: undefined,  // the focused point's index and node ID
      keyed: false,      // the focus came from the keyboard (so it's ringed)
      adjacency: null,   // each point's links, closest first (built when needed)
      walk: null,        // following links: the node it started from, which link, where it is
      ring: null,        // G: the node the group grew from, how many links out it reaches, and its size
      spoken: ''
    };
  }

  // Shapes and sizes -----------------------------------------------------------

  // MicrobeTrace stores d3 symbol names. cosmos.gl has fewer shapes, so some
  // share one; exports draw the real d3 symbol.
  function initShapes(view) {
    const S = Cosmos.PointShape;
    const shapes = {
      symbolCircle: S.Circle, symbolSquare: S.Square, symbolDiamondSquare: S.Diamond,
      symbolDiamond: S.Diamond, symbolDiamondAlt: S.Diamond,
      symbolTriangle: S.Triangle, symbolTriangleDown: S.Triangle, symbolTriangleLeft: S.Triangle, symbolTriangleRight: S.Triangle,
      symbolPentagon: S.Pentagon, symbolHexagon: S.Hexagon, symbolHexagonAlt: S.Hexagon,
      symbolOctagon: S.Hexagon, symbolOctagonAlt: S.Hexagon,
      symbolStar: S.Star, symbolWye: S.Star, symbolCross: S.Cross, symbolX: S.Cross
    };
    view.shapeOf = symbol => symbol in shapes ? shapes[symbol] : S.Circle;
  }

  // d3 symbol sizes are areas in px²; cosmos.gl sizes are diameters
  const diameter = area => 2 * Math.sqrt(Math.max(area, 0) / Math.PI);

  function rgba(color, alpha) {
    const c = d3.rgb(color);
    return [c.r / 255, c.g / 255, c.b / 255, (alpha == null ? 1 : alpha) * c.opacity];
  }

  // Layout and simulation ---------------------------------------------------------

  // The settings were made for d3-force. These scales give about the same
  // layout at their defaults (spread, link lengths) with cosmos.gl's forces.
  function physics(view) {
    return {
      simulationRepulsion: view.get('node-charge') * 0.08,
      simulationGravity: view.get('network-gravity'),
      simulationFriction: 1 - view.get('network-friction') * 0.375,
      simulationLinkSpring: view.get('network-link-strength') * 2.4,
      simulationLinkDistance: 50 + 1.4 * parseFloat(view.get('link-length')),
      simulationCluster: view.get('polygons-show') ? view.get('polygons-gather-force') * 50 : 0
    };
  }

  function createGraph(view) {
    initShapes(view);
    view.graph = new Cosmos.Graph(view.cosmosDiv, Object.assign({
      spaceSize: SPACE,
      backgroundColor: [0, 0, 0, 0],
      rescalePositions: false,
      fitViewOnInit: false,
      enableDrag: true,
      scalePointsOnZoom: true,
      scaleLinksOnZoom: true,
      linkVisibilityMinTransparency: 1,
      linkOpacity: 1 - view.get('link-opacity'),
      linkDefaultArrows: false,
      outlinedPointRingColor: '#ff8300',
      focusedPointRingColor: '#808080',
      pointGreyoutOpacity: 0.1,
      linkGreyoutOpacity: 0.1,
      onSimulationTick: () => {
        // (The layout is read back from the GPU when it settles, or when
        // something needs it: see MT.syncLayout)
        // Kept in view as the layout spreads, until the user zooms or pans
        if (view.autoFit && Date.now() - view.lastFit > 700) fit(view, MT.reducedMotion() ? 0 : 300);
        drawOverlays(view);
      },
      onSimulationEnd: () => {
        syncPositions(view);
        // The layout keeps spreading after the first fit
        if (view.autoFit) fit(view);
        view.autoFit = false;
        drawOverlays(view);
      },
      onZoomStart: (e, userDriven) => {
        if (userDriven) view.autoFit = false;
      },
      onZoom: () => drawOverlays(view),
      onLinkMouseOver: index => showLinkTooltip(view, index),
      onLinkMouseOut: () => hideTooltip(view),
      onPointClick: (index, position, event) => clickHandler(view, index, position, event),
      onBackgroundClick: () => hideContextMenu(view),
      onPointContextMenu: (index, position, event) => showContextMenu(view, index, position, event),
      onDragEnd: () => {
        syncPositions(view);
        drawOverlays(view);
      }
    }, physics(view)));
  }

  // Applies the pending data changes once, after the current batch of updates.
  function refresh(view) {
    if (!view.refreshQueued) view.refreshQueued = Promise.resolve().then(() => {
      view.refreshQueued = null;
      if (view.graph) view.graph.render();
      drawOverlays(view);
    });
    return view.refreshQueued;
  }

  function reheat(view, alpha) {
    if (!view.graph) return;
    view.graph.setConfigPartial(physics(view));
    startLayout(view, alpha || 0.3);
  }

  // Runs the force layout. With reduced motion preferred, it is given a
  // moment to spread out and then held still, rather than left drifting.
  function startLayout(view, alpha) {
    view.graph.start(alpha);
    clearTimeout(view.calmTimer);
    if (MT.reducedMotion()) view.calmTimer = setTimeout(() => {
      if (!view.graph) return;
      view.graph.pause();
      syncPositions(view);
      drawOverlays(view);
    }, 1500);
  }

  // Copies the current layout into session.network.nodes, which the timeline,
  // other views and saved sessions read.
  function syncPositions(view) {
    if (!view.graph || !view.points.length) return;
    const p = view.graph.getPointPositions();
    if (p.length < 2 * view.points.length) return;
    view.points.forEach((d, i) => {
      const x = p[2 * i], y = p[2 * i + 1];
      if (x != x) return;
      d.x = x;
      d.y = y;
      if (d.fixed) {
        d.fx = x;
        d.fy = y;
      }
    });
  }

  // A change to what's visible comes as several events (nodes, links,
  // clusters): it's drawn once, after them all
  function renderSoon(view) {
    if (view.renderQueued) return;
    view.renderQueued = true;
    Promise.resolve().then(() => {
      view.renderQueued = false;
      render(view);
    });
  }

  // Behind another view the network stops laying out, and what changes
  // meanwhile is drawn when it's shown again
  function hideView(view) {
    if (view.hidden) return;
    view.hidden = true;
    if (!view.graph) return;
    view.wasRunning = view.graph.isSimulationRunning;
    if (view.wasRunning) view.graph.pause();
  }
  function showView(view) {
    if (!view.hidden) return;
    view.hidden = false;
    if (!view.graph) return;
    if (view.stale) {
      view.stale = false;
      render(view);
    } else if (view.wasRunning) {
      view.graph.unpause();
    }
    drawOverlays(view);
  }

  function render(view) {
    if (!view.graph) return;
    if (view.hidden) {
      view.stale = true;
      return;
    }
    const start = Date.now();
    // While the global timeline plays, positions are kept in its nodes. (The
    // Epi Curve's date field is set then too, but also on its own.)
    const timeline = view.get('node-timeline-variable') != 'None';
    const newNodes = MT.getVisibleNodes(true);
    if (newNodes.length === 0 && !timeline) return;
    // The same nodes (as a new threshold usually leaves them) keep their
    // places on the GPU: only the links change. Reading the places back
    // waits for the GPU to finish all it has queued.
    const same = !timeline && newNodes.length == view.points.length && newNodes.every((d, i) => d._id === view.points[i]._id);
    if (!same) syncPositions(view);
    const oldNodes = same ? view.points : timeline ? session.network.timelineNodes : session.network.nodes;

    const previous = new Map(oldNodes.map(d => [d._id, d]));
    newNodes.forEach(d => {
      const match = previous.get(d._id);
      if (match) {
        ['x', 'y', 'fx', 'fy', 'vx', 'vy', 'fixed'].forEach(v => {
          if (typeof match[v] != 'undefined') d[v] = match[v];
        });
      }
    });

    session.network.nodes = view.points = newNodes;
    view.pointIndex = new Map(view.points.map((d, i) => [d._id, i]));
    view.focused = view.focusId === undefined ? undefined : view.pointIndex.get(view.focusId);
    view.walk = view.adjacency = null;

    view.links = MT.getVisibleLinks().filter(l => view.pointIndex.has(l.source) && view.pointIndex.has(l.target));
    const pairs = new Float32Array(view.links.length * 2);
    view.links.forEach((l, i) => {
      pairs[2 * i] = view.pointIndex.get(l.source);
      pairs[2 * i + 1] = view.pointIndex.get(l.target);
    });

    if (!same) view.graph.setPointPositions(initialPositions(view));
    view.graph.setLinks(pairs);
    describeView(view);
    redrawNodes(view);
    updateNodeColors(view);
    updateLinkColor(view);
    scaleLinkWidth(view);
    updateArrows(view);
    updatePins(view);
    updateGroups(view);
    updateTracking(view);
    refresh(view).then(() => view.graph && startLayout(view, 0.3));
    MT.time('Network render', start);
  }

  // Strategic initial positioning: known positions are kept, foci-based groups
  // are placed on tight hex grids, connected components use BFS from highest-
  // degree nodes, and true orphans fall back to a random circle.
  function initialPositions(view) {
    const n = view.points.length;
    const pos = new Float32Array(2 * n);
    const placed = new Uint8Array(n);
    const linkDist = 50 + 1.4 * parseFloat(view.get('link-length'));

    // Step 1: Preserve cached positions (from previous render, pinned nodes).
    view.points.forEach((d, i) => {
      const x = d.fixed && isNumber(d.fx) ? d.fx : d.x,
            y = d.fixed && isNumber(d.fy) ? d.fy : d.y;
      if (isNumber(x) && isNumber(y) && x == x && y == y) {
        pos[2 * i] = x;
        pos[2 * i + 1] = y;
        placed[i] = 1;
      }
    });

    // Step 2: Foci-based hex layout.  Group nodes by the foci variable
    // (same logic as updateGroups) and place same-foci nodes in a tight
    // hex packing, then arrange group centers on a coarser grid.
    const fociVar = view.get('polygons-foci');
    if (view.get('polygons-show') && fociVar && fociVar !== 'None') {
      const byKey = new Map();
      view.points.forEach((d, i) => {
        if (placed[i]) return;
        const key = '' + d[fociVar];
        if (!key || key === 'undefined' || key === 'null') return;
        if (!byKey.has(key)) byKey.set(key, []);
        byKey.get(key).push(i);
      });

      // Place each group on a staggered grid, nodes within each group in a
      // golden-angle spiral (hex packing).
      const spacing = 3 * linkDist;
      const cols = Math.max(1, Math.ceil(Math.sqrt(byKey.size)));

      let groupIdx = 0;
      byKey.forEach((indices, key) => {
        if (indices.length < 3) return; // too small — let BFS handle it

        const groupR = 3 * Math.sqrt(indices.length) + 10;
        const goldenAngle = Math.PI * (3 - Math.sqrt(5));

        for (let j = 0; j < indices.length; j++) {
          const i = indices[j];
          const r = groupR * Math.sqrt(j / indices.length);
          const a = j * goldenAngle;
          pos[2 * i] = r * Math.cos(a);
          pos[2 * i + 1] = r * Math.sin(a);
        }

        // Offset this group's positions by its grid position.
        const col = groupIdx % cols;
        const row = Math.floor(groupIdx / cols);
        const ox = (row % 2 === 1) ? spacing * 0.5 : 0;
        const cx = (col - cols / 2) * spacing + ox;
        const cy = (row - Math.ceil(byKey.size / cols) / 2) * spacing;
        const jitter = byKey.size > 3 ? spacing * 0.1 : 0;

        for (let j = 0; j < indices.length; j++) {
          const i = indices[j];
          pos[2 * i] += cx + (Math.random() - 0.5) * jitter;
          pos[2 * i + 1] += cy + (Math.random() - 0.5) * jitter;
          placed[i] = 1;
        }
        groupIdx++;
      });
    }

    // Step 3: BFS from placed nodes — each placed neighbor anchors its
    // unplaced links nearby.
    for (let i = 0; i < view.links.length; i++) {
      const s = view.pointIndex.get(view.links[i].source),
            t = view.pointIndex.get(view.links[i].target);
      if (placed[s] && placed[t]) continue;
      if (placed[s]) {
        pos[2 * t] = pos[2 * s] + (Math.random() - 0.5) * 20;
        pos[2 * t + 1] = pos[2 * s + 1] + (Math.random() - 0.5) * 20;
        placed[t] = 1;
      } else if (placed[t]) {
        pos[2 * s] = pos[2 * t] + (Math.random() - 0.5) * 20;
        pos[2 * s + 1] = pos[2 * t + 1] + (Math.random() - 0.5) * 20;
        placed[s] = 1;
      }
    }

    // Step 4: True orphans — random circle fallback.
    const spread = 10 * Math.sqrt(n) + 50;
    for (let i = 0; i < n; i++) {
      if (placed[i]) continue;
      const r = spread * Math.sqrt(Math.random());
      const a = 2 * Math.PI * Math.random();
      pos[2 * i] = SPACE / 2 + r * Math.cos(a);
      pos[2 * i + 1] = SPACE / 2 + r * Math.sin(a);
    }

    return pos;
  }

  // Fits the network to the view, leaving the docked tables at the right
  // their room: a point as far right as they reach widens what's fitted
  function fit(view, duration = 750) {
    if (!view.graph || !view.points.length) return;
    view.lastFit = Date.now();
    const positions = Array.from(view.graph.getPointPositions());
    const room = MT.dockRoom(view.root), width = view.root.clientWidth;
    if (room && width > 2 * room) {
      let min = Infinity, max = -Infinity;
      for (let i = 0; i < positions.length; i += 2) {
        if (positions[i] < min) min = positions[i];
        if (positions[i] > max) max = positions[i];
      }
      positions.push(max + (max - min) * room / (width - room), positions[1]);
    }
    view.graph.fitViewByPointPositions(positions, duration, 0.05);
  }

  // Selection, the node menu and pins ---------------------------------------------------

  // Clicking a node selects it alone (with Ctrl, adds or removes it)
  function clickHandler(view, index, position, event) {
    const n = view.points[index];
    if (!n) return;
    const node = session.data.nodes.find(d => d._id == n._id);
    if (!node) return;
    const was = node.selected;
    if (!(event && event.ctrlKey)) session.data.nodes.forEach(d => d.selected = false);
    node.selected = !was;
    // The keyboard carries on from the node clicked
    view.focused = index;
    view.focusId = n._id;
    view.walk = null;
    updateTracking(view);
    view.events.emit('node-selected', 'network');
  }

  // The node menu: pin or unpin it, copy its ID or sequence, see its attributes
  function showContextMenu(view, index, position, event) {
    if (event) event.preventDefault();
    hideTooltip(view);
    view.menuNode = view.points[index];
    if (!view.menuNode) return;
    view.menu.querySelector('.pin-node').textContent = view.menuNode.fixed ? 'Unpin Node' : 'Pin Node';
    const box = view.root.getBoundingClientRect();
    Object.assign(view.menu.style, { display: 'block', zIndex: 1000, opacity: 1, left: (event.clientX - box.left) + 'px', top: (event.clientY - box.top) + 'px' });
  }


  // (Opened from the keyboard, the focus goes back to the network)
  function hideContextMenu(view) {
    view.menu.style.display = 'none';
    if (view.menu.contains(document.activeElement)) view.container.focus();
  }

  function togglePin(view, d) {
    if (d.fixed) {
      d.fx = null;
      d.fy = null;
      d.fixed = false;
      updatePins(view);
      refresh(view).then(() => reheat(view));
    } else {
      syncPositions(view);
      d.fx = d.x;
      d.fy = d.y;
      d.fixed = true;
      updatePins(view);
      refresh(view);
    }
  }

  function bindContextMenu(view) {
    view.menu.querySelector('.pin-node').addEventListener('click', e => {
      e.preventDefault();
      const d = view.menuNode;
      hideContextMenu(view);
      if (d) togglePin(view, d);
    });

    view.menu.querySelector('.view-attributes').addEventListener('click', e => {
      e.preventDefault();
      const fromKeys = view.menu.contains(document.activeElement);
      hideContextMenu(view);
      if (!view.menuNode) return;
      const node = session.data.nodes.find(d => d._id == view.menuNode._id) || view.menuNode;
      const modal = view.$('.network-attribute-modal');
      if (fromKeys) modal.addEventListener('hidden.bs.modal', () => view.container.focus(), { once: true });
      // Its ID first (_id), then the attributes that aren't MicrobeTrace's own
      modal.querySelector('tbody').innerHTML = ['_id'].concat(Object.keys(node).filter(attribute => attribute[0] != '_'))
        .map(attribute => `<tr><td><strong>${MT.escape(MT.titleize(attribute))}</strong></td><td>${MT.escape(node[attribute])}</td></tr>`)
        .join('');
      bootstrap.Modal.getOrCreateInstance(modal).show();
    });
    [['.copy-id', '_id'], ['.copy-sequence', 'seq']].forEach(([selector, key]) => view.menu.querySelector(selector).addEventListener('click', e => {
      e.preventDefault();
      if (!view.menuNode) return;
      navigator.clipboard.writeText(String(view.menuNode[key] ?? '')).then(() => hideContextMenu(view), () => MT.toast.error("Couldn't copy to the clipboard"));
    }));
  }

  function pinAll(view) {
    syncPositions(view);
    if (session.network.allPinned) {
      view.points.forEach(d => {
        delete d.fx;
        delete d.fy;
        d.fixed = false;
      });
      updatePins(view);
      refresh(view).then(() => reheat(view));
    } else {
      view.points.forEach(d => {
        d.fx = d.x;
        d.fy = d.y;
        d.fixed = true;
      });
      updatePins(view);
      refresh(view);
    }
    session.network.allPinned = !session.network.allPinned;
    showPinned(view);
  }

  // The pin button shows whether everything is pinned, however that changed
  // (a click, the timeline, or an agent's network_control) (#326)
  function showPinned(view) {
    const button = view.$('.pin-button');
    button.classList.toggle('active', !!session.network.allPinned);
    button.setAttribute('aria-pressed', !!session.network.allPinned);
  }

  function updatePins(view) {
    if (!view.graph) return;
    const pinned = [];
    view.points.forEach((d, i) => { if (d.fixed) pinned.push(i); });
    view.graph.setPinnedPoints(pinned.length ? pinned : null);
  }

  // Ctrl + drag selects the nodes in a rectangle (toggling any already
  // selected), as the SVG view's brush did. Returns what removes its window listeners.
  function bindBrush(view) {
    const brushPointer = e => { view.brushLayer.style.pointerEvents = e.ctrlKey ? 'all' : 'none'; };
    window.addEventListener('keydown', brushPointer);
    window.addEventListener('keyup', brushPointer);
    const brushPoint = e => {
      const box = view.container.getBoundingClientRect();
      return [e.clientX - box.left, e.clientY - box.top];
    };
    view.brushLayer.addEventListener('mousedown', e => {
      view.brushStart = brushPoint(e);
      Object.assign(view.brushRect.style, { display: 'block', left: view.brushStart[0] + 'px', top: view.brushStart[1] + 'px', width: 0, height: 0 });
    });
    view.brushLayer.addEventListener('mousemove', e => {
      if (!view.brushStart) return;
      const [x, y] = brushPoint(e);
      Object.assign(view.brushRect.style, {
        left: Math.min(x, view.brushStart[0]) + 'px', top: Math.min(y, view.brushStart[1]) + 'px',
        width: Math.abs(x - view.brushStart[0]) + 'px', height: Math.abs(y - view.brushStart[1]) + 'px'
      });
    });
    const endBrush = e => {
      if (!view.brushStart || !view.graph) return;
      const [x, y] = brushPoint(e);
      const rect = [[Math.min(x, view.brushStart[0]), Math.min(y, view.brushStart[1])], [Math.max(x, view.brushStart[0]), Math.max(y, view.brushStart[1])]];
      view.brushStart = null;
      view.brushRect.style.display = 'none';
      if (rect[1][0] - rect[0][0] < 2 && rect[1][1] - rect[0][1] < 2) return;
      const inside = new Set(view.graph.findPointsInRect(rect).map(i => view.points[i]._id));
      session.data.nodes.forEach(d => {
        if (inside.has(d._id)) d.selected = !d.selected;
      });
      view.events.emit('node-selected', 'network');
    };
    view.brushLayer.addEventListener('mouseup', endBrush);
    view.brushLayer.addEventListener('mouseleave', endBrush);
    return () => {
      window.removeEventListener('keydown', brushPointer);
      window.removeEventListener('keyup', brushPointer);
    };
  }

  // Tooltips ----------------------------------------------------------------------

  // Tooltips: a node's tooltip variables (a table when there are several),
  // a link's tooltip variable
  function tooltipVariables(view) {
    return [].concat(view.get('node-tooltip-variable')).filter(v => v && v != 'None');
  }

  function showNodeTooltip(view, index, position, event) {
    const d = view.points[index];
    if (!d) return;
    if (view.get('node-highlight')) highlightNeighbors(view, index);
    // With no tooltip variable chosen, the tooltip gives the value the node
    // is colored by, so a category is never told by its color alone
    let variables = tooltipVariables(view);
    if (!variables.length && view.get('node-color-variable') && view.get('node-color-variable') != 'None') variables = [view.get('node-color-variable')];
    if (!variables.length) return;
    const html = variables.length === 1 ? MT.escape(d[variables[0]] == null ? '' : d[variables[0]]) :
      '<table><tbody>' + variables.map(v => `<tr><td>${MT.escape(MT.titleize(v))}</td><td>${MT.escape(d[v] == null ? '' : d[v])}</td></tr>`).join('') + '</tbody></table>';
    MT.tooltip(html, event || view.mouse);
  }

  function highlightNeighbors(view, index) {
    view.graph.setConfigPartial({
      highlightedPointIndices: [index].concat(view.graph.getNeighboringPointIndices(index)),
      highlightedLinkIndices: view.graph.getConnectedLinkIndices(index)
    });
  }

  function showLinkTooltip(view, index) {
    let v = view.get('link-tooltip-variable'); const d = view.links[index];
    if ((!v || v == 'None') && view.get('link-color-variable') && view.get('link-color-variable') != 'None') v = view.get('link-color-variable');
    if (!v || v == 'None' || !d) return;
    MT.tooltip(MT.escape(d[v] == null ? '' : d[v]), view.mouse);
  }

  function hideTooltip(view) {
    if (view.graph && view.get('node-highlight')) {
      view.graph.setConfigPartial({ highlightedPointIndices: undefined, highlightedLinkIndices: undefined });
    }
    MT.tooltip(null);
  }

  // Node and link styling -------------------------------------------------------------

  function nodeSymbol(view, d) {
    const symbolVariable = view.get('node-symbol-variable');
    return symbolVariable !== 'None' ? temp.style.nodeSymbolMap(d[symbolVariable]) : view.get('node-symbol');
  }

  // The d3 symbol area of each point, as the SVG view drew it
  function nodeAreas(view) {
    const defaultSize = view.get('node-radius');
    const sizeVariable = view.get('node-radius-variable');
    if (sizeVariable === 'None') return view.points.map(() => defaultSize);
    const nodes = view.get('node-timeline-variable') == 'None' ? view.points : session.network.timelineNodes;
    let min = Number.MAX_VALUE, max = Number.MIN_VALUE;
    nodes.forEach(d => {
      const size = d[sizeVariable];
      if (typeof size === 'undefined') return;
      if (size < min) min = size;
      if (size > max) max = size;
    });
    const med = (max - min) / 2;
    const scale = d3.scaleLinear().domain([min, max]).range([view.get('node-radius-min'), view.get('node-radius-max')]);
    return view.points.map(d => {
      let size = d[sizeVariable];
      if (!isNumber(size)) size = med;
      return scale(size);
    });
  }

  function redrawNodes(view) {
    if (!view.graph) return;
    const areas = nodeAreas(view);
    view.diameters = Float32Array.from(areas, diameter);
    view.maxDiameter = view.diameters.reduce((a, b) => Math.max(a, b), 0);
    view.graph.setPointShapes(Float32Array.from(view.points, d => view.shapeOf(nodeSymbol(view, d))));
    view.graph.setPointSizes(view.diameters);
    refresh(view);
  }

  function redrawLabels(view) {
    updateTracking(view);
    drawOverlays(view);
  }

  // Shapes by a node variable: the symbol for each value, listed in a table
  // where each can be changed
  function showSymbolTable(view) {
    const variable = view.get('node-symbol-variable');
    if (!variable || variable == 'None') {
      temp.style.nodeSymbolMap = () => view.get('node-symbol');
      view.symbolWrapper.hidden = true;
      view.symbolTable.innerHTML = '';
      redrawNodes(view);
      return;
    }

    let nodeSymbols = session.style.nodeSymbolsTable[variable] = session.style.nodeSymbolsTable[variable] || [...session.style.nodeSymbols];
    // Each visible value, the most common first
    const tally = nodes => {
      const aggregates = {}, values = [];
      let count = 0;
      nodes.forEach(d => {
        if (!d.visible) return;
        count++;
        const dv = d[variable];
        if (!(dv in aggregates)) {
          aggregates[dv] = 0;
          values.push(dv);
        }
        aggregates[dv]++;
      });
      values.sort((a, b) => aggregates[b] - aggregates[a]); //#297
      return { aggregates, values, count };
    };
    const repeat = (symbols, n) => {
      let out = [];
      while (out.length < n) out = out.concat(symbols);
      return out.length ? out : symbols;
    };
    const { aggregates, values, count } = tally(session.data.nodes);
    if (values.length > nodeSymbols.length) nodeSymbols = repeat(nodeSymbols, values.length);

    if (view.get('node-timeline-variable') == 'None') {
      session.style.nodeSymbolsTableKeys[variable] = values;
      session.style.nodeSymbolsTable[variable] = nodeSymbols;
    } else {
      // During the timeline the shapes stay with the values they had when it
      // started (keys from the timeline's nodes, if the variable has none yet)
      if (!session.style.nodeSymbolsTableKeys[variable]) {
        const timeline = tally(session.network.timelineNodes);
        session.style.nodeSymbolsTableKeys[variable] = timeline.values;
        session.style.nodeSymbolsTable[variable] = repeat([...session.style.nodeSymbols], timeline.values.length);
      }
      const keys = session.style.nodeSymbolsTableKeys[variable];
      nodeSymbols = values.map(v => nodeSymbols[keys.findIndex(k => k === v)]);
    }

    temp.style.nodeSymbolMap = d3.scaleOrdinal(nodeSymbols).domain(values);
    const title = session.style.overwrite && session.style.overwrite.nodeSymbolHeaderTitle ? session.style.overwrite.nodeSymbolHeaderTitle : 'Node ' + MT.titleize(variable);
    const counts = view.get('node-symbol-table-counts'), frequencies = view.get('node-symbol-table-frequencies');
    view.symbolTable.innerHTML = '<tr>' +
      `<th class="p-1" contenteditable title="Edit to rename the heading">${MT.escape(title)}</th>` +
      (counts ? '<th>Count</th>' : '') +
      (frequencies ? '<th>Frequency</th>' : '') +
      '<th>Shape</th></tr>';
    const options = view.$('[data-setting="node-symbol"]').innerHTML;
    values.forEach((v, i) => {
      const row = document.createElement('tr');
      row.innerHTML = `<td contenteditable title="Edit to rename the value">${MT.escape(MT.valueLabel(v))}</td>` +
        (counts ? `<td>${aggregates[v]}</td>` : '') +
        (frequencies ? `<td>${(aggregates[v] / count).toLocaleString()}</td>` : '') +
        `<td><select>${options}</select></td>`;
      MT.nameRow(row, MT.valueLabel(v));
      const select = row.querySelector('select');
      select.value = temp.style.nodeSymbolMap(v);
      select.addEventListener('change', () => {
        nodeSymbols.splice(i, 1, select.value);
        temp.style.nodeSymbolMap = d3.scaleOrdinal(nodeSymbols).domain(values);
        // During the timeline, the saved shapes change too
        if (view.get('node-timeline-variable') != 'None') {
          const key = session.style.nodeSymbolsTableKeys[variable].findIndex(k => k === v);
          session.style.nodeSymbolsTable[variable].splice(key, 1, select.value);
        }
        redrawNodes(view);
      });
      view.symbolTable.append(row);
    });
    view.symbolTable.querySelector('.p-1').addEventListener('focusout', e => {
      session.style.overwrite.nodeSymbolHeaderTitle = e.target.textContent;
    });
    MT.sortable(view.symbolTable, { items: 'tr' });
    view.symbolWrapper.hidden = !view.get('node-symbol-table-show');
    redrawNodes(view);
  }

  function nodeColor(view, d) {
    const variable = view.get('node-color-variable');
    if (variable == 'None') return rgba(view.get('node-color'), 1);
    return rgba(temp.style.nodeColorMap(d[variable]), temp.style.nodeAlphaMap(d[variable]));
  }

  function updateNodeColors(view) {
    if (!view.graph) return;
    const colors = new Float32Array(view.points.length * 4);
    view.points.forEach((d, i) => colors.set(nodeColor(view, d), 4 * i));
    view.graph.setPointColors(colors);
    updateSelection(view);
  }

  function updateSelection(view) {
    if (!view.graph) return;
    const selected = new Set(session.data.nodes.filter(d => d.selected).map(d => d._id));
    view.points.forEach(d => { d.selected = selected.has(d._id); });
    const outlined = [];
    view.points.forEach((d, i) => { if (d.selected) outlined.push(i); });
    view.graph.setConfigPartial({ outlinedPointIndices: outlined.length ? outlined : undefined });
    refresh(view);
  }

  function updateArrows(view) {
    if (!view.graph) return;
    view.graph.setLinkArrows(new Array(view.links.length).fill(!!view.get('link-directed')));
    refresh(view);
  }

  // A link's color; links with several origins are dashed and colored by
  // their first origin.
  function linkColor(view, l) {
    const variable = view.get('link-color-variable');
    if (variable == 'None') return rgba(view.get('link-color'), 1);
    const v = MT.linkColorValue(l, variable);
    return rgba(temp.style.linkColorMap(v), temp.style.linkAlphaMap(v));
  }

  // The dash variable's values, in order, each with its pattern. The patterns
  // are handed out in turn, so past three values they repeat, and the colors
  // still tell those values apart.
  function dashStyles(view) {
    const variable = view.get('link-dash-variable');
    if (variable == 'None') return null;
    const values = [...new Set(view.links.map(l => String(MT.linkColorValue(l, variable))))]
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    return { variable, values, patterns: new Map(values.map((v, i) => [v, LINK_PATTERNS[i % LINK_PATTERNS.length]])) };
  }

  // A link's pattern: by the dash variable when there is one, else dashed when
  // it has several origins and is colored by file (as it always was)
  function linkPattern(view, l, dash) {
    if (dash) return dash.patterns.get(String(MT.linkColorValue(l, dash.variable)));
    return view.get('link-color-variable') != 'None' && l.origin.length > 1 ? 'Dashed' : 'Solid';
  }

  function updateLinkColor(view) {
    if (view.graph) {
      const colors = new Float32Array(view.links.length * 4), styles = new Float32Array(view.links.length);
      const dash = dashStyles(view);
      view.links.forEach((l, i) => {
        colors.set(linkColor(view, l), 4 * i);
        styles[i] = Cosmos.LinkStyle[linkPattern(view, l, dash)];
      });
      view.graph.setLinkColors(colors);
      view.graph.setLinkStyles(styles);
      refresh(view);
    }
    showDashTable(view);
  }

  // The dash legend: each value of the dash variable, with its line
  function showDashTable(view) {
    const dash = dashStyles(view);
    view.dashWrapper.hidden = !dash || !view.get('link-dash-table-show');
    if (!dash) {
      view.dashTable.innerHTML = '';
      return;
    }
    view.dashTable.innerHTML = `<tr><th class="p-1">${MT.escape('Link ' + MT.titleize(dash.variable))}</th><th>Line</th></tr>` +
      dash.values.map(v => {
        const attributes = Object.entries(DASH_ATTRIBUTES[dash.patterns.get(v)] || {}).map(([name, value]) => ` ${name}="${value}"`).join('');
        return `<tr><td>${MT.escape(MT.valueLabel(v))}</td><td><svg width="48" height="10" aria-hidden="true">` +
          `<line x1="0" y1="5" x2="48" y2="5" stroke="currentColor" stroke-width="2"${attributes}/></svg></td></tr>`;
      }).join('');
  }

  function setLinkOpacity(view) {
    if (view.graph) view.graph.setConfigPartial({ linkOpacity: 1 - view.get('link-opacity') });
    refresh(view);
  }

  function linkWidths(view) {
    const scalar = view.get('link-width');
    const variable = view.get('link-width-variable');
    if (variable == 'None') return view.links.map(() => scalar);
    let max = -Infinity, min = Infinity;
    for (const link of view.links) {
      const l = link[variable];
      if (!isNumber(l)) return null;
      if (l > max) max = l;
      if (l < min) min = l;
    }
    const mid = (max - min) / 2 + min;
    const scale = d3.scaleLinear().domain([min, max]).range([view.get('link-width-min'), view.get('link-width-max')]);
    return view.links.map(d => scale(isNumber(d[variable]) ? d[variable] : mid));
  }

  function scaleLinkWidth(view) {
    if (!view.graph) return;
    const widths = linkWidths(view);
    if (!widths) return;
    view.graph.setLinkWidths(Float32Array.from(widths));
    refresh(view);
  }

  // Polygons group points by the foci variable (groups of 3 or more). The
  // gather force pulls each group together with cosmos.gl's cluster force.
  function updateGroups(view) {
    if (!view.graph) return;
    view.groups = [];
    if (view.get('polygons-show')) {
      const foci = view.get('polygons-foci');
      const byKey = new Map();
      view.points.forEach((d, i) => {
        const key = '' + d[foci];
        d.foci = key;
        if (!byKey.has(key)) byKey.set(key, { key, values: [], indices: [] });
        byKey.get(key).values.push(d);
        byKey.get(key).indices.push(i);
      });
      view.groups = Array.from(byKey.values()).filter(group => group.values.length > 2);
      temp.polygonGroups = view.groups;
    } else {
      delete temp.polygonGroups;
    }
    const clusters = new Array(view.points.length).fill(undefined);
    if (view.get('polygons-show') && view.get('polygons-gather-force') > 0) {
      view.groups.forEach((group, c) => group.indices.forEach(i => { clusters[i] = c; }));
    }
    view.graph.setPointClusters(clusters);
    view.graph.setConfigPartial({ simulationCluster: physics(view).simulationCluster });
  }

  function regroup(view) {
    updateGroups(view);
    updateTracking(view);
    if (view.get('polygons-show') && view.get('polygons-color-show')) showPolygonTable(view);
    reheat(view);
    drawOverlays(view);
  }

  // Polygon colors by group, listed in a table where each can be changed
  function showPolygonTable(view) {
    if (!view.get('polygons-show') || !view.get('polygons-color-show')) {
      view.polygonTable.innerHTML = '';
      view.polygonWrapper.hidden = true;
      return;
    }
    const sortLink = MT.sortButton;
    const flip = key => view.settings.set(key, view.get(key) === 'ASC' ? 'DESC' : 'ASC');
    const foci = view.get('polygons-foci');
    const title = session.style.overwrite && session.style.overwrite.polygonColorHeaderVariable == foci ? session.style.overwrite.polygonColorHeaderTitle : 'Polygon ' + MT.titleize(foci);
    const counts = view.get('polygon-color-table-counts'), frequencies = view.get('polygon-color-table-frequencies');
    view.polygonTable.innerHTML = '<tr></tr>';
    const header = view.polygonTable.querySelector('tr');
    const nameHeader = document.createElement('th');
    nameHeader.className = 'p-1';
    nameHeader.contentEditable = true;
    nameHeader.textContent = title;
    const nameSort = sortLink();
    nameSort.addEventListener('click', () => {
      view.settings.set('polygon-color-table-counts-sort', '');
      flip('polygon-color-table-name-sort');
      showPolygonTable(view);
    });
    nameHeader.append(nameSort);
    header.append(nameHeader);
    if (counts) {
      const countHeader = document.createElement('th');
      countHeader.textContent = 'Count';
      const countSort = sortLink();
      countSort.addEventListener('click', () => {
        view.settings.set('polygon-color-table-name-sort', '');
        flip('polygon-color-table-counts-sort');
        showPolygonTable(view);
      });
      countHeader.append(countSort);
      header.append(countHeader);
    }
    if (frequencies) header.insertAdjacentHTML('beforeend', '<th>Frequency</th>');
    header.insertAdjacentHTML('beforeend', '<th>Color</th>');
    nameHeader.addEventListener('focusout', () => {
      session.style.overwrite.polygonColorHeaderVariable = view.get('polygons-foci');
      session.style.overwrite.polygonColorHeaderTitle = nameHeader.firstChild.textContent;
    });

    if (!session.style.polygonValueNames) session.style.polygonValueNames = {};
    const aggregates = MT.createPolygonColorMap();
    const values = Object.keys(aggregates);
    if (view.get('polygon-color-table-counts-sort') == 'ASC') values.sort((a, b) => aggregates[a] - aggregates[b]);
    else if (view.get('polygon-color-table-counts-sort') == 'DESC') values.sort((a, b) => aggregates[b] - aggregates[a]);
    if (view.get('polygon-color-table-name-sort') == 'ASC') values.sort((a, b) => a - b);
    else if (view.get('polygon-color-table-name-sort') == 'DESC') values.sort((a, b) => b - a);
    const total = values.reduce((sum, v) => sum + aggregates[v], 0);
    const remap = () => {
      temp.style.polygonColorMap = d3.scaleOrdinal(session.style.polygonColors).domain(values);
      temp.style.polygonAlphaMap = d3.scaleOrdinal(session.style.polygonAlphas).domain(values);
    };

    values.forEach((value, i) => {
      session.style.polygonColors.splice(i, 1, temp.style.polygonColorMap(value));
      session.style.polygonAlphas.splice(i, 1, temp.style.polygonAlphaMap(value));
      const row = document.createElement('tr');
      row.innerHTML = `<td data-value="${MT.escape(value)}">${MT.escape(session.style.polygonValueNames[value] || MT.valueLabel(value))}</td>` +
        (counts ? `<td>${aggregates[value]}</td>` : '') +
        (frequencies ? `<td>${(aggregates[value] / total).toLocaleString()}</td>` : '') +
        `<td><input type="color">${MT.transparencyButton}</td>`;
      // (Set as a property: the color comes from the session, and could be markup)
      row.querySelector('input').value = temp.style.polygonColorMap(value);
      MT.nameRow(row, session.style.polygonValueNames[value] || MT.valueLabel(value));
      row.querySelector('input').addEventListener('change', e => {
        session.style.polygonColors.splice(i, 1, e.target.value);
        remap();
        drawOverlays(view);
      });
      // Transparency, with the shared slider
      row.querySelector('a').addEventListener('click', e => {
        const wrapper = document.getElementById('color-transparency-wrapper');
        const slider = document.getElementById('color-transparency');
        Object.assign(wrapper.style, { top: (e.clientY + 129) + 'px', left: e.clientX + 'px', display: 'block' });
        slider.value = session.style.polygonAlphas[i];
        slider.addEventListener('change', () => {
          session.style.polygonAlphas.splice(i, 1, parseFloat(slider.value));
          remap();
          wrapper.style.display = 'none';
          drawOverlays(view);
        }, { once: true });
      });
      // Double-click a value (or press F2 or Enter on it) to rename it
      const name = row.querySelector('td');
      MT.renamable(name);
      name.addEventListener('focusout', () => {
        name.contentEditable = false;
        session.style.polygonValueNames[value] = name.textContent;
        MT.nameRow(row, name.textContent);
      });
      view.polygonTable.append(row);
    });
    remap();
    MT.sortable(view.polygonTable, { items: 'tr' });
    view.polygonWrapper.hidden = !view.get('polygon-color-table-show');
    drawOverlays(view);
  }

  // Export ------------------------------------------------------------------------

  // Screen pixels per unit of simulation space
  const zoomScale = view => view.graph ? view.graph.spaceToScreenRadius(1) : 1;

  // An SVG copy of what's on screen, with real d3 symbols and node borders,
  // the color legends and the network statistics, for export.
  function buildExportSVG(view) {
    syncPositions(view);
    const width = view.container.clientWidth, height = view.container.clientHeight, k = zoomScale(view);
    const svgNode = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const svg = d3.select(svgNode)
      .attr('xmlns', 'http://www.w3.org/2000/svg')
      .attr('width', width)
      .attr('height', height);
    // Off screen while it's being saved (the SVG itself must stay unstyled,
    // since its computed styles are copied into the file)
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'position: absolute; left: -100000px; top: 0;';
    wrapper.appendChild(svgNode);
    view.container.appendChild(wrapper);
    svg.append('rect').attr('width', width).attr('height', height).attr('fill', view.get('background-color'));
    const screen = view.points.map(d => view.graph.spaceToScreenPosition([d.x, d.y]));

    svg.append('defs').append('marker')
      .attr('id', 'export-end-arrow')
      .attr('viewBox', '0 0 10 10')
      .attr('refX', 20)
      .attr('refY', 5)
      .attr('markerWidth', 4)
      .attr('markerHeight', 4)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,0 L0,10 L10,5 z');

    exportPolygons(view, svg, screen, k);
    exportLinks(view, svg, screen, k);
    exportNodes(view, svg, screen, k);
    exportLabels(view, svg);
    const [nodeLegend, linkLegend] = exportLegends(view, svgNode);
    const stats = exportStatistics(view, svg);
    view.exportExtras = [wrapper, nodeLegend, linkLegend, stats];
    return svgNode;
  }

  function exportPolygons(view, svg, screen, k) {
    if (!view.get('polygons-show')) return;
    const polygons = svg.append('g').attr('class', 'clusters');
    view.groups.forEach(group => {
      const hull = d3.polygonHull(group.indices.map(i => screen[i]));
      if (!hull) return;
      const fill = view.get('polygons-color-show') ? temp.style.polygonColorMap(group.key) : view.get('polygon-color');
      const opacity = view.get('polygons-color-show') ? temp.style.polygonAlphaMap(group.key) : 0.4;
      polygons.append('path')
        .attr('d', 'M' + hull.join('L') + 'Z')
        .style('fill', fill).style('stroke', fill)
        .style('stroke-width', 40 * k).style('stroke-linejoin', 'round')
        .style('opacity', opacity);
    });
  }

  function exportLinks(view, svg, screen, k) {
    const widths = linkWidths(view) || view.links.map(() => view.get('link-width'));
    const linkOpacity = 1 - view.get('link-opacity');
    const linkGroup = svg.append('g').attr('class', 'links');
    const dash = dashStyles(view);
    view.links.forEach((l, i) => {
      const a = screen[view.pointIndex.get(l.source)], b = screen[view.pointIndex.get(l.target)];
      const [r, g, bl, alpha] = linkColor(view, l);
      const line = linkGroup.append('line')
        .attr('x1', a[0]).attr('y1', a[1]).attr('x2', b[0]).attr('y2', b[1])
        .attr('stroke', d3.rgb(r * 255, g * 255, bl * 255).toString())
        .attr('opacity', alpha * linkOpacity)
        .attr('stroke-width', widths[i] * k);
      Object.entries(DASH_ATTRIBUTES[linkPattern(view, l, dash)] || {}).forEach(([name, value]) => line.attr(name, value));
      if (view.get('link-directed')) line.attr('marker-end', 'url(#export-end-arrow)');
    });
  }

  function exportNodes(view, svg, screen, k) {
    const areas = nodeAreas(view);
    const nodeGroup = svg.append('g').attr('class', 'nodes');
    view.points.forEach((d, i) => {
      const [r, g, b, alpha] = nodeColor(view, d);
      nodeGroup.append('path')
        .attr('d', d3.symbol().size(areas[i] * k * k).type(d3[nodeSymbol(view, d)] || d3.symbolCircle)())
        .attr('transform', `translate(${screen[i][0]}, ${screen[i][1]})`)
        .attr('fill', d3.rgb(r * 255, g * 255, b * 255).toString())
        .attr('opacity', alpha)
        .attr('stroke', d.selected ? '#ff8300' : view.get('node-color-border'))
        .attr('stroke-width', d.selected ? 4 : view.get('node-border-width') * k);
    });
  }

  function exportLabels(view, svg) {
    labelPositions(view).forEach(({ text, x, y, anchor, size }) => {
      svg.append('text').attr('x', x).attr('y', y).attr('text-anchor', anchor)
        .style('font-size', size + 'px').style('font-family', 'sans-serif').text(text);
    });
  }

  // The color legends, as their tables show them
  function exportLegends(view, svgNode) {
    const legend = (kind, aggregates, total) => {
      const variable = view.get(kind + '-color-variable');
      const columns = [(kind == 'node' ? 'Node ' : 'Link ') + MT.titleize(variable)];
      if (view.get(kind + '-color-table-counts')) columns.push('Count');
      if (view.get(kind + '-color-table-frequencies')) columns.push('Frequency');
      columns.push('Color');
      const names = session.style[kind + 'ValueNames'], colorMap = temp.style[kind + 'ColorMap'];
      const data = Object.keys(aggregates).map(value => ({
        [kind == 'node' ? 'Node' : 'Link']: names[value] ? names[value] : MT.valueLabel(value),
        Count: view.get(kind + '-color-table-counts') ? aggregates[value] : undefined,
        Frequency: view.get(kind + '-color-table-frequencies') ? (aggregates[value] / total).toLocaleString() : undefined,
        Color: { swatch: colorMap(value) }
      }));
      return MT.tabulate(data, columns, document.getElementById(kind + '-color-table-wrapper'), svgNode, view.container);
    };
    return [legend('node', MT.createNodeColorMap(), MT.getVisibleNodes().length), legend('link', MT.createLinkColorMap(), MT.getVisibleLinks().length)];
  }

  // The network statistics panel, copied into the SVG as it looks on screen
  function exportStatistics(view, svg) {
    const statsDiv = document.getElementById('network-statistics-wrapper');
    const statsBox = statsDiv.getBoundingClientRect(), viewBox = view.container.getBoundingClientRect();
    const stats = svg.append('svg:foreignObject')
      .attr('x', statsBox.left - viewBox.left)
      .attr('y', statsBox.top - viewBox.top)
      .attr('width', statsBox.width)
      .attr('height', statsBox.height);
    // Copies of the panel's nodes, not its markup parsed again
    const statsBody = stats.append('xhtml:body').node();
    Array.from(statsDiv.childNodes).forEach(child => statsBody.appendChild(child.cloneNode(true)));
    return stats;
  }

  // Overlays ----------------------------------------------------------------------

  // Points whose positions the overlays need every frame (labels, polygons)
  function updateTracking(view) {
    if (!view.graph) return;
    const needAll = view.get('polygons-show') || (view.get('node-label-variable') != 'None' && view.points.length <= 2000);
    // (and the keyboard's, for its ring)
    view.graph.trackPointPositionsByIndices(needAll ? view.points.map((d, i) => i) : view.focused !== undefined ? [view.focused] : []);
  }

  function spacePosition(view, i, tracked) {
    const p = tracked.get(i);
    if (p) return p;
    return [view.points[i].x, view.points[i].y];
  }

  // Node labels to draw: every point while there are few, otherwise the
  // evenly spaced sample of on-screen points cosmos.gl provides. Labels keep
  // their size on screen as the view zooms (their place beside the node
  // follows the node's size).
  function labelPositions(view) {
    const labelVar = view.get('node-label-variable');
    if (!labelVar || labelVar == 'None' || !view.graph || !view.points.length) return [];
    const k = zoomScale(view), size = view.get('node-label-size');
    const tracked = view.graph.getTrackedPointPositionsMap();
    const sample = view.points.length <= 2000 ? null : view.graph.getSampledPointPositionsMap();
    const indices = sample ? Array.from(sample.keys()) : view.points.map((d, i) => i);
    let anchor = 'start', dx = 8, dy = (size - 4 * k) / 2;
    switch (view.get('node-label-orientation')) {
      case 'Left': anchor = 'end'; dx = -8; break;
      case 'Top': anchor = 'middle'; dx = 0; dy = 4 * k - size; break;
      case 'Bottom': anchor = 'middle'; dx = 0; dy = size + 4 * k; break;
      case 'Middle': anchor = 'middle'; dx = 0; break;
    }
    return indices.map(i => {
      const [x, y] = view.graph.spaceToScreenPosition(sample ? sample.get(i) : spacePosition(view, i, tracked));
      return { text: view.points[i][labelVar], x: x + dx * k, y: y + dy, anchor, size };
    }).filter(l => l.text != null && l.text !== '');
  }

  function drawOverlays(view) {
    if (view.overlayQueued) return;
    view.overlayQueued = true;
    requestAnimationFrame(() => {
      view.overlayQueued = false;
      paintOverlays(view);
    });
  }

  function sizeCanvas(view, canvas) {
    const ratio = window.devicePixelRatio || 1;
    const w = view.container.clientWidth, h = view.container.clientHeight;
    if (canvas.width != Math.round(w * ratio) || canvas.height != Math.round(h * ratio)) {
      canvas.width = Math.round(w * ratio);
      canvas.height = Math.round(h * ratio);
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, w, h);
    return ctx;
  }

  function paintOverlays(view) {
    if (!view.graph) return;
    const w = view.container.clientWidth, h = view.container.clientHeight, k = zoomScale(view);
    const under = sizeCanvas(view, view.underlay), over = sizeCanvas(view, view.overlay);
    const tracked = view.graph.getTrackedPointPositionsMap();
    view.drawn.labels = view.drawn.polygons = view.drawn.focus = 0;

    if (view.get('network-gridlines-show')) {
      under.strokeStyle = 'lightgray';
      under.lineWidth = 1;
      under.beginPath();
      for (let d = 0; d * 100 <= Math.max(w, h); d++) {
        under.moveTo(0, d * 100); under.lineTo(w, d * 100);
        under.moveTo(d * 100, 0); under.lineTo(d * 100, h);
      }
      under.stroke();
    }

    if (view.get('polygons-show')) {
      view.groups.forEach(group => {
        const hull = d3.polygonHull(group.indices.map(i => view.graph.spaceToScreenPosition(spacePosition(view, i, tracked))));
        if (!hull) return;
        const fill = view.get('polygons-color-show') ? temp.style.polygonColorMap(group.key) : view.get('polygon-color');
        under.globalAlpha = view.get('polygons-color-show') ? temp.style.polygonAlphaMap(group.key) : 0.4;
        under.fillStyle = under.strokeStyle = fill;
        under.lineWidth = 40 * k;
        under.lineJoin = 'round';
        under.beginPath();
        hull.forEach(([x, y], i) => i ? under.lineTo(x, y) : under.moveTo(x, y));
        under.closePath();
        under.fill();
        under.stroke();
        view.drawn.polygons++;
      });
      under.globalAlpha = 1;
    }

    // Labels in the contrast color with a halo of the background, skipping
    // any that would run into one already drawn (or off the view)
    over.fillStyle = d3.hsl(view.get('background-color')).l < 0.5 ? '#ffffff' : '#000000';
    over.strokeStyle = view.get('background-color');
    over.lineWidth = 3;
    over.lineJoin = 'round';
    const placed = [];
    labelPositions(view).forEach(({ text, x, y, anchor, size }) => {
      over.font = size + 'px sans-serif';
      over.textAlign = anchor == 'middle' ? 'center' : anchor == 'end' ? 'right' : 'left';
      const width = over.measureText(text).width;
      const left = anchor == 'middle' ? x - width / 2 : anchor == 'end' ? x - width : x;
      const box = [left - 2, y - size, left + width + 2, y + size * 0.25];
      if (box[0] < 0 || box[2] > w || box[1] < 0 || box[3] > h) return;
      if (placed.some(b => box[0] < b[2] && b[0] < box[2] && box[1] < b[3] && b[1] < box[3])) return;
      placed.push(box);
      over.strokeText(text, x, y);
      over.fillText(text, x, y);
      view.drawn.labels++;
    });

    const linkLabel = view.get('link-label-variable');
    if (linkLabel && linkLabel != 'None' && view.links.length) {
      const size = 16 * k;
      if (size >= 4) {
        const { indices, positions, angles } = view.graph.getSampledLinks();
        over.font = size + 'px sans-serif';
        over.textAlign = 'center';
        indices.forEach((l, i) => {
          const text = view.links[l] && view.links[l][linkLabel];
          if (text == null) return;
          const [x, y] = view.graph.spaceToScreenPosition([positions[2 * i], positions[2 * i + 1]]);
          let angle = angles[i];
          if (angle > Math.PI / 2) angle -= Math.PI;
          if (angle < -Math.PI / 2) angle += Math.PI;
          over.save();
          over.translate(x, y);
          over.rotate(angle);
          over.fillText(text, 0, view.get('link-width') * k + 2 + size);
          over.restore();
        });
      }
    }

    // The keyboard's node: a ring in the contrast color with a halo of the
    // background, and its ID above it
    if (ringed(view)) {
      const p = spacePosition(view, view.focused, tracked);
      if (isNumber(p[0]) && isNumber(p[1])) {
        const [x, y] = view.graph.spaceToScreenPosition(p);
        const r = Math.max(6, view.diameters[view.focused] * k / 2) + 5;
        over.beginPath();
        over.arc(x, y, r, 0, 2 * Math.PI);
        over.lineWidth = 6;
        over.stroke();
        over.lineWidth = 2.5;
        over.strokeStyle = over.fillStyle;
        over.stroke();
        over.font = 'bold 14px sans-serif';
        over.textAlign = 'center';
        over.lineWidth = 3;
        over.strokeStyle = view.get('background-color');
        over.strokeText(view.points[view.focused]._id, x, y - r - 6);
        over.fillText(view.points[view.focused]._id, x, y - r - 6);
        view.drawn.focus = 1;
      }
    }
  }

  // Node hover is found here with cosmos.gl's synchronous point query: its own
  // hover detection reads the GPU back asynchronously, and that read can stall
  // once the layout stops moving.
  function bindHover(view) {
    view.container.addEventListener('mousemove', e => {
      view.mouse = { clientX: e.clientX, clientY: e.clientY, buttons: e.buttons };
      if (view.hoverQueued) return;
      view.hoverQueued = true;
      requestAnimationFrame(() => {
        view.hoverQueued = false;
        detectHover(view);
      });
    });
    view.container.addEventListener('mouseleave', () => setHovered(view, undefined));
  }

  function detectHover(view) {
    if (!view.graph || !view.points.length || view.brushStart || view.mouse.buttons) return;
    const box = view.container.getBoundingClientRect();
    const k = zoomScale(view);
    const x = view.mouse.clientX - box.left, y = view.mouse.clientY - box.top, r = Math.max(8, view.maxDiameter * k / 2);
    const hits = view.graph.findPointsInRect([[x - r, y - r], [x + r, y + r]]);
    let best, bestDistance = Infinity;
    if (hits.length) {
      const p = view.graph.getPointPositions();
      hits.forEach(i => {
        const [sx, sy] = view.graph.spaceToScreenPosition([p[2 * i], p[2 * i + 1]]);
        const distance = Math.hypot(sx - x, sy - y);
        if (distance <= Math.max(4, view.diameters[i] * k / 2 + 2) && distance < bestDistance) {
          best = i;
          bestDistance = distance;
        }
      });
    }
    setHovered(view, best);
  }

  function setHovered(view, index) {
    if (index === view.hovered) return;
    if (view.hovered !== undefined) hideTooltip(view);
    view.hovered = index;
    if (!view.graph) return;
    view.graph.setConfigPartial({ focusedPointIndex: index });
    view.cosmosDiv.style.cursor = index === undefined ? '' : 'pointer';
    if (index !== undefined) showNodeTooltip(view, index, null, view.mouse);
  }

  // Keyboard and screen readers ----------------------------------------------

  // The graph has no element per node, so the view itself takes the keys. One
  // node at a time has the keyboard focus: it's ringed on the overlay and
  // described in the status region (its ID, cluster, label and tooltip
  // variables, and its visible links, closest first). Only the ring is drawn
  // per frame; the rest runs on a key press.
  const plural = (n, word) => n.toLocaleString() + ' ' + word + (n == 1 ? '' : 's');
  const format = v => isNumber(v) ? v.toLocaleString(undefined, { maximumSignificantDigits: 3 }) : MT.valueLabel(v);
  const ringed = view => view.keyed && view.focused !== undefined && view.points[view.focused] &&
    (document.activeElement === view.container || view.menu.contains(document.activeElement));

  // The view's name says what's in it
  function describeView(view) {
    const clusters = new Set();
    view.points.forEach(d => { if (d.cluster != null) clusters.add(d.cluster); });
    view.container.setAttribute('aria-label', `Network of ${plural(view.points.length, 'node')} and ${plural(view.links.length, 'link')}` +
      (clusters.size ? ` in ${plural(clusters.size, 'cluster')}` : ''));
  }

  function announce(view, text) {
    // (The same words again are still spoken)
    view.spoken = text == view.spoken.trim() ? text + ' ' : text;
    view.live.textContent = view.spoken;
  }

  function neighbours(view, i) {
    if (!view.adjacency) {
      const key = view.get('link-sort-variable');
      view.adjacency = view.points.map(() => []);
      view.links.forEach(l => {
        const s = view.pointIndex.get(l.source), t = view.pointIndex.get(l.target);
        view.adjacency[s].push({ index: t, value: l[key] });
        if (t !== s) view.adjacency[t].push({ index: s, value: l[key] });
      });
      const order = v => isNumber(v) ? v : Infinity;
      view.adjacency.forEach(list => list.sort((a, b) => order(a.value) - order(b.value)));
    }
    return view.adjacency[i] || [];
  }

  // "Node S3, 4 of 300. Cluster 2, State Texas. Selected. 3 links: S1 0, S8 0.012, S9 0.015."
  function describe(view, i, where) {
    const d = view.points[i];
    const parts = ['Node ' + d._id + (where ? ', ' + where : '')];
    const variables = [...new Set(['cluster', view.get('node-label-variable')].concat(tooltipVariables(view)))]
      .filter(v => v && v != 'None' && v != '_id' && d[v] != null && d[v] !== '' && d[v] !== d._id);
    if (variables.length) parts.push(variables.map(v => MT.titleize(v) + ' ' + format(d[v])).join(', '));
    const state = [d.selected && 'Selected', d.fixed && 'Pinned'].filter(Boolean);
    if (state.length) parts.push(state.join(', '));
    const near = neighbours(view, i);
    const listed = near.slice(0, 5).map(n => view.points[n.index]._id + (n.value == null ? '' : ' ' + format(n.value)));
    if (near.length > 5) listed.push(`and ${near.length - 5} more`);
    parts.push(near.length ? plural(near.length, 'link') + ': ' + listed.join(', ') : 'No links');
    return parts.join('. ') + '.';
  }

  function screenOf(view, i) {
    const p = view.graph.getPointPositions();
    return view.graph.spaceToScreenPosition([p[2 * i], p[2 * i + 1]]);
  }

  function focusPoint(view, i, where, before) {
    if (!view.points[i]) return;
    view.focused = i;
    view.focusId = view.points[i]._id;
    view.ring = null;
    view.keyed = true;
    updateTracking(view);
    // Off screen, the view pans to it (keeping its zoom)
    const [x, y] = screenOf(view, i), margin = 30;
    if (x < margin || y < margin || x > view.container.clientWidth - margin || y > view.container.clientHeight - margin) {
      view.autoFit = false;
      view.graph.zoomToPointByIndex(i, 400, view.graph.getZoomLevel(), true);
    }
    drawOverlays(view);
    announce(view, (before ? before + ' ' : '') + describe(view, i, where));
  }

  // The nearest point on screen in a direction, preferring those within 45°
  // of it; with none focused, the one nearest the middle
  function nearest(view, dx, dy) {
    const p = view.graph.getPointPositions();
    const screen = i => view.graph.spaceToScreenPosition([p[2 * i], p[2 * i + 1]]);
    let best, bestScore = Infinity, wide, wideScore = Infinity;
    if (view.focused === undefined) {
      const cx = view.container.clientWidth / 2, cy = view.container.clientHeight / 2;
      view.points.forEach((d, i) => {
        const [x, y] = screen(i), score = Math.hypot(x - cx, y - cy);
        if (score < bestScore) [best, bestScore] = [i, score];
      });
      return best;
    }
    const [x0, y0] = screen(view.focused);
    for (let i = 0; i < view.points.length; i++) {
      if (i === view.focused) continue;
      const [x, y] = screen(i);
      const along = (x - x0) * dx + (y - y0) * dy, across = Math.abs((x - x0) * dy - (y - y0) * dx);
      if (!(along > 0.5)) continue;
      const score = along + 2 * across;
      if (across <= along) {
        if (score < bestScore) [best, bestScore] = [i, score];
      } else if (score < wideScore) [wide, wideScore] = [i, score];
    }
    return best !== undefined ? best : wide;
  }

  // The points within r links of point i, i included: a breadth-first walk
  // along the links drawn
  function within(view, i, r) {
    const seen = new Set([i]);
    let frontier = [i];
    for (let step = 0; step < r && frontier.length; step++) {
      const next = [];
      frontier.forEach(p => neighbours(view, p).forEach(({ index }) => {
        if (!seen.has(index)) {
          seen.add(index);
          next.push(index);
        }
      }));
      frontier = next;
    }
    return seen;
  }

  function selectGroup(view, ids, add) {
    session.data.nodes.forEach(d => { d.selected = ids.has(d._id) || (add && !!d.selected); });
    view.events.emit('node-selected', 'network');
  }

  const directions = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
  const noFocus = view => announce(view, 'No node is focused. Use the arrow keys or N to choose one.');

  function onKey(view, e) {
    if (e.target !== view.container || !view.graph || e.altKey) return;
    const ctrl = e.ctrlKey || e.metaKey, key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const n = view.points.length;
    const needsFocus = action => () => view.focused === undefined ? noFocus(view) : action(view.points[view.focused]);
    let action;
    if (directions[key] && !ctrl) action = () => {
      const i = nearest(view, ...directions[key]);
      if (i === undefined) announce(view, 'No node that way.');
      else focusPoint(view, i);
    };
    else if (!ctrl && (key == 'n' || key == 'p' || key == 'Home' || key == 'End')) action = () => {
      const i = key == 'Home' ? 0 : key == 'End' ? n - 1 : view.focused === undefined ? (key == 'n' ? 0 : n - 1) : (view.focused + (key == 'n' ? 1 : n - 1)) % n;
      focusPoint(view, i, `${(i + 1).toLocaleString()} of ${n.toLocaleString()}`);
    };
    else if (key == 'l' && !ctrl) action = needsFocus(() => {
      if (!view.walk || view.walk.at !== view.focused) view.walk = { from: view.focused, k: e.shiftKey ? 0 : -1 };
      const list = neighbours(view, view.walk.from), from = view.points[view.walk.from]._id;
      if (!list.length) return announce(view, `Node ${from} has no links.`);
      view.walk.k = (view.walk.k + (e.shiftKey ? list.length - 1 : 1)) % list.length;
      const { index, value } = list[view.walk.k];
      focusPoint(view, index, null, `Link ${view.walk.k + 1} of ${list.length} from ${from}` +
        (value == null ? '.' : `, ${MT.titleize(view.get('link-sort-variable'))} ${format(value)}.`));
      view.walk.at = index;
    });
    else if (key == 'Enter' || key == ' ') action = needsFocus(d => {
      clickHandler(view, view.focused, null, { ctrlKey: ctrl });
      const count = session.data.nodes.filter(node => node.selected).length;
      announce(view, `${d._id} ${d.selected ? 'selected' : 'deselected'}. ${plural(count, 'node')} selected.`);
    });
    else if (key == 'f' && !ctrl) action = needsFocus(d => {
      togglePin(view, d);
      announce(view, `${d._id} ${d.fixed ? 'pinned' : 'unpinned'}.`);
    });
    else if ((key == 'm' && !ctrl) || key == 'ContextMenu' || (key == 'F10' && e.shiftKey)) action = needsFocus(() => {
      const [x, y] = screenOf(view, view.focused), box = view.container.getBoundingClientRect();
      showContextMenu(view, view.focused, null, new MouseEvent('contextmenu', { clientX: box.left + x, clientY: box.top + y }));
      view.menu.querySelector('.dropdown-item').focus();
    });
    // A group around the focused node (#295): its neighbours, and each press
    // after takes in the nodes one more link out. Shift adds them to the
    // selection, as it does for a cluster.
    else if (key == 'g' && !ctrl) action = needsFocus(d => {
      if (!neighbours(view, view.focused).length) return announce(view, `Node ${d._id} has no links.`);
      const again = !!view.ring && view.ring.from === view.focused;
      const radius = again ? view.ring.radius + 1 : 1, members = within(view, view.focused, radius);
      if (again && members.size == view.ring.size) return announce(view, `No more nodes within ${view.ring.radius} link${view.ring.radius == 1 ? '' : 's'} of ${d._id}.`);
      view.ring = { from: view.focused, radius, size: members.size };
      selectGroup(view, new Set(Array.from(members, i => view.points[i]._id)), e.shiftKey);
      const selected = session.data.nodes.filter(node => node.selected).length;
      announce(view, `${plural(members.size, 'node')} within ${radius} link${radius == 1 ? '' : 's'} of ${d._id} selected. ${plural(selected, 'node')} selected in all.`);
    });
    // A group of nodes without the mouse (#185): the focused node's cluster
    // (Shift adds it to the selection), or every node drawn
    else if (key == 'c' && !ctrl) action = needsFocus(d => {
      const ids = new Set(view.points.filter(p => p.cluster === d.cluster).map(p => p._id));
      selectGroup(view, ids, e.shiftKey);
      announce(view, `Cluster ${d.cluster} selected, ${plural(ids.size, 'node')}. ${plural(session.data.nodes.filter(node => node.selected).length, 'node')} selected in all.`);
    });
    else if (key == 'a') action = () => {
      selectGroup(view, new Set(view.points.map(p => p._id)), false);
      announce(view, `All ${plural(view.points.length, 'node')} selected.`);
    };
    else if (key == 'i' && !ctrl) action = needsFocus(() => announce(view, describe(view, view.focused)));
    else if (key == '?') action = () => toggleKeys(view);
    if (!action) return;
    e.preventDefault();
    e.stopPropagation();
    view.keyed = true;
    if (!view.points.length) announce(view, 'The network has no nodes.');
    else action();
  }

  // Escape clears the selection, then the focus; in the node menu, the
  // arrows move between its items, Space or Enter chooses one, and Escape or
  // Tab go back to the network. (These are taken before the page's own:
  // its Escape would close the settings pane, and Bootstrap's dropdown keys
  // look for a toggle this menu doesn't have.)
  function onKeyFirst(view, e) {
    if (view.menu.contains(e.target)) {
      const items = Array.from(view.menu.querySelectorAll('.dropdown-item')), at = items.indexOf(e.target);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') items[(at + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length].focus();
      else if (e.key === ' ') e.target.click();
      else if (e.key === 'Escape' || e.key === 'Tab') hideContextMenu(view);
      else return;
    } else if (e.key != 'Escape' || e.target !== view.container) return;
    else if (!view.keysPanel.hidden) toggleKeys(view, false);
    else if (session.data.nodes.some(d => d.selected)) {
      session.data.nodes.forEach(d => { d.selected = false; });
      view.events.emit('node-selected', 'network');
      announce(view, 'Selection cleared.');
    } else if (view.focused !== undefined) {
      view.focused = view.focusId = undefined;
      view.walk = null;
      updateTracking(view);
      drawOverlays(view);
      announce(view, 'No node focused.');
    } else return;
    e.preventDefault();
    e.stopPropagation();
  }

  function toggleKeys(view, show = view.keysPanel.hidden) {
    view.keysPanel.hidden = !show;
    view.keysButton.setAttribute('aria-expanded', String(show));
    view.keysButton.classList.toggle('active', show);
  }

  function bindKeyboard(view) {
    const { container, keysButton } = view;
    container.addEventListener('keydown', e => onKey(view, e));
    const keyFirst = e => onKeyFirst(view, e);
    window.addEventListener('keydown', keyFirst, true);

    // The ring shows while the view has the focus, from the keyboard
    view.container.addEventListener('mousedown', () => {
      if (!view.keyed) return;
      view.keyed = false;
      drawOverlays(view);
    });
    view.container.addEventListener('focus', () => drawOverlays(view));
    view.container.addEventListener('blur', () => drawOverlays(view));
    keysButton.addEventListener('click', () => toggleKeys(view));
    return () => window.removeEventListener('keydown', keyFirst, true);
  }

  // Controls ----------------------------------------------------------------------

  // Rows that only apply with some settings
  function showRows(view) {
    const rows = (selector, show) => view.root.querySelectorAll(selector).forEach(row => row.hidden = !show);
    const none = key => !view.get(key) || view.get(key) == 'None';
    rows('.node-label-row', !none('node-label-variable'));
    rows('.node-symbol-table-row', !none('node-symbol-variable'));
    rows('.node-symbol-row', none('node-symbol-variable'));
    rows('.node-max-radius-row, .node-min-radius-row', !none('node-radius-variable'));
    rows('.node-radius-row', none('node-radius-variable'));
    rows('.link-max-width-row, .link-min-width-row', !none('link-width-variable'));
    rows('.link-width-row', none('link-width-variable'));
    rows('.polygons-settings-row', view.get('polygons-show'));
    rows('.polygon-color-table-row', view.get('polygons-show') && view.get('polygons-color-show'));
    rows('.polygon-color-value-row', view.get('polygons-show') && !view.get('polygons-color-show'));
  }

  function setBackground(view) {
    view.container.style.backgroundColor = view.get('background-color');
    drawOverlays(view);
  }

  // The tooltip variables menu, the buttons, the export and the floating tables.
  // Returns the floating tables (to be released with the settings' subscriptions)
  // and the tooltip menu.
  function bindControls(view) {
    // The tooltip variables menu: up to three node variables
    const tooltipSelect = view.$('.node-tooltip-variable');
    const chosen = tooltipVariables(view);
    MT.fillSelect(tooltipSelect, session.data.nodeFields);
    const tooltipMenu = MT.multiSelect(tooltipSelect, { max: 3 });
    tooltipMenu.setValue(chosen, true);
    tooltipMenu.on('change', () => view.settings.set('node-tooltip-variable', tooltipMenu.getValue()));

    showPinned(view);
    view.$('.pin-button').addEventListener('click', () => pinAll(view));
    view.$('.fit-button').addEventListener('click', () => fit(view));
    MT.paneToggle(view.$('.settings-toggle'), view.pane);
    MT.svgExport(view.root, () => buildExportSVG(view), view.settings, {}, () => {
      view.exportExtras.forEach(element => element.remove());
      view.exportExtras = [];
    });

    // The floating tables
    const toggle = key => () => view.settings.set(key, !view.get(key));
    const floaters = [
      MT.floatingTable(view.symbolWrapper, view.$('.node-symbol-table-menu'), {
        onHide: () => view.settings.set('node-symbol-table-show', false),
        onCounts: toggle('node-symbol-table-counts'),
        onFrequencies: toggle('node-symbol-table-frequencies')
      }),
      MT.floatingTable(view.dashWrapper, view.$('.link-dash-table-menu'), {
        onHide: () => view.settings.set('link-dash-table-show', false)
      }),
      MT.floatingTable(view.polygonWrapper, view.$('.polygon-color-table-menu'), {
        onHide: () => view.settings.set('polygon-color-table-show', false),
        onCounts: toggle('polygon-color-table-counts'),
        onFrequencies: toggle('polygon-color-table-frequencies')
      })
    ];

    // The global timeline replays itself when the window changes size
    // (once it stops: it's redrawn for every size it passes through otherwise)
    view.onWindowResize = () => {
      if (view.get('node-timeline-variable') == 'None') return;
      clearTimeout(view.resizeTimer);
      view.resizeTimer = setTimeout(() => {
        if (view.get('node-timeline-variable') == 'None') return;
        MT.showTimeline();
        setTimeout(() => fit(view), 0);
      }, 150);
    };
    window.addEventListener('resize', view.onWindowResize);
    return { floaters, tooltipMenu };
  }

  // Every setting and event the view redraws from, in the order they were made.
  // Returns what undoes them.
  function subscribeSettings(view, floaters) {
    const { pane, settings, events, symbolWrapper, polygonWrapper } = view;
    return [
      MTBind(pane, settings),
      settings.subscribe(['node-label-variable', 'node-symbol-variable', 'node-radius-variable', 'link-width-variable',
        'polygons-show', 'polygons-color-show'], () => showRows(view)),
      settings.subscribe(['node-label-variable', 'node-label-size', 'node-label-orientation'], () => redrawLabels(view)),
      settings.subscribe(['node-symbol', 'node-radius', 'node-radius-max', 'node-radius-min', 'node-radius-variable'], () => redrawNodes(view)),
      settings.subscribe(['node-symbol-variable', 'node-symbol-table-counts', 'node-symbol-table-frequencies'], () => showSymbolTable(view)),
      settings.subscribe('node-symbol-table-show', show => { symbolWrapper.hidden = !show || view.get('node-symbol-variable') == 'None'; }),
      settings.subscribe('node-border-width', () => events.emit('node-border-change')),
      settings.subscribe(['node-charge', 'network-gravity', 'network-friction', 'network-link-strength', 'link-length'], () => reheat(view)),
      settings.subscribe('link-directed', () => updateArrows(view)),
      settings.subscribe('link-dash-variable', () => updateLinkColor(view)),
      settings.subscribe('link-dash-table-show', () => showDashTable(view)),
      settings.subscribe('link-label-variable', () => drawOverlays(view)),
      settings.subscribe('link-opacity', () => setLinkOpacity(view)),
      settings.subscribe(['link-width', 'link-width-max', 'link-width-min', 'link-width-variable'], () => scaleLinkWidth(view)),
      settings.subscribe(['network-gridlines-show', 'polygon-color'], () => drawOverlays(view)),
      settings.subscribe(['polygons-show', 'polygons-foci', 'polygons-gather-force'], () => regroup(view)),
      settings.subscribe(['polygons-show', 'polygons-color-show', 'polygon-color-table-counts', 'polygon-color-table-frequencies'], () => showPolygonTable(view)),
      settings.subscribe('polygon-color-table-show', show => { polygonWrapper.hidden = !show || !view.get('polygons-show') || !view.get('polygons-color-show'); }),
      events.on('background-color-change', () => setBackground(view)),
      events.on('node-color-change', () => updateNodeColors(view)),
      events.on('link-color-change', () => updateLinkColor(view)),
      events.on('node-selected', () => updateSelection(view)),
      ...['node-visibility', 'link-visibility', 'cluster-visibility'].map(type => events.on(type, () => renderSoon(view))),
      events.on('stop-force-simulation', () => { if (view.graph) view.graph.pause(); }),
      ...floaters
    ];
  }

  // Creates the graph once cosmos.gl has loaded, and publishes the handle that
  // other code and tests use
  function startGraph(view, handle) {
    self.cosmosLoading.then(() => {
      if (view.destroyed) return;
      createGraph(view);
      // For other code and tests: the live graph and what its indices mean
      handle.graph = view.graph;
      temp.network = handle;
      render(view);
      if (view.get('node-timeline-variable') != 'None') view.onWindowResize();
      setTimeout(() => fit(view), 1200);
    }).catch(e => {
      console.error(e);
      MT.toast.error('The 2D network needs WebGL, which this browser could not start.');
    });
  }

  MT.registerView('network', (root, { settings, events }) => {
    // The network is drawn and laid out on the GPU by cosmos.gl
    // (vendor/cosmos.min.js, loaded the first time this view opens). Point i of
    // the graph is points[i] (= session.network.nodes) and link i is links[i].
    // Two 2D canvases sit under and over it: polygons and gridlines below, node
    // and link labels above.
    const view = createViewState(root, settings, events);
    // The view's own legends stack with the page's in its panel dock
    MT.panelDock(root).append(view.symbolWrapper, view.polygonWrapper, view.dashWrapper);
    loadCosmos();

    bindContextMenu(view);
    const unbindBrush = bindBrush(view);
    bindHover(view);
    const unbindKeyboard = bindKeyboard(view);
    const { floaters, tooltipMenu } = bindControls(view);
    const stop = subscribeSettings(view, floaters);
    showRows(view);
    setBackground(view);
    showSymbolTable(view);
    showDashTable(view);
    showPolygonTable(view);

    // With links from several files, the links are colored by their file
    if (session.files.length > 1 && view.get('link-color-variable') == 'None') settings.set('link-color-variable', 'origin');

    const handle = {
      graph: null,
      get points() { return view.points; },
      get links() { return view.links; },
      get paused() { return view.hidden; },
      get focused() { return view.focused; },
      focus: i => focusPoint(view, i),
      drawn: view.drawn,
      render: () => render(view),
      fit: duration => fit(view, duration),
      pinAll: () => pinAll(view),
      syncPositions: () => syncPositions(view),
      contextMenu: (i, e) => showContextMenu(view, i, null, e)
    };
    startGraph(view, handle);

    return {
      // The page's floating panels this view shows (see MT.placePanels)
      panels: ['link-colors', 'node-colors', 'statistics'],
      resize: () => drawOverlays(view),
      show: () => showView(view),
      hide: () => hideView(view),
      destroy() {
        view.destroyed = true;
        stop.forEach(fn => fn());
        unbindBrush();
        window.removeEventListener('resize', view.onWindowResize);
        clearTimeout(view.resizeTimer);
        unbindKeyboard();
        tooltipMenu.destroy();
        hideTooltip(view);
        if (view.graph) view.graph.destroy();
        view.graph = null;
        if (temp.network === handle) delete temp.network;
      }
    };
  });
})();
