  MT.registerView('scatterplot', (root, { settings, events }) => {

    const $ = selector => root.querySelector(selector);
    const plot = $('.scatterplot-plot');
    const pane = $('.left-pane');
    const variables = [['scatterplot-xVar', $('#scatterplot-xVar')], ['scatterplot-yVar', $('#scatterplot-yVar')]];

    // The variable menus offer the chosen dataset's fields. A variable the
    // dataset doesn't have (or not yet chosen) becomes one of its measurements:
    // the first two, or the one by cluster.
    function showFields() {
      const nodes = settings.get('scatterplot-showNodes');
      const fields = session.data[nodes ? 'nodeFields' : 'linkFields'];
      const measures = MT.numericFields(nodes ? MT.getVisibleNodes() : MT.getVisibleLinks(), fields);
      const fallback = fields.includes('cluster') ? 'cluster' : fields[0];
      const defaults = measures.length > 1 ? measures.slice(0, 2) : [fallback, measures[0] || fields[0]];
      variables.forEach(([key, select], i) => {
        MT.fillSelect(select, fields);
        if (!fields.includes(settings.get(key))) settings.set(key, defaults[i]);
        select.value = settings.get(key);
      });
    }

    // Beyond this many points the plot is drawn on a canvas (WebGL), not as an
    // SVG element per point, which is too slow to draw and to hover over
    const GL_POINTS = 2000;
    let gl = false;

    function draw() {
      const width = MT.viewWidth(root), height = root.clientHeight;
      // A view in a background tab has no size; it draws when it's shown
      if (!width || !height) return;
      const nodes = settings.get('scatterplot-showNodes');
      const xVar = settings.get('scatterplot-xVar'), yVar = settings.get('scatterplot-yVar');
      const items = nodes ? MT.getVisibleNodes() : MT.getVisibleLinks();
      const color = settings.get(nodes ? 'node-color' : 'link-color');
      // Faint gridlines, so the points stand out
      const grid = { gridcolor: MT.gridColor(settings), zerolinecolor: MT.gridColor(settings, 0.4) };
      gl = items.length > GL_POINTS;
      Plotly.react(plot, [{
        x: items.map(d => d[xVar]),
        y: items.map(d => d[yVar]),
        type: gl ? 'scattergl' : 'scatter',
        mode: 'markers',
        // An outline in a darker shade, so light colors stand out from the page
        marker: { color, size: 8, line: { color: d3.color(color).darker(1.5) + '', width: 1 } }
      }], {
        width, height,
        xaxis: { title: { text: MT.titleize(xVar) }, automargin: true, ...grid },
        yaxis: { title: { text: MT.titleize(yVar) }, automargin: true, ...grid, type: settings.get('scatterplot-logScale') ? 'log' : '-' },
        ...MT.plotLayout(root, settings)
      }, {
        displaylogo: false,
        displayModeBar: false
      });
    }

    MT.paneToggle($('.settings-toggle'), pane, false, { beside: $('.scatterplot-plot'), resize: draw });
    // A plot on a canvas has no SVG to export, so Plotly renders the picture
    const imageFormats = ['png', 'jpeg', 'webp', 'svg'];
    MT.plotExport(root, plot, settings, new Proxy({}, {
      get: (_, type) => gl && imageFormats.includes(type) ? filename => {
        const scale = parseFloat(root.querySelector('[name="export-scale"]').value) || 1;
        Plotly.toImage(plot, { format: type, width: plot.clientWidth, height: plot.clientHeight, scale }).then(url => fetch(url))
          .then(response => response.blob())
          .then(blob => MT.saveImage(blob, filename + '.' + type), error => {
            console.error(error);
            MT.toast.error('The image could not be made (' + error.message + '). Try a smaller scale.');
          });
      } : undefined
    }));

    // Older sessions may store the dataset as something other than a boolean
    settings.set('scatterplot-showNodes', !!settings.get('scatterplot-showNodes'));
    showFields();
    const stop = [
      MTBind(pane, settings),
      settings.subscribe('scatterplot-showNodes', showFields),
      settings.subscribe(['scatterplot-showNodes', 'scatterplot-xVar', 'scatterplot-yVar', 'scatterplot-logScale'], draw),
      ...['node-color-change', 'link-color-change', 'background-color-change', 'node-visibility', 'link-visibility']
        .map(type => events.on(type, draw))
    ];
    draw();

    return {
      resize: draw,
      destroy() {
        stop.forEach(fn => fn());
        Plotly.purge(plot);
      }
    };
  });
