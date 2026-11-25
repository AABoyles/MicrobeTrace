// The Sankey diagram view, loaded as an ES module by src/views.js (#339). Library globals (d3, d3Sankey,
// MTBind) stay globals; MT and the session come from ctx.
export const libraries = ['sankey'];

// The settings each open copy of this view keeps to itself (#365)
export const settingsPrefix = 'sankey-';

export function mount(root, ctx) {
  const { MT, settings, events } = ctx;

  const $ = selector => root.querySelector(selector);
  const plot = $('.sankey-plot');
  const pane = $('.left-pane');
  const list = $('.sankey-variables');
  const svg = d3.select(plot).append('svg').attr('class', 'sankey-svg').attr('font-family', 'sans-serif').attr('font-size', 12);

  const fields = () => ctx.session.data[settings.get('sankey-showNodes') ? 'nodeFields' : 'linkFields'];
  const fill = (select, value) => MT.fillSelect(select, fields(), { selected: value });
  // A variable the dataset doesn't have becomes its cluster, or first field
  const valid = value => fields().includes(value) ? value : fields().includes('cluster') ? 'cluster' : fields()[0];

  function addVariable(value) {
    const item = document.createElement('li');
    item.className = 'sankey-items';
    item.innerHTML = `<span class="bi bi-x sankey-remove" title="Remove this variable"></span>
      <select class="form-select form-select-sm sankey-selector" aria-label="Sankey variable"></select>
      <span class="bi bi-grip-vertical" title="Drag to reorder"></span>`;
    fill(item.querySelector('select'), valid(value));
    list.appendChild(item);
    MT.sortable(list, 'reload');
  }

  function showFields() {
    list.querySelectorAll('select').forEach(select => fill(select, valid(select.value)));
  }

  // One sankey column per variable, with a node per value; links count the
  // items going from each value to each value of the next variable.
  function draw() {
    const width = MT.viewWidth(root), height = root.clientHeight;
    // A view in a background tab has no size; it draws when it's shown
    if (width <= 0 || height <= 0) return;
    const showNodes = settings.get('sankey-showNodes');
    const items = showNodes ? MT.getVisibleNodes() : MT.getVisibleLinks();
    const order = Array.from(list.querySelectorAll('select'), select => select.value);

    const index = new Map(), nodes = [];
    order.forEach((variable, column) => {
      // Each column's values in order (numbers by number), empty ones last
      const empty = value => MT.valueLabel(value) != value; // eslint-disable-line eqeqeq -- a value may be a number whose label is its text
      const sizes = d3.rollup(items, v => v.length, d => d[variable] + '');
      Array.from(sizes.keys())
        .sort((a, b) => empty(a) - empty(b) || a.localeCompare(b, undefined, { numeric: true }))
        .forEach(value => {
          index.set(column + '\u0000' + value, nodes.length);
          nodes.push({ index: nodes.length, column, label: MT.valueLabel(value), variable: MT.titleize(variable), fixedValue: sizes.get(value) });
        });
    });
    const counts = new Map();
    for (let column = 0; column < order.length - 1; column++) {
      items.forEach(d => {
        const key = index.get(column + '\u0000' + d[order[column]]) + ',' + index.get((column + 1) + '\u0000' + d[order[column + 1]]);
        counts.set(key, (counts.get(key) || 0) + 1);
      });
    }
    const links = Array.from(counts, ([key, value]) => {
      const [source, target] = key.split(',').map(Number);
      return { source, target, value };
    });

    svg.selectAll('*').remove();
    svg.attr('width', width).attr('height', height).style('color', settings.get('background-color-contrast'));
    plot.style.background = settings.get('background-color');
    if (!nodes.length) return;
    const left = 20, right = width - 20 - MT.dockRoom(root), top = 80, bottom = Math.max(top + 20, height - 20);
    const longest = d3.max(d3.rollup(nodes, v => v.length, d => d.column).values());
    // Each column's values keep their order, top to bottom, each as tall as its flow
    const graph = d3Sankey.sankey()
      .nodeId(d => d.index)
      .nodeAlign(d => d.column)
      .nodeSort(null)
      .nodeWidth(30)
      // (Gaps take no more than 40% of the height, however many values)
      .nodePadding(Math.min(15, 0.4 * (bottom - top) / longest))
      .iterations(0)
      .extent([[left, top], [Math.max(left + 60, right), bottom]])({ nodes, links });
    // A lone column is in the middle (and has no other to space it from)
    if (order.length < 2) graph.nodes.forEach(d => { d.x0 = (left + right) / 2 - 15; d.x1 = d.x0 + 30; });

    const noun = showNodes ? 'node' : 'link';
    const count = n => `${n.toLocaleString()} ${n === 1 ? noun : noun + 's'}`;
    svg.append('g').attr('class', 'sankey-links').attr('fill', 'none').attr('stroke', 'currentColor').attr('stroke-opacity', 0.2)
      .selectAll('path').data(graph.links).join('path')
      .attr('d', d3Sankey.sankeyLinkHorizontal()).attr('stroke-width', d => Math.max(1, d.width)).attr('data-value', d => d.value)
      .append('title').text(d => `${d.source.label} to ${d.target.label}: ${count(d.value)}`);
    const color = settings.get(showNodes ? 'node-color' : 'link-color');
    svg.append('g').attr('class', 'sankey-nodes').selectAll('rect').data(graph.nodes).join('rect')
      .attr('x', d => d.x0).attr('y', d => d.y0).attr('width', d => d.x1 - d.x0).attr('height', d => Math.max(1, d.y1 - d.y0))
      .attr('fill', color).attr('stroke', 'black').attr('stroke-width', 0.5)
      .attr('data-label', d => d.label).attr('data-variable', d => d.variable)
      .append('title').text(d => `${d.variable}: ${d.label}: ${count(d.value)}`);
    // Beside each value, inside the diagram, where there's room to read it
    const last = order.length - 1;
    svg.append('g').attr('class', 'sankey-labels').attr('fill', 'currentColor').selectAll('text')
      .data(graph.nodes.filter(d => d.y1 - d.y0 >= 11 || longest < (bottom - top) / 14)).join('text')
      .attr('x', d => last && d.column === last ? d.x0 - 6 : d.x1 + 6).attr('text-anchor', d => last && d.column === last ? 'end' : 'start')
      .attr('y', d => (d.y0 + d.y1) / 2).attr('dy', '0.35em').text(d => d.label);
    // Each column named above it
    svg.append('g').attr('class', 'sankey-headings').attr('fill', 'currentColor').attr('font-weight', 'bold').attr('font-size', 14)
      .selectAll('text').data(order).join('text')
      .attr('y', top - 12)
      .attr('x', (variable, i) => last ? left + (Math.max(left + 60, right) - left) * i / last : (left + right) / 2)
      .attr('text-anchor', (variable, i) => !last ? 'middle' : i === 0 ? 'start' : i === last ? 'end' : 'middle')
      .text(variable => MT.titleize(variable));
  }

  MT.paneToggle($('.settings-toggle'), pane, false, { beside: $('.sankey-plot'), resize: draw });
  MT.svgExport(root, () => svg.node(), settings);

  $('.sankey-add-variable').addEventListener('click', () => {
    addVariable('cluster');
    draw();
  });
  list.addEventListener('change', draw);
  list.addEventListener('click', e => {
    if (!e.target.classList.contains('sankey-remove')) return;
    e.target.closest('li').remove();
    draw();
  });
  MT.sortable(list, { forcePlaceholderSize: true });
  list.addEventListener('sortupdate', draw);

  // Older sessions store the dataset as something other than a boolean
  settings.set('sankey-showNodes', !!settings.get('sankey-showNodes'));
  // It starts on the first two categorical fields, or the clusters
  const items = settings.get('sankey-showNodes') ? MT.getVisibleNodes() : MT.getVisibleLinks();
  const [first = 'cluster', second = first] = MT.categoricalFields(items, fields());
  addVariable(first);
  addVariable(second);
  const stop = [
    MTBind(pane, settings),
    settings.subscribe('sankey-showNodes', () => { showFields(); draw(); }),
    ...['node-selected', 'node-visibility', 'link-visibility', 'node-color-change', 'link-color-change']
      .map(type => events.on(type, draw)),
    events.on('background-color-change', draw),
    // Clear of the tables docked at the right
    MT.onDockChange(root, draw)
  ];
  draw();

  return {
    resize: draw,
    destroy() {
      stop.forEach(fn => fn());
      MT.sortable(list, 'destroy');
    }
  };
}
