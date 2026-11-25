// The histogram view, loaded as an ES module by src/views.js (#339). Library globals (Plotly)
// stay globals; MT, the session and temp come from ctx.
export const libraries = ['plotly'];

// The settings each open copy of this view keeps to itself (#365)
export const settingsPrefix = 'histogram-';

export function mount(root, ctx) {
  const { MT, settings, events } = ctx;

  const $ = selector => root.querySelector(selector);
  const plot = $('.histogram-plot');
  const pane = $('.left-pane');

  // One histogram trace per color when the bars are colored by a variable,
  // as the color table for the dataset gives them (links by their first origin)
  function traces(source, field, axis) {
    const items = source === 'nodes' ? MT.getVisibleNodes() : MT.getVisibleLinks();
    const trace = (values, color) => ({ type: 'histogram', [axis]: values, marker: { color }, showlegend: false, hoverinfo: 'skip' });
    const colorBy = settings.get(source === 'nodes' ? 'node-color-variable' : 'link-color-variable');
    if (colorBy === 'None') {
      return [trace(items.map(d => d[field]), settings.get(source === 'nodes' ? 'node-color' : 'link-color'))];
    }
    const valueOf = source === 'nodes' ? d => d[colorBy] : d => MT.linkColorValue(d, colorBy);
    const colorMap = source === 'nodes' ? ctx.temp.style.nodeColorMap : ctx.temp.style.linkColorMap;
    const groups = new Map();
    items.forEach(d => {
      const key = String(valueOf(d));
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(d[field]);
    });
    return Array.from(groups, ([value, values]) => trace(values, colorMap(value)))
      // Smaller groups first, so they stack at the bottom (#242)
      .sort((a, b) => a[axis].length - b[axis].length);
  }

  // The color table for the dataset charted, the only one its bars follow
  const dataset = () => settings.get('histogram-variable').split('-')[0];

  function draw() {
    const width = MT.viewWidth(root), height = root.clientHeight;
    // A view in a background tab has no size; it draws when it's shown
    if (!width || !height) return;
    const [source, ...rest] = settings.get('histogram-variable').split('-');
    const field = rest.join('-');
    const axis = settings.get('histogram-axis-x') ? 'x' : 'y', countAxis = axis === 'x' ? 'y' : 'x';
    const data = traces(source, field, axis);
    Plotly.react(plot, data, {
      width, height,
      barmode: data.length > 1 ? 'stack' : undefined,
      ...MT.plotLayout(root, settings),
      [axis + 'axis']: { title: { text: MT.titleize(field) }, automargin: true },
      [countAxis + 'axis']: {
        title: { text: 'Number of ' + MT.titleize(source) },
        automargin: true,
        type: settings.get('histogram-scale-log') ? 'log' : '-'
      }
    }, {
      displaylogo: false,
      displayModeBar: false,
      scrollZoom: true
    });
  }

  // A link field the links don't have charts the one they're filtered on
  const [source, ...rest] = settings.get('histogram-variable').split('-');
  if (source === 'links' && !ctx.session.data.linkFields.includes(rest.join('-'))) {
    settings.set('histogram-variable', 'links-' + settings.get('link-sort-variable'));
  }

  MT.paneToggle($('.settings-toggle'), pane, false, { beside: $('.histogram-plot'), resize: draw });
  MT.plotExport(root, plot, settings);

  const stop = [
    MTBind(pane, settings),
    // (A change of variable may change which color table it docks)
    settings.subscribe(['histogram-variable', 'histogram-axis-x', 'histogram-scale-log'], () => {
      MT.placePanels();
      draw();
    }),
    ...['node-color-change', 'link-color-change', 'background-color-change', 'node-visibility', 'link-visibility']
      .map(type => events.on(type, draw)),
    // Clear of the color table docked at the right
    MT.onDockChange(root, draw)
  ];
  draw();

  return {
    // The page's floating panels this view shows (see MT.placePanels)
    panels: () => [dataset() === 'nodes' ? 'node-colors' : 'link-colors'],
    resize: draw,
    destroy() {
      stop.forEach(fn => fn());
      Plotly.purge(plot);
    }
  };
}
