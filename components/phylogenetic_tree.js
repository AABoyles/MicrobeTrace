  MT.registerView('phylogenetic_tree', (root, { settings, events }) => {

    const $ = selector => root.querySelector(selector);
    const pane = $('.left-pane');
    const container = $('.tree');
    const menu = $('.tree-context-menu');
    // The tree drawn, and the data it draws (rerooted, rotated and so on)
    let tree = null, data = null, size = null, destroyed = false;

    // The layout and branch mode are one setting each. Older sessions keep one
    // boolean per choice: read those when there's no setting, and keep them in
    // step.
    const choices = { 'tree-layout': ['vertical', 'horizontal', 'circular'], 'tree-mode': ['square', 'smooth', 'straight'] };
    const fallback = { 'tree-layout': 'horizontal', 'tree-mode': 'square' };
    Object.entries(choices).forEach(([key, values]) => {
      if (!values.includes(settings.get(key))) settings.set(key, values.find(v => settings.get(`${key}-${v}`)) || fallback[key]);
    });
    const syncChoice = key => value => choices[key].forEach(v => settings.set(`${key}-${v}`, v == value));
    Object.keys(choices).forEach(key => syncChoice(key)(settings.get(key)));
    if (settings.get('tree-leaf-tooltip-variable') === undefined) settings.set('tree-leaf-tooltip-variable', '_id');

    // Leaves can be sized by a node variable, or by one of the tree's own
    // ('respresenting' is patristic's own spelling, so it stays the value; the label is spelled right)
    const treeVariables = ['height', 'depth', 'length', 'respresenting', 'value'];
    MT.fillSelect($('[data-setting="tree-leaf-node-radius-variable"]'), treeVariables, { append: true });
    Array.from(root.querySelectorAll('[data-setting="tree-leaf-node-radius-variable"] option')).forEach(o => { if (o.value == 'respresenting') o.textContent = 'Representing'; });

    // TidyTree hands its handlers the arguments of its d3 listener: the event
    // (whose target's datum is the tree node), or under d3 v5 the tree node
    const eventOf = args => args[0] instanceof Event ? args[0] : d3.event;
    const branchOf = args => args[0] instanceof Event ? d3.select(args[0].currentTarget).datum() : args[0];
    const nodeOf = id => session.data.nodes.find(d => d._id == id);

    function draw() {
      if (!data || !root.clientWidth || !root.clientHeight) return;
      size = [root.clientWidth, root.clientHeight];
      if (tree) tree.destroy();
      tree = new TidyTree(data, {
        parent: container,
        layout: settings.get('tree-layout'),
        type: settings.get('tree-type'),
        mode: settings.get('tree-mode'),
        animation: 0,
        hStretch: settings.get('tree-horizontal-stretch'),
        vStretch: settings.get('tree-vertical-stretch'),
        ruler: settings.get('tree-ruler-show'),
        branchNodes: settings.get('tree-branch-nodes-show'),
        branchDistances: !settings.get('tree-branch-distances-hide'),
        leafNodes: settings.get('tree-leaf-node-show'),
        leafLabels: settings.get('tree-leaf-label-show'),
        // (Clear of the color table docked at the right)
        margin: [60, 100 + MT.dockRoom(root), 60, 60]
      }, {
        select,
        contextmenu: showMenu,
        showtooltip: showTooltip,
        hidetooltip: () => MT.tooltip(null)
      });
      tree.setAnimation(settings.get('tree-animation-on') ? 1200 : 0);
      style();
    }

    // Leaf sizes, colors, selection, tooltips and labels, and branch distances
    function style() {
      if (!tree) return;
      const nodes = new Map(session.data.nodes.map(d => [d._id, d]));
      const variable = settings.get('node-color-variable'), color = settings.get('node-color'), selected = settings.get('selected-color');
      const tooltip = settings.get('tree-leaf-tooltip-variable'), label = settings.get('tree-leaf-label-variable');
      const radius = radiusOf(nodes);
      leafCircles().forEach((c, i) => {
        const d = d3.select(c).datum();
        c.setAttribute('tabindex', i == 0 ? 0 : -1);
        c.setAttribute('role', 'button');
        c.setAttribute('aria-haspopup', 'menu');
        c.setAttribute('aria-label', 'Tree branch ' + d.data.id + ', press Enter for its menu');
      });
      tree.eachLeafNode((circle, d) => {
        const node = nodes.get(d.data.id);
        d3.select(circle)
          .attr('r', radius(d, node))
          .attr('title', node && tooltip && tooltip != 'None' ? (node[tooltip] == null ? '' : node[tooltip]) : d.data.id)
          .style('fill', node && variable != 'None' ? temp.style.nodeColorMap(node[variable]) : color)
          .style('stroke', node && node.selected ? selected : '#ffffff')
          .style('stroke-width', node && node.selected ? 2 : 1);
      });
      tree.eachLeafLabel((text, d) => {
        const node = nodes.get(d.data.id);
        d3.select(text)
          .text(node && label && label != 'None' ? (node[label] == null ? '' : node[label]) : d.data.id)
          .attr('dx', 8)
          .style('font-size', settings.get('tree-leaf-label-size') + 'px');
      });
      styleBranchDistances();
    }

    // The branch distances, rounded or not, at their size. Only what differs
    // is set, so the watcher below doesn't see its own changes.
    function styleBranchDistances() {
      if (!tree || destroyed) return;
      const round = settings.get('tree-round-true'), size = settings.get('tree-branch-distance-size') + 'px';
      tree.eachBranchDistance((text, d) => {
        const length = d.target.data.length || 0;
        const label = round ? '' + Math.round(length) : length.toFixed(3);
        if (text.textContent != label) text.textContent = label;
        if (text.style.fontSize != size) text.style.fontSize = size;
      });
    }
    // An animated redraw resets the labels' text halfway through, after
    // style() has run: style them again whenever the tree changes
    let restyling = false;
    const labelWatcher = new MutationObserver(() => {
      if (restyling) return;
      restyling = true;
      requestAnimationFrame(() => {
        restyling = false;
        styleBranchDistances();
      });
    });
    labelWatcher.observe(container, { subtree: true, childList: true, characterData: true });

    // The leaves' size by default: just under half the usual space between
    // neighboring leaves, so they don't overlap
    function fittedRadius() {
      const circular = settings.get('tree-layout') == 'circular';
      const leaves = [];
      tree.eachLeafNode((circle, d) => leaves.push(d));
      leaves.sort((a, b) => a.x - b.x);
      // Across the layout's breadth: pixels, or for a circle, angle times radius
      const gaps = leaves.slice(1)
        .map((d, i) => (d.x - leaves[i].x) * (circular ? Math.min(d.y, leaves[i].y) : 1))
        .filter(gap => gap > 0)
        .sort((a, b) => a - b);
      const gap = gaps.length ? gaps[Math.floor(gaps.length / 2)] : 20;
      return Math.round(Math.max(1.5, Math.min(9, 0.45 * gap)) * 10) / 10;
    }

    // A leaf's radius: the size setting (or the fitted size, which its slider
    // shows), or scaled to it by the size variable
    function radiusOf(nodes) {
      const v = settings.get('tree-leaf-node-radius-variable');
      let cap = settings.get('tree-leaf-node-size');
      if (!cap) $('[data-setting="tree-leaf-node-size"]').value = cap = fittedRadius();
      if (!v || v == 'None') return () => cap;
      const value = (d, node) => treeVariables.includes(v) ? d.data[v] : node && node[v];
      const values = [];
      tree.eachLeafNode((circle, d) => {
        const x = parseFloat(value(d, nodes.get(d.data.id)));
        if (isFinite(x)) values.push(x);
      });
      const [min, max] = d3.extent(values);
      if (min === undefined || min == max) return () => cap;
      const least = Math.min(4, cap);
      const scale = d3.scaleLinear().domain([min, max]).range([least, cap]);
      return (d, node) => {
        const x = parseFloat(value(d, node));
        return isFinite(x) ? scale(x) : least;
      };
    }

    // Clicking a leaf selects its node alone (with Ctrl, adds or removes it)
    function select(args) {
      const e = eventOf(args), node = nodeOf(branchOf(args).data.id);
      e.preventDefault();
      if (!node) return;
      const was = node.selected;
      if (!e.ctrlKey) session.data.nodes.forEach(d => d.selected = false);
      node.selected = !was;
      events.emit('node-selected', 'phylogenetic_tree');
    }

    function showTooltip(args) {
      if (!settings.get('tree-tooltip-show')) return;
      const e = eventOf(args);
      MT.tooltip(MT.escape(e.target.getAttribute('title')), e);
    }

    // The context menu: rotate, flip or reroot at a branch
    let target = null;
    let menuOpener = null;
    function openMenu(branch, x, y, opener) {
      const box = root.getBoundingClientRect();
      MT.tooltip(null);
      target = branch;
      menuOpener = opener || null;
      Object.assign(menu.style, { display: 'block', opacity: 1, zIndex: 1000, left: (x - box.left) + 'px', top: (y - box.top) + 'px' });
    }
    function showMenu(args) {
      const e = eventOf(args);
      e.preventDefault();
      openMenu(branchOf(args).data, e.clientX, e.clientY);
    }
    const hideMenu = () => { menu.style.display = 'none'; };
    // The same menu from the keyboard (#185): the leaves are a list to arrow
    // through (one tab stop), Enter, the menu key or Shift+F10 opens the menu
    // for the one in focus, and so does the Tree menu button (for the root if no
    // leaf has been chosen)
    const leafCircles = () => Array.from(container.querySelectorAll('svg circle')).filter(c => { const d = d3.select(c).datum(); return d && d.data; });
    const openMenuAt = (circle, opener) => {
      const box = (circle || opener).getBoundingClientRect();
      openMenu(circle ? d3.select(circle).datum().data : data, box.left, box.bottom, opener || circle);
      const first = menu.querySelector('[data-action]');
      if (first) first.focus();
    };
    container.addEventListener('keydown', e => {
      const circles = leafCircles(), at = circles.indexOf(e.target);
      if (at < 0) return;
      const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
      if (step) {
        e.preventDefault();
        circles.forEach(c => c.setAttribute('tabindex', -1));
        const next = circles[(at + step + circles.length) % circles.length];
        next.setAttribute('tabindex', 0);
        next.focus();
      } else if (e.key == 'Enter' || e.key == 'ContextMenu' || (e.key == 'F10' && e.shiftKey)) {
        e.preventDefault();
        openMenuAt(e.target);
      }
    });
    $('.tree-menu-button').addEventListener('click', e => {
      const circle = leafCircles().find(c => c.getAttribute('tabindex') == '0' && c === document.activeElement) || null;
      openMenuAt(circle, e.currentTarget);
    });
    // (Taken before Bootstrap's dropdown keys, which look for a toggle this menu doesn't have)
    const menuKeys = e => {
      if (!menu.contains(e.target)) return;
      if (['ArrowDown', 'ArrowUp', 'Escape', 'Tab'].includes(e.key)) e.stopPropagation();
      const items = Array.from(menu.querySelectorAll('[data-action]')), at = items.indexOf(document.activeElement);
      if (e.key == 'ArrowDown' || e.key == 'ArrowUp') {
        e.preventDefault();
        items[(at + (e.key == 'ArrowDown' ? 1 : items.length - 1)) % items.length].focus();
      } else if (e.key == 'Escape' || e.key == 'Tab') {
        if (e.key == 'Escape') e.preventDefault();
        hideMenu();
        if (menuOpener) menuOpener.focus();
      }
    };
    window.addEventListener('keydown', menuKeys, true);
    menu.addEventListener('click', e => {
      const item = e.target.closest('[data-action]');
      if (!item || !target) return;
      e.preventDefault();
      const action = item.dataset.action;
      setData(action == 'reroot' ? target.reroot() : action == 'rotate' ? target.rotate().getRoot() : target.flip().getRoot());
      hideMenu();
    });
    container.addEventListener('click', hideMenu);

    function setData(newData) {
      data = newData;
      tree.setData(data);
      style();
    }
    $('.simplify-button').addEventListener('click', () => setData(data.simplify()));
    $('.consolidate-button').addEventListener('click', () => setData(data.consolidate()));
    $('.fit-button').addEventListener('click', () => tree && tree.recenter());

    // The Label and Tooltip menus also turn what they name on and off: None
    // hides it, anything else shows it (an older session's shown labels of
    // None show the ID)
    const menuToggles = [];
    [['tree-leaf-label-variable', 'tree-leaf-label-show'], ['tree-leaf-tooltip-variable', 'tree-tooltip-show']].forEach(([variable, show]) => {
      const sync = () => {
        if (settings.get(show) && settings.get(variable) == 'None') settings.set(variable, '_id');
        else if (!settings.get(show) && settings.get(variable) != 'None') settings.set(variable, 'None');
      };
      sync();
      menuToggles.push(
        settings.subscribe(variable, value => { if (settings.get(show) != (value != 'None')) settings.set(show, value != 'None'); }),
        settings.subscribe(show, sync)
      );
    });

    // Rows that only apply with some settings
    function showRows() {
      const rows = (selector, show) => root.querySelectorAll(selector).forEach(row => row.hidden = !show);
      rows('.hideForCircular', settings.get('tree-layout') != 'circular');
      rows('.tree-branch-distance-row', !settings.get('tree-branch-distances-hide'));
      rows('.tree-leaf-label-size-row', settings.get('tree-leaf-label-show'));
      rows('.tree-leaf-node-row', settings.get('tree-leaf-node-show'));
    }

    // A change to the tree, then restyling what it redrew
    const change = fn => value => {
      showRows();
      if (!tree) return;
      fn(value);
      style();
    };
    const instantly = fn => value => {
      const animation = tree.animation;
      tree.setAnimation(0);
      fn(value);
      tree.setAnimation(animation);
    };

    const setBackground = () => { container.style.backgroundColor = settings.get('background-color'); };

    MT.paneToggle($('.settings-toggle'), pane);
    MT.svgExport(root, () => container.querySelector('svg'), settings, {
      nwk: filename => MT.saveAs(new Blob([data.toNewick()], { type: 'application/newick;charset=utf-8' }), filename + '.nwk')
    });

    const stop = [
      MTBind(pane, settings),
      ...Object.keys(choices).map(key => settings.subscribe(key, syncChoice(key))),
      ...menuToggles,
      settings.subscribe('tree-layout', change(v => tree.setLayout(v).recenter())),
      settings.subscribe('tree-mode', change(v => tree.setMode(v))),
      settings.subscribe('tree-type', change(v => tree.setType(v))),
      settings.subscribe('tree-vertical-stretch', change(instantly(v => tree.setVStretch(v)))),
      settings.subscribe('tree-horizontal-stretch', change(instantly(v => tree.setHStretch(v)))),
      settings.subscribe('tree-ruler-show', change(v => tree.setRuler(v))),
      settings.subscribe('tree-animation-on', change(v => tree.setAnimation(v ? 1200 : 0))),
      settings.subscribe('tree-branch-nodes-show', change(v => tree.setBranchNodes(v))),
      settings.subscribe('tree-branch-distances-hide', change(v => tree.setBranchDistances(!v))),
      settings.subscribe('tree-leaf-label-show', change(v => tree.setLeafLabels(v))),
      settings.subscribe('tree-leaf-node-show', change(v => tree.setLeafNodes(v))),
      settings.subscribe(['tree-round-true', 'tree-branch-distance-size', 'tree-leaf-label-size', 'tree-leaf-node-size',
        'tree-leaf-node-radius-variable', 'tree-leaf-label-variable', 'tree-leaf-tooltip-variable'], style),
      ...['node-color-change', 'selected-color-change', 'node-selected'].map(type => events.on(type, style)),
      events.on('background-color-change', setBackground),
      // Laid out again when the docked table comes, goes or grows
      MT.onDockChange(root, draw)
    ];
    showRows();
    setBackground();

    // The tree: the one given as a newick file, or one computed from the distances
    (async () => {
      if (!temp.tree) {
        if (session.files.length == 1 && session.files[0].format == 'newick') temp.tree = patristic.parseNewick(session.files[0].contents);
        else await MT.computeTree();
      }
      if (destroyed) return;
      data = temp.tree.clone();
      draw();
    })().catch(error => {
      console.error(error);
      MT.toast.error("The tree couldn't be built: " + MT.escape((error && error.message) || '' + error) + '.');
    });

    const handle = temp.phylogeneticTree = { get tree() { return tree; } };
    return {
      // The page's floating panels this view shows (see MT.placePanels)
      panels: ['node-colors'],
      // TidyTree lays the tree out for the size it's drawn at
      resize() {
        if (!size || size[0] != root.clientWidth || size[1] != root.clientHeight) draw();
      },
      destroy() {
        destroyed = true;
        labelWatcher.disconnect();
        stop.forEach(fn => fn());
        window.removeEventListener('keydown', menuKeys, true);
        MT.tooltip(null);
        if (tree) tree.destroy();
        if (temp.phylogeneticTree === handle) delete temp.phylogeneticTree;
      }
    };
  });
