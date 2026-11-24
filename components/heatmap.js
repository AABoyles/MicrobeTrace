// The heatmap view, loaded as an ES module by src/views.js (#339). Library globals (Plotly, XLSX) stay globals; MT comes from ctx.
export const libraries = ['plotly'];

export function mount(root, ctx) {
  const { MT, settings, events } = ctx;

  const $ = selector => root.querySelector(selector);
  const plot = $('.heatmap-plot');
  const pane = $('.left-pane');

  // The distance matrix and its labels as last drawn (before any inversion),
  // for export
  let labels = [], matrix = new Float64Array(0);
  const missingColor = '#d0d0d0';
  // Plotly draws every cell as an element of its own, so the heatmap stops
  // short of the most nodes MT.getDM could build for (#248)
  const maxNodes = 3000;
  // The matrix is computed in a worker, shown in the view as it is (#293)
  const computing = MT.viewComputing(root, 'the distance matrix');

  function draw() {
    const width = MT.viewWidth(root), height = root.clientHeight;
    // A view in a background tab has no size; it draws when it's shown
    if (!width || !height) return;
    // Too many nodes: say so where the heatmap would be
    const tooLarge = MT.dmTooLargeMessage(maxNodes);
    if (tooLarge) {
      computing.stop();
      labels = [];
      matrix = new Float64Array(0);
      if (plot.data) Plotly.purge(plot);
      plot.textContent = tooLarge;
      return;
    }
    // (A draw that starts while another waits replaces it: see MT.viewComputing)
    const rowLabels = MT.getDMLabels();
    computing.run((scope, onProgress) => MT.getDM(maxNodes, { scope, onProgress }), dm => drawMatrix(dm, rowLabels));
  }

  function drawMatrix(dm, rowLabels) {
    const width = MT.viewWidth(root), height = root.clientHeight;
    if (!plot.data) plot.textContent = '';
    labels = rowLabels;
    matrix = dm;
    const n = labels.length;
    // The nodes' own ids, as categories (numeric ids would make a number line)
    let x = labels.map(String), y = x.slice();
    // Rows of the matrix: views of it, or reversed copies when inverted
    let z = new Array(n);
    for (let i = 0; i < n; i++) z[i] = dm.subarray(i * n, (i + 1) * n);
    if (settings.get('heatmap-invertX')) {
      z = z.map(row => row.slice().reverse());
      x.reverse();
    }
    if (settings.get('heatmap-invertY')) {
      z = z.slice().reverse();
      y.reverse();
    }
    const showLabels = settings.get('heatmap-axislabels-show');
    const axis = { type: 'category', autotick: false, showticklabels: showLabels, ticks: showLabels ? undefined : '', automargin: true };
    const metric = MT.titleize(settings.get('link-sort-variable'));
    // Pairs without a distance show the grey behind the cells, said in a note
    let missing = false;
    for (let i = 0; i < dm.length && !missing; i++) missing = dm[i] !== dm[i];
    Plotly.react(plot, [{
      x, y, z,
      type: 'heatmap',
      hoverongaps: false,
      hovertemplate: '%{y} and %{x}: %{z}<extra></extra>',
      colorbar: { title: { text: metric } },
      colorscale: [
        [0, settings.get('heatmap-color-low')],
        [0.5, settings.get('heatmap-color-medium')],
        [1, settings.get('heatmap-color-high')]
      ]
    }], {
      width, height,
      xaxis: axis,
      yaxis: axis,
      ...MT.plotLayout(root, settings),
      plot_bgcolor: missingColor,
      annotations: missing ? [{
        text: '<span style="color:' + missingColor + '">■</span> No ' + (MT.fieldMetric(settings.get('link-sort-variable')) ? metric : metric.toLowerCase()),
        xref: 'paper', yref: 'paper', x: 1, y: 1, xanchor: 'right', yanchor: 'bottom', yshift: 4, showarrow: false
      }] : []
    }, {
      displaylogo: false,
      displayModeBar: false
    });
  }

  // A new size needs no new matrix
  function resize() {
    if (!plot.data) return draw();
    if (MT.viewWidth(root) > 0 && root.clientHeight) Plotly.relayout(plot, { width: MT.viewWidth(root), height: root.clientHeight });
  }

  const table = () => {
    const n = labels.length;
    return [[''].concat(labels)].concat(labels.map((label, i) =>
      [label].concat(Array.from(matrix.subarray(i * n, (i + 1) * n), v => v === v ? v : null))));
  };
  MT.paneToggle($('.settings-toggle'), pane, false, { beside: $('.heatmap-plot'), resize });
  MT.plotExport(root, plot, settings, {
    csv: filename => MT.exportBlob(MT.toCSV(table()), 'text/csv', filename + '.csv'),
    xlsx: async filename => {
      await MT.loadLibrary('xlsx');
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(table()), 'Distances');
      XLSX.writeFile(workbook, filename + '.xlsx');
    }
  });

  const stop = [
    MTBind(pane, settings),
    settings.subscribe(['heatmap-invertX', 'heatmap-invertY', 'heatmap-axislabels-show', 'heatmap-color-low', 'heatmap-color-medium', 'heatmap-color-high'], draw),
    events.on('background-color-change', () => plot.data && Plotly.relayout(plot, { ...MT.plotColors(settings), plot_bgcolor: missingColor }))
  ];
  draw();

  return {
    resize,
    destroy() {
      stop.forEach(fn => fn());
      computing.destroy();
      Plotly.purge(plot);
    }
  };
}
