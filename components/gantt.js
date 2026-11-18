  MT.registerView('gantt', (root, { settings, events }) => {

    const $ = selector => root.querySelector(selector);
    const pane = $('.left-pane');
    const list = $('.gantt-dates');
    const tickFormat = d3.timeFormat('%Y-%m-%d');
    const margin = { top: 40, right: 20, bottom: 30, left: 80 };
    const svg = d3.select($('.gantt')).append('svg');
    const chart = svg.append('g').attr('class', 'gantt-chart');
    const xAxis = svg.append('g').attr('class', 'x-axis');
    const yAxis = svg.append('g').attr('class', 'y-axis');
    const hover = svg.append('g').attr('class', 'mouse-over-effects').style('opacity', 0);
    const hoverLine = hover.append('path').attr('class', 'mouse-line').style('stroke', 'black').style('stroke-width', '1px');
    const hoverDate = hover.append('text').attr('y', margin.top - 5).attr('text-anchor', 'middle');
    // (The box only measures the pointer; the svg listens, so rows under it
    // still say their dates on hover)
    const hoverBox = svg.append('rect').attr('fill', 'none').attr('pointer-events', 'none');
    hover.attr('pointer-events', 'none');
    // The axis stays at the bottom of the view while the rows scroll behind it
    const scroller = $('.gantt');
    // (over the rows and their labels, down to the view's bottom edge)
    const axisBackground = xAxis.append('rect').attr('class', 'axis-background').attr('y', 0).attr('height', margin.bottom + 10);
    [xAxis, hover, hoverBox].forEach(g => g.raise());
    let placeAxis = () => {};
    scroller.addEventListener('scroll', () => placeAxis());
    // Rows are never shorter than their labels
    const minRow = 14;

    // The dates drawn: each a start field, an end field (or None), a color and
    // a transparency
    const dates = () => settings.get('gantt-dates') || [];
    const setDates = value => settings.set('gantt-dates', value);
    const update = (i, change) => setDates(dates().map((d, j) => j == i ? { ...d, ...change } : d));

    // A node's date: spreadsheet day numbers, or anything MT.parseDate reads in
    // the order its field's dates are written in
    const dateOf = (value, order) => MT.parseDate(typeof value == 'number' ? (value - 25567) * 24 * 60 * 60 * 1000 : value, order);
    const orderOf = field => MTDates.dateOrderOf(session.data.nodes.map(d => d[field])).order;

    function bars() {
      const nodes = session.data.nodes.filter(d => d.visible);
      const out = [];
      dates().forEach((date, i) => {
        if (!date.start || date.start == 'None') return;
        const endField = date.end && date.end != 'None' ? date.end : date.start;
        const startOrder = orderOf(date.start), endOrder = orderOf(endField);
        nodes.forEach(d => {
          const start = dateOf(d[date.start], startOrder), end = dateOf(d[endField], endOrder);
          if (!start && !end) return;
          out.push({ start: start || end, end: end || start, row: '' + d._id, date: i, id: `${d._id}-${i}` });
        });
      });
      return out;
    }

    function draw() {
      const all = bars();
      // Without dates, a note saying what to choose instead of an empty chart
      $('.view-message').hidden = all.length > 0;
      svg.style('display', all.length ? null : 'none');
      // Room for the longest label
      const context = document.createElement('canvas').getContext('2d');
      context.font = '10px ' + getComputedStyle(document.body).fontFamily;
      margin.left = Math.max(30, ...all.map(b => Math.ceil(context.measureText(b.row).width))) + 15;
      const visibleHeight = root.clientHeight - margin.top - margin.bottom - 5;
      // A view in a background tab has no size; it draws when it's shown
      if (root.clientWidth <= 0 || visibleHeight <= 0) return;

      // Rows in order of their first date, each tall enough for its label;
      // more than fit scroll
      const first = d3.rollup(all, bs => d3.min(bs, b => b.start), b => b.row);
      const rows = Array.from(first.keys()).sort((a, b) => first.get(a) - first.get(b) || a.localeCompare(b, undefined, { numeric: true }));
      const height = Math.max(visibleHeight, rows.length * minRow);
      svg.attr('height', height + margin.top + margin.bottom);
      // (Measured once the height says whether there's a scrollbar)
      const width = scroller.clientWidth - margin.left - margin.right - 5;
      if (width <= 0) return;
      svg.attr('width', width + margin.left + margin.right);
      [chart, yAxis, hoverBox].forEach(g => g.attr('transform', `translate(${margin.left},${margin.top})`));

      const y = d3.scaleBand().domain(rows).range([0, height]).padding(0.1);
      // (Inset by half a row, so dots at either end show whole)
      const inset = y.bandwidth() / 2;
      const x = d3.scaleTime().range([inset, width - inset]).clamp(true)
        .domain(all.length ? [d3.min(all, b => b.start), d3.max(all, b => b.end)] : [new Date(2000, 0, 1), new Date()]);

      xAxis.call(d3.axisBottom(x).tickFormat(tickFormat).tickSize(8).tickPadding(8));
      axisBackground.attr('x', -margin.left).attr('width', width + margin.left + margin.right).lower();
      // At the bottom of what's in view (or, given true, of the whole chart)
      placeAxis = whole => {
        const bottom = whole ? height : Math.min(height, scroller.scrollTop + visibleHeight);
        xAxis.attr('transform', `translate(${margin.left},${margin.top + bottom})`);
        hoverDate.attr('y', (whole ? 0 : scroller.scrollTop) + margin.top - 5);
      };
      placeAxis();
      yAxis.call(d3.axisLeft(y).tickSize(0));

      const list = dates();
      // A single day is a dot, a span a bar
      const band = y.bandwidth();
      const dot = b => x(b.end) - x(b.start) < band;
      chart.selectAll('rect')
        .data(all, b => b.id)
        .join(enter => enter.append('rect').call(rect => rect.append('title')))
        .attr('class', b => 'date-' + b.date + (dot(b) ? ' dot' : ''))
        .attr('rx', b => dot(b) ? band / 2 : Math.min(5, band / 2))
        .attr('ry', b => dot(b) ? band / 2 : Math.min(5, band / 2))
        .attr('x', b => dot(b) ? (x(b.start) + x(b.end) - band) / 2 : x(b.start))
        .attr('y', b => y(b.row))
        .attr('height', band)
        .attr('width', b => dot(b) ? band : x(b.end) - x(b.start))
        .attr('fill', b => list[b.date].color)
        .attr('fill-opacity', b => 1 - list[b.date].transparency)
        .select('title')
        .text(b => b.row + ': ' + tickFormat(b.start) + (+b.end != +b.start ? ' to ' + tickFormat(b.end) : ''));

      hoverBox.attr('width', width).attr('height', height);
      svg
        .on('mouseleave', () => hover.style('opacity', 0))
        .on('mousemove', event => {
          const [px, py] = d3.pointer(event, hoverBox.node());
          const inside = px >= 0 && px <= width && py >= 0 && py <= height;
          hover.style('opacity', inside ? 1 : 0);
          if (!inside) return;
          const sx = px + margin.left;
          const top = scroller.scrollTop + margin.top;
          hoverLine.attr('d', `M${sx},${Math.min(height, scroller.scrollTop + visibleHeight) + margin.top} ${sx},${top}`);
          hoverDate.attr('x', Math.min(Math.max(sx, 60), width + margin.left - 40)).text(tickFormat(x.invert(px)));
        });
      setBackground();
    }

    // The settings for each date
    function showDates() {
      list.innerHTML = '';
      dates().forEach((date, i) => {
        const row = document.createElement('div');
        row.className = 'form-group gantt-date';
        row.innerHTML = `
          <div class="d-flex justify-content-between align-items-center mb-1">
            <strong>Date ${i + 1}</strong>
            <a href="#" class="icon-action" title="Remove this date"><span class="bi bi-x-circle"></span> Remove</a>
          </div>
          <div class="row">
            <div class="col-4">Start</div>
            <div class="col-8"><select class="form-select form-select-sm" name="start" aria-label="Start"></select></div>
          </div>
          <div class="row">
            <div class="col-4">End</div>
            <div class="col-8"><select class="form-select form-select-sm" name="end" aria-label="End"></select></div>
          </div>
          <div class="row">
            <div class="col-4">Color</div>
            <div class="col-8"><input class="form-control form-control-sm" type="color" name="color" aria-label="Color"></div>
          </div>
          <div class="row">
            <div class="col-4">Transparency</div>
            <div class="col-8"><input type="range" class="form-range" name="transparency" aria-label="Transparency" min="0" max="1" step="0.01"></div>
          </div>`;
        const field = name => row.querySelector(`[name="${name}"]`);
        ['start', 'end'].forEach(name => MT.fillSelect(field(name), session.data.nodeFields, { none: true }));
        field('start').value = date.start;
        field('end').value = date.end;
        field('color').value = date.color;
        field('transparency').value = date.transparency;
        field('start').addEventListener('change', e => update(i, { start: e.target.value }));
        field('end').addEventListener('change', e => update(i, { end: e.target.value }));
        field('color').addEventListener('input', e => update(i, { color: e.target.value }));
        field('transparency').addEventListener('input', e => update(i, { transparency: parseFloat(e.target.value) }));
        row.querySelector('a').addEventListener('click', e => {
          e.preventDefault();
          setDates(dates().filter((d, j) => j != i));
          showDates();
        });
        list.append(row);
      });
    }

    $('.add-date').addEventListener('click', () => {
      // The colour-blind-safe default palette (#294), in shades beyond its own colours
      const colors = MT.extendPalette(MT.COLOR_BLIND_SAFE, dates().length + 1);
      setDates(dates().concat([{ start: 'None', end: 'None', color: colors[dates().length], transparency: 0.4 }]));
      showDates();
    });

    function setBackground() {
      $('.gantt').style.background = settings.get('background-color');
      const contrast = settings.get('background-color-contrast');
      xAxis.style('color', contrast);
      axisBackground.attr('fill', settings.get('background-color'));
      yAxis.style('color', contrast);
      hoverDate.attr('fill', contrast);
      hoverLine.style('stroke', contrast);
    }

    // With no dates chosen, it starts on the data's first field of dates
    if (!dates().length) {
      const [field] = MT.dateFields(session.data.nodes, session.data.nodeFields);
      if (field) setDates([{ start: field, end: 'None', color: MT.COLOR_BLIND_SAFE[0], transparency: 0.4 }]);
    }

    // The settings start open when there's nothing to draw
    MT.paneToggle($('.settings-toggle'), pane, !dates().length, { beside: scroller, resize: draw });
    // (Exported whole, with the axis under the last row; it returns to the view's
    // bottom once the copy is made)
    MT.svgExport(root, () => {
      placeAxis(true);
      setTimeout(() => placeAxis());
      return svg.node();
    }, settings);

    const stop = [
      settings.subscribe('gantt-dates', draw),
      events.on('background-color-change', setBackground),
      ...['node-visibility', 'cluster-visibility'].map(type => events.on(type, draw))
    ];
    showDates();
    draw();

    return {
      resize: draw,
      destroy: () => stop.forEach(fn => fn())
    };
  });
