// The heatmap view, loaded as an ES module by src/views.js (#339). Library globals (d3, XLSX, MTBind)
// stay globals; MT comes from ctx.

// The settings each open copy of this view keeps to itself (#365)
export const settingsPrefix = 'heatmap-';

const MISSING = '#d0d0d0';
// The matrix is drawn as a picture of a pixel a cell, which is quick to make up to
// about this many nodes
const MAX_NODES = 3000;
const ids = list => list.map(String);

export function mount(root, ctx) {
  const { MT, settings, events } = ctx;

  const $ = selector => root.querySelector(selector);
  const plot = $('.heatmap-plot');
  const pane = $('.left-pane');
  const svg = d3.select(plot).append('svg').attr('class', 'heatmap-svg').attr('font-family', 'sans-serif').style('display', 'none');
  const note = document.createElement('p');
  note.className = 'heatmap-note';
  note.hidden = true;
  plot.append(note);

  // The distance matrix and its labels as last drawn, for export; the least and
  // greatest distances in it; and its picture
  let labels = [], matrix = new Float64Array(0), extent = [0, 1], missing = false, picture = '';
  // Where its cells are in the view
  let area = null;
  // The matrix is computed in a worker, shown in the view as it is (#293)
  const computing = MT.viewComputing(root, 'the distance matrix');

  const hasSize = () => MT.viewWidth(root) > 0 && root.clientHeight > 0;

  function draw() {
    // A view in a background tab has no size; it draws when it's shown
    if (!hasSize()) return;
    // Too many nodes: say so where the heatmap would be
    const tooLarge = MT.dmTooLargeMessage(MAX_NODES);
    if (tooLarge) {
      computing.stop();
      labels = [];
      matrix = new Float64Array(0);
      svg.style('display', 'none');
      note.textContent = tooLarge;
      note.hidden = false;
      return;
    }
    // (A draw that starts while another waits replaces it: see MT.viewComputing)
    const rowLabels = MT.getDMLabels();
    computing.run((scope, onProgress) => MT.getDM(MAX_NODES, { scope, onProgress }), dm => {
      labels = rowLabels;
      matrix = dm;
      note.hidden = true;
      // Pairs without a distance show the grey behind the cells, said in a note.
      // (Saturated distances are Infinity, and take the highest color.)
      let low = Infinity, high = -Infinity;
      missing = false;
      for (let i = 0; i < dm.length; i++) {
        const v = dm[i];
        if (v !== v) missing = true;
        else if (v !== Infinity && v !== -Infinity) {
          if (v < low) low = v;
          if (v > high) high = v;
        }
      }
      extent = low <= high ? [low, high] : [0, 1];
      paint();
      place();
    });
  }

  // The color at each of 256 steps from the smallest distance to the largest
  function palette() {
    const scale = d3.scaleLinear([0, 127.5, 255], ['low', 'medium', 'high'].map(level => settings.get('heatmap-color-' + level)));
    return d3.range(256).map(i => (d3.color(scale(i)) || d3.color(MISSING)).rgb());
  }

  // Makes the matrix's picture, from its first row down, with its missing cells clear
  function paint() {
    const n = labels.length, canvas = document.createElement('canvas');
    if (!n) return;
    canvas.width = canvas.height = n;
    const context = canvas.getContext('2d'), image = context.createImageData(n, n), pixels = new Uint32Array(image.data.buffer);
    // (The bytes of a pixel are red, green, blue and alpha in order, on every
    // machine browsers run on)
    const colors = Uint32Array.from(palette(), c => (255 << 24 | Math.round(c.b) << 16 | Math.round(c.g) << 8 | Math.round(c.r)) >>> 0);
    const [low, high] = extent, per = high > low ? 255 / (high - low) : 0;
    for (let i = 0; i < matrix.length; i++) {
      const v = matrix[i];
      if (v === v) pixels[i] = colors[v >= high && per ? 255 : v <= low ? 0 : Math.round((v - low) * per)];
    }
    context.putImageData(image, 0, 0);
    picture = canvas.toDataURL();
  }

  // Draws the axes and the color scale for the view's size, around the picture
  function place() {
    const n = labels.length;
    if (!hasSize() || !n) return;
    const width = MT.viewWidth(root), height = root.clientHeight;
    const showLabels = settings.get('heatmap-axislabels-show') === true;
    const names = ids(labels);
    const room = showLabels ? Math.min(150, 7 * d3.max(names, name => name.length) + 20) : 20;
    const metric = MT.titleize(settings.get('link-sort-variable'));
    area = {
      left: room, top: 55,
      width: Math.max(10, width - room - 110 - MT.dockRoom(root)),
      height: Math.max(10, height - 55 - (showLabels ? room * 0.75 + 10 : 20)),
      invertX: settings.get('heatmap-invertX') === true, invertY: settings.get('heatmap-invertY') === true
    };
    const { left, top } = area;
    svg.selectAll('*').remove();
    svg.attr('width', width).attr('height', height).style('display', null).style('color', settings.get('background-color-contrast'));
    plot.style.background = settings.get('background-color');

    svg.append('rect').attr('x', left).attr('y', top).attr('width', area.width).attr('height', area.height).attr('fill', MISSING);
    // The first row is at the bottom, unless inverted
    svg.append('image').attr('class', 'cells').attr('width', 1).attr('height', 1).attr('preserveAspectRatio', 'none')
      .attr('transform', `translate(${left + (area.invertX ? area.width : 0)},${top + (area.invertY ? 0 : area.height)}) ` +
        `scale(${area.width * (area.invertX ? -1 : 1)},${area.height * (area.invertY ? 1 : -1)})`)
      // Cells larger than a pixel keep their edges
      .style('image-rendering', Math.min(area.width, area.height) >= n ? 'pixelated' : null)
      .attr('href', picture);

    if (showLabels) {
      const axis = (scale, side, length) => {
        const domain = scale.domain(), every = Math.max(1, Math.ceil(domain.length * 13 / length));
        return side(scale).tickValues(domain.filter((name, i) => i % every === 0)).tickSizeOuter(0)
          .tickFormat(name => name.length > 20 ? name.slice(0, 19) + '…' : name);
      };
      svg.append('g').attr('class', 'axis axis--x').attr('transform', `translate(${left},${top + area.height})`)
        .call(axis(d3.scaleBand(names, area.invertX ? [area.width, 0] : [0, area.width]), d3.axisBottom, area.width))
        .selectAll('.tick text').attr('transform', 'rotate(-45)').attr('text-anchor', 'end').attr('dx', '-0.6em').attr('dy', '0.3em');
      svg.append('g').attr('class', 'axis axis--y').attr('transform', `translate(${left},${top})`)
        .call(axis(d3.scaleBand(names, area.invertY ? [0, area.height] : [area.height, 0]), d3.axisLeft, area.height));
    }

    // The color scale
    const bar = svg.append('g').attr('class', 'color-scale').attr('transform', `translate(${left + area.width + 25},${top + 20})`);
    const barHeight = Math.max(10, area.height - 20);
    bar.selectAll('rect').data(palette()).join('rect').attr('width', 18).attr('height', barHeight / 256 + 0.5)
      .attr('y', (c, i) => barHeight * (255 - i) / 256).attr('fill', c => c + '');
    bar.append('g').attr('transform', 'translate(18,0)')
      .call(d3.axisRight(d3.scaleLinear(extent[0] < extent[1] ? extent : [extent[0], extent[0] + 1], [barHeight, 0])).ticks(Math.max(2, Math.floor(barHeight / 50))));
    bar.append('text').attr('y', -8).attr('font-size', 12).attr('fill', 'currentColor').text(metric);

    if (missing) {
      const key = svg.append('text').attr('class', 'missing-note').attr('x', left + area.width).attr('y', top - 8).attr('text-anchor', 'end')
        .attr('font-size', 12).attr('fill', 'currentColor');
      key.append('tspan').attr('fill', MISSING).text('■');
      key.append('tspan').text(' No ' + (MT.fieldMetric(settings.get('link-sort-variable')) ? metric : metric.toLowerCase()));
    }
  }

  svg.on('pointermove', event => {
    const n = labels.length;
    if (!n || !area) return;
    const [px, py] = d3.pointer(event);
    const fx = (px - area.left) / area.width, fy = 1 - (py - area.top) / area.height;
    if (!(fx >= 0 && fx < 1 && fy >= 0 && fy < 1)) return MT.tooltip(null);
    const column = Math.floor((area.invertX ? 1 - fx : fx) * n), row = Math.floor((area.invertY ? 1 - fy : fy) * n);
    const value = matrix[row * n + column];
    MT.tooltip(value === value ? MT.escape(`${labels[row]} and ${labels[column]}: ${value}`) : null, event);
  }).on('pointerleave', () => MT.tooltip(null));

  // A new size needs no new matrix
  const resize = () => picture && labels.length ? place() : draw();

  const table = () => {
    const n = labels.length;
    return [[''].concat(labels)].concat(labels.map((label, i) =>
      [label].concat(Array.from(matrix.subarray(i * n, (i + 1) * n), v => v === v ? v : null))));
  };
  MT.paneToggle($('.settings-toggle'), pane, false, { beside: plot, resize });
  MT.svgExport(root, () => svg.node(), settings, {
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
    settings.subscribe(['heatmap-invertX', 'heatmap-invertY', 'heatmap-axislabels-show'], place),
    settings.subscribe(['heatmap-color-high', 'heatmap-color-medium', 'heatmap-color-low'], () => {
      paint();
      place();
    }),
    events.on('background-color-change', place)
  ];
  draw();

  return {
    resize,
    destroy() {
      stop.forEach(fn => fn());
      computing.destroy();
      MT.tooltip(null);
    }
  };
}
