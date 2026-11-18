  MT.registerView('heatmap', (root, { settings, events }) => {

    const $ = selector => root.querySelector(selector);
    const plot = $('.heatmap-plot');
    const pane = $('.left-pane');

    // The distance matrix and its labels as last drawn (before any inversion),
    // for export
    let labels = [], matrix = [], drawing = 0;
    const missingColor = '#d0d0d0';

    async function draw() {
      const width = MT.viewWidth(root), height = root.clientHeight;
      // A view in a background tab has no size; it draws when it's shown
      if (!width || !height) return;
      const ticket = ++drawing;
      const dm = await MT.getDM();
      // A newer draw started while this one waited
      if (ticket != drawing) return;
      labels = MT.getDMLabels();
      matrix = dm;
      // The nodes' own ids, as categories (numeric ids would make a number line)
      let x = labels.map(String), y = x.slice(), z = dm;
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
      const missing = dm.some(row => row.some(v => v == null));
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

    const table = () => [[''].concat(labels)].concat(matrix.map((row, i) => [labels[i]].concat(row)));
    MT.paneToggle($('.settings-toggle'), pane, false, { beside: $('.heatmap-plot'), resize });
    MT.plotExport(root, plot, settings, {
      csv: filename => MT.saveAs(new Blob([MT.toCSV(table())], { type: 'text/csv;charset=utf-8' }), filename + '.csv'),
      xlsx: filename => {
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
        drawing++;
        Plotly.purge(plot);
      }
    };
  });
