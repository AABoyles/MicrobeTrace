// The flow diagram view, loaded as an ES module by src/views.js (#339). Library globals (Plotly, d3, MTBind) stay globals; MT and the session come from ctx.
export const libraries = ['plotly'];

export function mount(root, ctx) {
  const { MT, settings, events } = ctx;

  const $ = selector => root.querySelector(selector);
  const plot = $('.flow-plot');
  const pane = $('.left-pane');
  const list = $('.flow-variables');

  const fields = () => ctx.session.data[settings.get('flow-showNodes') ? 'nodeFields' : 'linkFields'];
  const fill = (select, value) => MT.fillSelect(select, fields(), { selected: value });
  // A variable the dataset doesn't have becomes its cluster, or first field
  const valid = value => fields().includes(value) ? value : fields().includes('cluster') ? 'cluster' : fields()[0];

  function addVariable(value) {
    const item = document.createElement('li');
    item.className = 'flow-items';
    item.innerHTML = `<span class="bi bi-x flow-remove" title="Remove this variable"></span>
      <select class="form-select form-select-sm flow-selector" aria-label="Flow variable"></select>
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
    const nodes = settings.get('flow-showNodes');
    const items = nodes ? MT.getVisibleNodes() : MT.getVisibleLinks();
    const order = Array.from(list.querySelectorAll('select'), select => select.value);

    const index = new Map(), labels = [], columns = [];
    order.forEach((variable, column) => {
      // Each column's values in order (numbers by number), empty ones last
      const empty = value => MT.valueLabel(value) != value; // eslint-disable-line eqeqeq -- a value may be a number whose label is its text
      Array.from(new Set(items.map(d => d[variable] + '')))
        .sort((a, b) => empty(a) - empty(b) || a.localeCompare(b, undefined, { numeric: true }))
        .forEach(value => {
          index.set(column + '\u0000' + value, labels.length);
          labels.push(MT.valueLabel(value));
          columns.push(MT.titleize(variable));
        });
    });
    const counts = new Map();
    for (let column = 0; column < order.length - 1; column++) {
      items.forEach(d => {
        const key = index.get(column + '\u0000' + d[order[column]]) + ',' + index.get((column + 1) + '\u0000' + d[order[column + 1]]);
        counts.set(key, (counts.get(key) || 0) + 1);
      });
    }
    const source = [], target = [], value = [];
    counts.forEach((count, key) => {
      const [s, t] = key.split(',').map(Number);
      source.push(s);
      target.push(t);
      value.push(count);
    });
    // Plotly would reorder each column's values; placing them keeps their
    // order, top to bottom, each as tall as its flow
    const flow = labels.map((label, i) => Math.max(
      d3.sum(value.filter((v, j) => source[j] === i)),
      d3.sum(value.filter((v, j) => target[j] === i))
    ));
    const column = [], x = [], y = [];
    index.forEach((i, key) => { column[i] = +key.split('\u0000')[0]; });
    const edge = 0.001;
    order.forEach((variable, c) => {
      const members = column.map((m, i) => m === c ? i : -1).filter(i => i >= 0);
      const total = d3.sum(members, i => flow[i]) || 1;
      let above = 0;
      members.forEach(i => {
        // (The last column's bars are drawn right of their place)
        x[i] = order.length > 1 ? Math.min(0.97, Math.max(edge, c / (order.length - 1))) : 0.5;
        y[i] = Math.min(1 - edge, Math.max(edge, (above + flow[i] / 2) / total));
        above += flow[i];
      });
    });

    Plotly.react(plot, [{
      type: 'sankey',
      orientation: 'h',
      arrangement: 'snap',
      node: {
        pad: 15,
        thickness: 30,
        line: { color: 'black', width: 0.5 },
        label: labels,
        x, y,
        color: settings.get(nodes ? 'node-color' : 'link-color'),
        customdata: columns,
        hovertemplate: '<b> %{customdata}:  %{label} </b><br>Incoming flow count: %{targetLinks.length} <br>Outgoing flow count: %{sourceLinks.length}<extra>%{value}</extra>'
      },
      link: { source, target, value },
      textfont: { size: 12 }
    }], {
      width, height,
      ...MT.plotLayout(root, settings),
      // Each column named above it
      annotations: order.map((variable, i) => ({
        text: '<b>' + MT.titleize(variable) + '</b>',
        xref: 'paper', yref: 'paper', y: 1, yanchor: 'bottom', yshift: 6, showarrow: false,
        x: order.length > 1 ? i / (order.length - 1) : 0.5,
        xanchor: order.length < 2 ? 'center' : i === 0 ? 'left' : i === order.length - 1 ? 'right' : 'center'
      }))
    }, {
      displaylogo: false,
      displayModeBar: false
    });
  }

  MT.paneToggle($('.settings-toggle'), pane, false, { beside: $('.flow-plot'), resize: draw });
  MT.plotExport(root, plot, settings);

  $('.flow-add-variable').addEventListener('click', () => {
    addVariable('cluster');
    draw();
  });
  list.addEventListener('change', draw);
  list.addEventListener('click', e => {
    if (!e.target.classList.contains('flow-remove')) return;
    e.target.closest('li').remove();
    draw();
  });
  MT.sortable(list, { forcePlaceholderSize: true });
  list.addEventListener('sortupdate', draw);

  // Older sessions store the dataset as something other than a boolean
  settings.set('flow-showNodes', !!settings.get('flow-showNodes'));
  // It starts on the first two categorical fields, or the clusters
  const items = settings.get('flow-showNodes') ? MT.getVisibleNodes() : MT.getVisibleLinks();
  const [first = 'cluster', second = first] = MT.categoricalFields(items, fields());
  addVariable(first);
  addVariable(second);
  const stop = [
    MTBind(pane, settings),
    settings.subscribe('flow-showNodes', () => { showFields(); draw(); }),
    ...['node-selected', 'node-visibility', 'link-visibility', 'node-color-change', 'link-color-change']
      .map(type => events.on(type, draw)),
    events.on('background-color-change', () => plot.data && Plotly.relayout(plot, MT.plotColors(settings)))
  ];
  draw();

  return {
    resize: draw,
    destroy() {
      stop.forEach(fn => fn());
      MT.sortable(list, 'destroy');
      Plotly.purge(plot);
    }
  };
}
