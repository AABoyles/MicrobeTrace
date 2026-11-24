// The bubbles view, loaded as an ES module by src/views.js (#339). Library globals (d3, MTBind)
// stay globals; MT, the session and temp come from ctx.

export function mount(root, ctx) {
  const { MT, settings, events } = ctx;

  const $ = selector => root.querySelector(selector);
  const pane = $('.left-pane');
  const svg = d3.select($('.bubbles'));
  let width = 0, height = 0, bubbles = [];
  // The circles, kept rather than searched for on each tick of the layout
  let circles = svg.selectAll('circle');

  const simulation = d3.forceSimulation()
    .velocityDecay(0.2)
    .on('tick', () => circles.attr('cx', d => d.x).attr('cy', d => d.y));

  // The bubbles' radius: the size setting, or by default one at which they
  // pack a circle about half the view's height. The size slider shows it.
  const sizeInput = $('[data-setting="bubble-size"]');
  function radius() {
    const size = settings.get('bubble-size');
    if (size) return size;
    const fit = 0.33 * Math.min(width, height) * Math.sqrt(0.6 / Math.max(bubbles.length, 1)) - 1;
    return Math.round(Math.max(2, Math.min(30, fit)) * 10) / 10;
  }
  function resizeBubbles() {
    const r = radius();
    circles.attr('r', r);
    // They don't overlap, whatever their size
    simulation.force('collide', d3.forceCollide(r + 1).iterations(4));
    sizeInput.value = r;
  }

  // A bubble per visible node, keeping the places of those already drawn
  function update() {
    const before = new Map(bubbles.map(b => [b._id, b]));
    bubbles = MT.getVisibleNodes().map(d => {
      const old = before.get(d._id);
      return { _id: d._id, node: d, x: old ? old.x : width / 2, y: old ? old.y : height / 2 };
    });
    circles = svg.selectAll('circle')
      .data(bubbles, b => b._id)
      .join(enter => enter.append('circle')
        .attr('stroke-width', 2)
        .attr('cx', b => b.x)
        .attr('cy', b => b.y)
        .on('click', (event, b) => {
          b.node.selected = !b.node.selected;
          events.emit('node-selected', 'bubbles');
        }));
    simulation.nodes(bubbles);
    resizeBubbles();
    setColors();
    group();
  }

  function setColors() {
    const variable = settings.get('node-color-variable'), color = settings.get('node-color'), selected = settings.get('selected-color');
    circles
      .attr('stroke', b => b.node.selected ? selected : '#ffffff')
      .attr('fill', b => variable == 'None' ? color : ctx.temp.style.nodeColorMap(b.node[variable]));
  }

  // Each axis spreads the bubbles over the values of its variable, labelled,
  // or pulls them to the middle
  function group() {
    [['x', width, 'bubble-x'], ['y', height, 'bubble-y']].forEach(([axis, length, key]) => {
      const field = settings.get(key);
      const label = svg.select(`.${axis}-label`);
      const force = axis == 'x' ? d3.forceX() : d3.forceY();
      if (!field || field == 'None') {
        label.text('');
        svg.selectAll(`.${axis}title`).remove();
        simulation.force(axis, force.strength(0.03)[axis](length / 2));
        return;
      }
      label.text(MT.titleize(field));
      const values = Array.from(new Set(bubbles.map(b => b.node[field])));
      if (values.every(v => typeof v === 'number')) values.sort((a, b) => axis == 'x' ? a - b : b - a);
      else values.sort();
      const ratio = length / (values.length + 1);
      const place = v => ratio * values.indexOf(v) + ratio;
      svg.selectAll(`.${axis}title`)
        .data(values)
        .join('text')
        .attr('class', `${axis}title`)
        .attr('text-anchor', 'middle')
        .text(v => v)
        .each(function (v) {
          const title = d3.select(this);
          if (axis == 'x') title.attr('x', place(v)).attr('y', 50).attr('transform', null);
          else title.attr('x', 50).attr('y', place(v)).attr('transform', `rotate(270, 50, ${place(v)})`);
        });
      simulation.force(axis, force.strength(0.03)[axis](b => place(b.node[field])));
    });
    simulation.force('charge', d3.forceManyBody().strength(-settings.get('bubble-charge')));
    heat(1);
  }

  // Starts the layout moving; with reduced motion preferred it is settled at once
  function heat(alpha) {
    simulation.alpha(alpha);
    if (MT.reducedMotion()) {
      simulation.stop();
      simulation.tick(300);
      circles.attr('cx', d => d.x).attr('cy', d => d.y);
    } else {
      simulation.restart();
    }
  }

  function resize() {
    width = MT.viewWidth(root);
    height = root.clientHeight;
    svg.attr('width', width).attr('height', height);
    svg.select('.x-label').attr('x', width / 2);
    svg.select('.y-label').attr('x', 20).attr('y', height / 2).attr('transform', `rotate(270, 20, ${height / 2})`);
    resizeBubbles();
    group();
  }

  function setBackground() {
    svg.style('background-color', settings.get('background-color'));
    svg.style('fill', settings.get('background-color-contrast'));
  }

  MT.paneToggle($('.settings-toggle'), pane, false, { beside: svg.node(), resize });
  MT.svgExport(root, () => svg.node(), settings);

  const stop = [
    MTBind(pane, settings),
    settings.subscribe(['bubble-x', 'bubble-y', 'bubble-charge'], group),
    settings.subscribe('bubble-size', () => {
      resizeBubbles();
      heat(0.3);
    }),
    events.on('background-color-change', setBackground),
    ...['node-color-change', 'selected-color-change', 'node-selected'].map(type => events.on(type, setColors)),
    ...['node-visibility', 'cluster-visibility'].map(type => events.on(type, update))
  ];
  width = MT.viewWidth(root);
  height = root.clientHeight;
  update();
  resize();
  setBackground();

  return {
    // The page's floating panels this view shows (see MT.placePanels)
    panels: ['node-colors'],
    resize,
    destroy() {
      stop.forEach(fn => fn());
      simulation.stop();
    }
  };
}
