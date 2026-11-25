// The Graph view (#366): nodes, links or clusters as a histogram, bars, a line, a
// scatterplot or wind roses, drawn with d3. What it counts is worked out in
// src/charts.js. Library globals (d3, MTBind) stay globals; MT, the session and temp
// come from ctx.
import { readColumn, binColumn, countGroups, labelOf, natural } from '../src/charts.js';

export const settingsPrefix = 'graph-';

// A scatterplot of more points than this is drawn as a picture, not as an SVG element
// per point (#252), and one of many more as plain squares, which are quicker to draw
const SVG_POINTS = 2000, ROUND_POINTS = 20000;
// The most points that can be pointed at
const HOVER_POINTS = 200000;
const ROSES = 24;

const TYPES = ['histogram', 'bar', 'line', 'scatter', 'rose'];
const DATASETS = { nodes: 'Nodes', links: 'Links', clusters: 'Clusters' };

const count = (n, one, many) => n.toLocaleString() + ' ' + (n === 1 ? one : many);
const shorten = (text, most) => text.length > most ? text.slice(0, most - 1) + '…' : text;

export function mount(root, ctx) {
  const { MT, settings, events } = ctx;

  const $ = selector => root.querySelector(selector);
  const plot = $('.graph-plot');
  const pane = $('.left-pane');
  const message = $('.view-message');
  const svg = d3.select(plot).append('svg').attr('class', 'graph-svg').attr('font-family', 'sans-serif');

  // What's drawn --------------------------------------------------------------------

  const type = () => TYPES.includes(settings.get('graph-type')) ? settings.get('graph-type') : 'histogram';
  const dataset = () => Object.hasOwn(DATASETS, settings.get('graph-data')) ? settings.get('graph-data') : 'links';
  const fields = () => ctx.session.data[dataset().slice(0, -1) + 'Fields'];
  // (A lone node isn't a cluster)
  const items = () => dataset() === 'nodes' ? MT.getVisibleNodes() : dataset() === 'links' ? MT.getVisibleLinks() :
    MT.getVisibleClusters().filter(cluster => MT.isCluster(cluster.nodes));
  const isDate = (list, field) => MT.dateFields(list, [field]).length > 0;
  const column = (list, field) => readColumn(list, field, { date: isDate(list, field) });

  // The variable menus offer the dataset's fields. A variable the dataset doesn't
  // have (or not yet chosen) becomes one to start on: the links' distance, the nodes'
  // date or group, the clusters' size, and for Y a measurement other than X.
  function showFields() {
    const all = fields(), list = items();
    MT.fillSelect($('[data-setting="graph-x"]'), all);
    MT.fillSelect($('[data-setting="graph-y"]'), all);
    MT.fillSelect($('[data-setting="graph-stratify"]'), all, { none: true });
    const first = (...found) => found.find(field => all.includes(field));
    const measures = MT.numericFields(list, all);
    let x = settings.get('graph-x'), y = settings.get('graph-y');
    if (!all.includes(x)) {
      const byData = {
        links: () => first(settings.get('link-sort-variable'), measures[0]),
        nodes: () => first(MT.dateFields(list, all)[0], MT.categoricalFields(list, all)[0], measures[0]),
        clusters: () => first('nodes')
      };
      x = byData[dataset()]() || first('cluster') || all[0];
      settings.set('graph-x', x);
    }
    if (!all.includes(y)) {
      y = measures.find(field => field !== x) || ['cluster', 'id'].find(field => field !== x && all.includes(field)) || all[0];
      settings.set('graph-y', y);
    }
    if (settings.get('graph-stratify') !== 'None' && !all.includes(settings.get('graph-stratify'))) settings.set('graph-stratify', 'None');
    $('[data-setting="graph-x"]').value = settings.get('graph-x');
    $('[data-setting="graph-y"]').value = settings.get('graph-y');
    $('[data-setting="graph-stratify"]').value = settings.get('graph-stratify');
  }

  // The controls that apply to the type of graph, and of variable, drawn
  function showControls(hasDates) {
    root.querySelectorAll('[data-graph-types]').forEach(row => {
      row.hidden = !row.dataset.graphTypes.split(' ').includes(type());
    });
    if (!hasDates) $('.graph-bin-row').hidden = true;
  }

  // An item's color group, and a group's color, as the dataset's color table has them
  function coloring(list) {
    const links = dataset() === 'links';
    const plain = settings.get(links ? 'link-color' : 'node-color');
    const by = dataset() === 'clusters' ? 'None' : settings.get(links ? 'link-color-variable' : 'node-color-variable');
    if (by === 'None') return { by: null, groupOf: () => '', colorOf: () => plain };
    const map = links ? ctx.temp.style.linkColorMap : ctx.temp.style.nodeColorMap;
    const keys = list.map(d => links ? MT.linkColorValue(d, by) : d[by]);
    return { by, groupOf: i => String(keys[i]), colorOf: map };
  }

  const counted = n => count(n, dataset().slice(0, -1), dataset());
  // What isn't in the graph, and why
  function showNote(notes) {
    const text = notes.filter(Boolean).join('; ');
    if (!text) return;
    svg.append('text').attr('class', 'graph-note').attr('text-anchor', 'end').attr('font-size', 12).attr('fill', 'currentColor')
      .attr('x', frame.left + frame.width).attr('y', frame.top - 12).text(text);
  }
  const missingNote = (n, kind, field) => n ? `${kind === 'date' ? count(n, 'undated ' + dataset().slice(0, -1), 'undated ' + dataset())
    : `${counted(n)} with no ${MT.titleize(field)}`} not shown` : '';
  const omittedNote = n => n ? `${count(n, 'more value', 'more values')} not shown` : '';

  // The frame and its axes ----------------------------------------------------------

  // The plot area, in the view: below the toolbar, and clear of the docked tables
  let frame = { left: 0, top: 0, width: 0, height: 0 };
  function setFrame(left = 70, bottom = 60) {
    const width = MT.viewWidth(root), height = root.clientHeight, right = 20 + MT.dockRoom(root), top = 60;
    frame = { left, top, width: Math.max(10, width - left - right), height: Math.max(10, height - top - bottom) };
  }

  // A scale along an axis for a column: placed, as times, or a category each.
  // Text longer than its room is shortened, and turned, or only some of it shown.
  const characters = labels => Math.min(22, d3.max(labels, l => l.length) || 0);
  const roomFor = labels => characters(labels) * 7 + 24;
  const bandLabels = (scale, length) => {
    const labels = scale.domain(), every = Math.max(1, Math.ceil(labels.length * 14 / length));
    return labels.filter((l, i) => i % every === 0);
  };
  // Whether a horizontal axis's categories are too wide to be read level
  const turned = (labels, width) => characters(labels) * 7 > width / Math.max(1, labels.length);

  function drawAxis(side, scale, { title, kind, grid, period, whole }) {
    const x = side === 'x', length = x ? frame.width : frame.height;
    const axis = x ? d3.axisBottom(scale) : d3.axisLeft(scale);
    const g = svg.append('g').attr('class', 'axis axis--' + side)
      .attr('transform', `translate(${frame.left},${frame.top + (x ? frame.height : 0)})`);
    const ticks = Math.max(2, Math.floor(length / (x ? 90 : 50)));
    if (kind === 'band') {
      axis.tickValues(bandLabels(scale, length)).tickFormat(l => shorten(l, 22)).tickSizeOuter(0);
    } else if (kind === 'date') {
      // Ticks at the starts of the bars' periods, so each label is a bar's own
      const { interval, format } = period || {};
      const every = interval && !format.includes('%d') ? interval.every(Math.ceil(interval.count(...scale.domain()) / ticks)) : ticks;
      axis.ticks(every || ticks);
      if (format) axis.tickFormat(d3.timeFormat(format));
    } else if (kind === 'log') {
      axis.ticks(ticks, '~g');
      if (whole) axis.tickValues(scale.ticks(ticks).filter(Number.isInteger));
    } else {
      // Whole numbers have ticks at whole numbers only
      axis.ticks(ticks);
      if (whole) axis.tickValues(scale.ticks(ticks).filter(Number.isInteger)).tickFormat(d3.format(','));
    }
    g.call(axis);
    if (kind === 'band' && x && turned(scale.domain(), length)) {
      g.selectAll('.tick text').attr('transform', 'rotate(-45)').attr('text-anchor', 'end').attr('dx', '-0.6em').attr('dy', '0.3em');
    }
    if (kind === 'band') g.selectAll('.tick').filter(l => l.length > 22).append('title').text(l => l);
    if (grid) {
      g.selectAll('.tick').insert('line', ':first-child').attr('class', 'grid').style('stroke', MT.gridColor(settings))
        .attr(x ? 'y2' : 'x2', x ? -frame.height : frame.width);
    }
    svg.append('text').attr('class', side + '-title').attr('fill', 'currentColor').attr('font-size', 14).attr('text-anchor', 'middle')
      .attr('transform', x ? `translate(${frame.left + frame.width / 2},${root.clientHeight - 12})`
        : `translate(16,${frame.top + frame.height / 2}) rotate(-90)`)
      .text(title);
  }

  // A scale of counts, from 0, or if logarithmic from below 1 (so a bar of 1 shows)
  function countScale(most, range) {
    return settings.get('graph-log') ? d3.scaleLog().domain([0.8, Math.max(2, most)]).range(range).clamp(true)
      : d3.scaleLinear().domain([0, most || 1]).range(range).nice();
  }
  const countKind = () => settings.get('graph-log') ? 'log' : 'number';
  const countTitle = cumulative => (cumulative ? 'Cumulative ' : '') + 'Number of ' + DATASETS[dataset()];

  // The graphs ----------------------------------------------------------------------

  // Counts in the bins of a variable: as bars (across, or up), or a line for each color
  function drawCounts(list) {
    const x = settings.get('graph-x'), lines = type() === 'line';
    const horizontal = !lines && settings.get('graph-horizontal') === true;
    const cumulative = type() !== 'bar' && settings.get('graph-cumulative') === true;
    const read = column(list, x);
    const binned = binColumn(read, { categories: type() === 'bar', period: settings.get('graph-bin') });
    const { bins, scale: kind, period } = binned;
    showControls(binned.kind === 'date');
    if (!bins.length) return false;

    const { by, groupOf, colorOf } = coloring(list);
    // (Categories have no order for their counts to run in)
    const running = cumulative && kind !== 'band';
    const { groups, counts, totals } = countGroups(bins, groupOf, { cumulative: running });
    const labels = bins.map(b => b.label);
    const most = lines ? d3.max(counts, row => d3.max(row)) : d3.max(totals);
    const bandRoom = kind === 'band' ? roomFor(labels) : 0;
    if (horizontal) setFrame(Math.max(70, bandRoom + 24));
    else {
      setFrame();
      if (bandRoom && turned(labels, frame.width)) setFrame(70, 40 + bandRoom * 0.75);
    }

    const along = [0, horizontal ? frame.height : frame.width];
    // Bars across run down the view, except along a number line, which runs up it
    const place = kind === 'band' ? d3.scaleBand(labels, along).paddingInner(0.1).paddingOuter(0.05)
      : kind === 'date' ? d3.scaleTime([new Date(bins[0].x0), new Date(bins[bins.length - 1].x1)], along)
        : d3.scaleLinear([bins[0].x0, bins[bins.length - 1].x1], horizontal ? along.slice().reverse() : along);
    const size = countScale(most, horizontal ? [0, frame.width] : [frame.height, 0]);
    const variable = { title: MT.titleize(x), kind, period, whole: read.whole };
    const countAxis = { title: countTitle(running), kind: countKind(), grid: true, whole: true };
    drawAxis('x', horizontal ? size : place, horizontal ? countAxis : variable);
    drawAxis('y', horizontal ? place : size, horizontal ? variable : countAxis);

    const noun = dataset().slice(0, -1), soFar = running ? ' so far' : '';
    const tell = (b, g) => `${labels[b]}${by ? ', ' + labelOf(groups[g]) : ''}: ${count(counts[b][g], noun, dataset())}${soFar}`;
    const g = svg.append('g').attr('class', lines ? 'lines' : 'bars').attr('transform', `translate(${frame.left},${frame.top})`);
    if (lines) {
      const at = b => kind === 'band' ? place(labels[b]) + place.bandwidth() / 2 : place(kind === 'date' ? bins[b].x0 : (bins[b].x0 + bins[b].x1) / 2);
      groups.forEach((group, i) => {
        // (A log scale has no place for 0: the line breaks there)
        const shape = d3.line().x((row, b) => at(b)).y(row => size(row[i])).defined(row => !settings.get('graph-log') || row[i] > 0);
        g.append('path').datum(counts).attr('class', 'line').attr('data-group', group).attr('d', shape)
          .attr('fill', 'none').attr('stroke', colorOf(group)).attr('stroke-width', 2);
        g.append('g').attr('class', 'points').selectAll('circle').data(counts.map((row, b) => b).filter(b => counts[b][i] > 0))
          .join('circle').attr('class', 'point').attr('data-count', b => counts[b][i])
          .attr('cx', at).attr('cy', b => size(counts[b][i])).attr('r', 3.5).attr('fill', colorOf(group))
          .append('title').text(b => tell(b, i));
      });
    } else {
      const bars = [];
      counts.forEach((row, b) => {
        let below = 0;
        row.forEach((n, i) => {
          if (n) bars.push({ b, i, n, from: below, to: below += n });
        });
      });
      const ends = b => kind === 'band' ? [place(labels[b]), place(labels[b]) + place.bandwidth()]
        : [place(bins[b].x0), place(bins[b].x1)].sort((p, q) => p - q);
      // A gap between neighbouring bars, when there's room for one
      const gap = kind !== 'band' && along[1] / bins.length > 4 ? 1 : 0;
      const zero = size(size.domain()[0]);
      const to = n => n ? size(n) : zero;
      g.selectAll('rect').data(bars).join('rect').attr('class', 'bar')
        .attr('data-count', d => d.n).attr('data-bin', d => d.b).attr('data-group', d => groups[d.i])
        .attr(horizontal ? 'y' : 'x', d => ends(d.b)[0])
        .attr(horizontal ? 'height' : 'width', d => Math.max(0.5, ends(d.b)[1] - ends(d.b)[0] - gap))
        .attr(horizontal ? 'x' : 'y', d => horizontal ? to(d.from) : to(d.to))
        .attr(horizontal ? 'width' : 'height', d => Math.max(0, horizontal ? to(d.to) - to(d.from) : to(d.from) - to(d.to)))
        .attr('fill', d => colorOf(groups[d.i]))
        .append('title').text(d => tell(d.b, d.i));
    }
    showNote([missingNote(binned.missing, binned.kind, x), omittedNote(binned.omitted)]);
    return true;
  }

  // Columns wrapped around a center, a rose for each value of the variable it's
  // stratified by, all to the same scale
  function drawRoses(list) {
    const x = settings.get('graph-x'), by = settings.get('graph-stratify');
    const binned = binColumn(column(list, x), { categories: true, period: settings.get('graph-bin') });
    const { bins } = binned;
    showControls(binned.kind === 'date');
    if (!bins.length) return false;
    const { by: colored, groupOf, colorOf } = coloring(list);

    let strata = [{ label: '', bins }], left = 0;
    if (by && by !== 'None') {
      const of = list.map(d => labelOf(d[by])), sizes = d3.rollup(of, v => v.length, v => v);
      const values = Array.from(sizes.keys()).sort((a, b) => sizes.get(b) - sizes.get(a));
      left = Math.max(0, values.length - ROSES);
      strata = values.slice(0, ROSES).sort(natural)
        .map(label => ({ label, bins: bins.map(bin => ({ ...bin, items: bin.items.filter(i => of[i] === label) })) }));
    }
    const tallies = strata.map(s => countGroups(s.bins, groupOf));
    const most = d3.max(tallies, t => d3.max(t.totals)) || 1;

    // As near square as they go
    setFrame(20, 40);
    let columns = 1, side = 0;
    for (let c = 1; c <= strata.length; c++) {
      const s = Math.min(frame.width / c, frame.height / Math.ceil(strata.length / c));
      if (s > side) [side, columns] = [s, c];
    }
    const wide = frame.width / columns, tall = frame.height / Math.ceil(strata.length / columns);
    const heading = by && by !== 'None' ? 20 : 0;
    // Room around each for its labels, where they can be read
    const named = side > 180;
    const radius = Math.max(8, Math.min(wide / 2 - (named ? Math.min(90, characters(bins.map(b => b.label)) * 6.5 + 14) : 6),
      (tall - heading) / 2 - (named ? 22 : 6)));
    const inner = radius * 0.08;
    const angle = d3.scaleBand(d3.range(bins.length), [0, 2 * Math.PI]);
    const r = d3.scaleLinear([0, most], [inner, radius]);
    const rings = r.ticks(Math.min(3, most)).filter(n => n > 0 && Number.isInteger(n));
    const every = Math.max(1, Math.ceil(bins.length / Math.max(4, Math.floor(2 * Math.PI * radius / 60))));

    strata.forEach((stratum, s) => {
      const rose = svg.append('g').attr('class', 'rose').attr('data-stratum', stratum.label)
        .attr('transform', `translate(${frame.left + wide * (s % columns + 0.5)},${frame.top + tall * (Math.floor(s / columns) + 0.5) + heading / 2})`);
      rings.forEach(n => {
        rose.append('circle').attr('class', 'ring').attr('r', r(n)).attr('fill', 'none').style('stroke', MT.gridColor(settings));
      });
      const { groups, counts } = tallies[s], petals = [];
      counts.forEach((row, b) => {
        let below = 0;
        row.forEach((n, i) => { if (n) petals.push({ b, i, n, from: below, to: below += n }); });
      });
      rose.append('g').selectAll('path').data(petals).join('path').attr('class', 'bar')
        .attr('data-count', d => d.n).attr('data-bin', d => d.b).attr('data-group', d => groups[d.i])
        .attr('d', d3.arc().innerRadius(d => r(d.from)).outerRadius(d => r(d.to))
          .startAngle(d => angle(d.b)).endAngle(d => angle(d.b) + angle.bandwidth())
          .padAngle(bins.length > 1 ? Math.min(0.02, angle.bandwidth() / 10) : 0).padRadius(radius))
        .attr('fill', d => colorOf(groups[d.i]))
        .append('title').text(d => `${stratum.label ? stratum.label + ', ' : ''}${bins[d.b].label}${colored ? ', ' + labelOf(groups[d.i]) : ''}: ${count(d.n, dataset().slice(0, -1), dataset())}`);
      // The rings' counts, over the petals
      rings.forEach(n => {
        rose.append('text').attr('class', 'ring-label').attr('y', -r(n)).attr('dy', '0.35em').attr('text-anchor', 'middle')
          .attr('font-size', 10).attr('fill', 'currentColor')
          .attr('stroke', settings.get('background-color')).attr('stroke-width', 3).attr('paint-order', 'stroke').text(n.toLocaleString());
      });
      if (named) {
        rose.selectAll('text.petal-label').data(bins.filter((b, i) => i % every === 0)).join('text').attr('class', 'petal-label')
          .attr('font-size', 11).attr('fill', 'currentColor').attr('dy', '0.35em')
          .each(function (bin) {
            const a = angle(bins.indexOf(bin)) + angle.bandwidth() / 2 - Math.PI / 2, cx = Math.cos(a) * (radius + 8), cy = Math.sin(a) * (radius + 8);
            d3.select(this).attr('x', cx).attr('y', cy).attr('text-anchor', Math.abs(Math.cos(a)) < 0.2 ? 'middle' : Math.cos(a) < 0 ? 'end' : 'start')
              .text(shorten(bin.label, Math.max(4, Math.floor((wide / 2 - Math.abs(cx)) / 6.5))));
          });
      }
      if (heading) {
        rose.append('text').attr('class', 'stratum').attr('text-anchor', 'middle').attr('y', -tall / 2 + 4).attr('font-size', 13)
          .attr('font-weight', 'bold').attr('fill', 'currentColor').text(shorten(stratum.label, Math.floor(wide / 8)));
      }
    });
    svg.append('text').attr('class', 'x-title').attr('fill', 'currentColor').attr('font-size', 14).attr('text-anchor', 'middle')
      .attr('x', frame.left + frame.width / 2).attr('y', root.clientHeight - 10)
      .text(`${countTitle(false)} by ${MT.titleize(x)}${by && by !== 'None' ? ' and ' + MT.titleize(by) : ''}`);
    showNote([missingNote(binned.missing, binned.kind, x), omittedNote(binned.omitted),
      left ? `${count(left, 'smaller group', 'smaller groups')} not shown` : '']);
    return true;
  }

  // A point per item. (`hover` finds the one at the pointer)
  let hover = null;
  function drawScatter(list) {
    showControls(false);
    const xVar = settings.get('graph-x'), yVar = settings.get('graph-y');
    const x = column(list, xVar), y = column(list, yVar);
    const log = settings.get('graph-log') === true && y.kind === 'number';
    const shown = [], lost = { x: 0, y: 0, log: 0 };
    list.forEach((d, i) => {
      if (x.values[i] === null) lost.x++;
      else if (y.values[i] === null) lost.y++;
      else if (log && y.values[i] <= 0) lost.log++;
      else shown.push(i);
    });
    if (!shown.length) return false;

    const domainOf = c => c.kind === 'text' ? Array.from(new Set(shown.map(i => c.values[i]))).sort(natural) : d3.extent(shown, i => c.values[i]);
    const domains = { x: domainOf(x), y: domainOf(y) };
    setFrame(y.kind === 'text' ? Math.max(70, roomFor(domains.y) + 24) : 70);
    if (x.kind === 'text' && turned(domains.x, frame.width)) setFrame(frame.left, 40 + roomFor(domains.x) * 0.75);
    const scaleOf = (c, domain, range) => {
      if (c.kind === 'text') return d3.scalePoint(domain, range).padding(0.5);
      const [low, high] = domain[0] === domain[1] ? [domain[0] - (Math.abs(domain[0]) * 0.05 || 0.5), domain[1] + (Math.abs(domain[1]) * 0.05 || 0.5)] : domain;
      if (c.kind === 'date') return d3.scaleTime([new Date(low), new Date(high)], range);
      if (c === y && log) return d3.scaleLog([low, high], range).nice();
      // A little room, so that points at the edges are whole
      const room = (high - low) * 0.03;
      return d3.scaleLinear([low - room, high + room], range);
    };
    const px = scaleOf(x, domains.x, [0, frame.width]), py = scaleOf(y, domains.y, [frame.height, 0]);
    const kindOf = c => c.kind === 'text' ? 'band' : c === y && log ? 'log' : c.kind;
    drawAxis('x', px, { title: MT.titleize(xVar), kind: kindOf(x), grid: true, whole: x.whole });
    drawAxis('y', py, { title: MT.titleize(yVar), kind: kindOf(y), grid: true, whole: y.whole });

    const { by, groupOf, colorOf } = coloring(list);
    const points = shown.map(i => ({ i, x: px(x.values[i]), y: py(y.values[i]), group: groupOf(i) }));
    const g = svg.append('g').attr('class', 'scatter').attr('data-points', points.length).attr('transform', `translate(${frame.left},${frame.top})`);
    const colors = new Map(Array.from(new Set(points.map(p => p.group)), group => [group, colorOf(group)]));
    // An outline in a darker shade, so light colors stand out from the page
    const darker = color => d3.color(color).darker(1.5) + '';
    if (points.length <= SVG_POINTS) {
      g.selectAll('circle').data(points).join('circle').attr('class', 'point').attr('cx', p => p.x).attr('cy', p => p.y).attr('r', 4)
        .attr('fill', p => colors.get(p.group)).attr('stroke', p => darker(colors.get(p.group)));
    } else {
      g.append('image').attr('x', -10).attr('y', -10).attr('width', frame.width + 20).attr('height', frame.height + 20)
        .attr('href', picture(points, colors, darker));
    }

    let tree = null;
    const value = (c, i) => c.kind === 'date' ? d3.timeFormat('%Y-%m-%d')(new Date(c.values[i])) : c.kind === 'number' ? +c.values[i].toPrecision(6) : c.values[i];
    hover = points.length > HOVER_POINTS ? null : (mx, my) => {
      tree = tree || d3.quadtree(points, p => p.x, p => p.y);
      const p = tree.find(mx, my, 8);
      if (!p) return null;
      const d = list[p.i], name = dataset() === 'links' ? `${d.source} to ${d.target}` : dataset() === 'nodes' ? d._id : 'Cluster ' + d.id;
      return [name, `${MT.titleize(xVar)}: ${value(x, p.i)}`, `${MT.titleize(yVar)}: ${value(y, p.i)}`, by ? `${MT.titleize(by)}: ${labelOf(p.group)}` : '']
        .filter(Boolean).map(line => MT.escape(line)).join('<br>');
    };
    showNote([missingNote(lost.x, x.kind, xVar), missingNote(lost.y, y.kind, yVar), lost.log ? `${counted(lost.log)} at 0 or less not shown` : '']);
    return true;
  }

  // Many points as a picture (a data: URL, which exports with the SVG)
  function picture(points, colors, darker) {
    const ratio = Math.min(2, self.devicePixelRatio || 1);
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil((frame.width + 20) * ratio);
    canvas.height = Math.ceil((frame.height + 20) * ratio);
    const c = canvas.getContext('2d');
    c.scale(ratio, ratio);
    c.translate(10, 10);
    const round = points.length <= ROUND_POINTS;
    d3.group(points, p => p.group).forEach((members, group) => {
      const color = colors.get(group);
      c.fillStyle = color;
      if (!round) return members.forEach(p => c.fillRect(p.x - 1.5, p.y - 1.5, 3, 3));
      // One circle, drawn once and stamped
      const stamp = document.createElement('canvas');
      stamp.width = stamp.height = 10 * ratio;
      const s = stamp.getContext('2d');
      s.scale(ratio, ratio);
      s.fillStyle = color;
      s.strokeStyle = darker(color);
      s.arc(5, 5, 4, 0, 2 * Math.PI);
      s.fill();
      s.stroke();
      members.forEach(p => c.drawImage(stamp, p.x - 5, p.y - 5, 10, 10));
    });
    return canvas.toDataURL();
  }

  function draw() {
    const width = MT.viewWidth(root), height = root.clientHeight;
    // A view in a background tab has no size; it draws when it's shown
    if (!width || !height) return;
    hover = null;
    MT.tooltip(null);
    svg.selectAll('*').remove();
    svg.attr('width', width).attr('height', height).attr('data-type', type());
    plot.style.background = settings.get('background-color');
    svg.style('color', settings.get('background-color-contrast'));
    const list = items();
    const drawType = { scatter: drawScatter, rose: drawRoses }[type()] || drawCounts;
    const drawn = list.length > 0 && drawType(list);
    if (!list.length) showControls(false);
    message.hidden = drawn;
    message.textContent = drawn ? '' : list.length ? `None of the ${dataset()} has a value to draw. Choose another variable in the settings.`
      : `There are no ${dataset()} to draw.`;
    svg.style('display', drawn ? null : 'none');
  }

  svg.on('pointermove', event => {
    if (!hover) return;
    const [x, y] = d3.pointer(event);
    MT.tooltip(hover(x - frame.left, y - frame.top), event);
  }).on('pointerleave', () => MT.tooltip(null));

  MT.paneToggle($('.settings-toggle'), pane, false, { beside: plot, resize: draw });
  MT.svgExport(root, () => svg.node(), settings);

  showFields();
  // (A change of dataset may change the variables too: one redraw for them all)
  let queued = false, closed = false;
  const redraw = () => {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      if (!closed) draw();
    });
  };
  const stop = [
    MTBind(pane, settings),
    settings.subscribe('graph-data', () => {
      showFields();
      // (It may change which color table it docks)
      MT.placePanels();
    }),
    settings.subscribe(['graph-type', 'graph-data', 'graph-x', 'graph-y', 'graph-horizontal', 'graph-log', 'graph-bin', 'graph-cumulative', 'graph-stratify'], redraw),
    ...['node-color-change', 'link-color-change', 'background-color-change', 'node-visibility', 'link-visibility', 'cluster-visibility']
      .map(name => events.on(name, redraw)),
    // Clear of the color table docked at the right
    MT.onDockChange(root, redraw)
  ];
  draw();

  return {
    // The page's floating panels this view shows (see MT.placePanels)
    panels: () => dataset() === 'nodes' ? ['node-colors'] : dataset() === 'links' ? ['link-colors'] : [],
    resize: draw,
    destroy() {
      closed = true;
      stop.forEach(fn => fn());
      MT.tooltip(null);
    }
  };
}
