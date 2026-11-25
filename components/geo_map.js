// The map view, loaded as an ES module by src/views.js (#339). MT, the session and temp come
// from ctx; d3 and MTBind are globals.
//
// It draws with d3 on a canvas: the world flat (Mercator), the United States with Alaska and
// Hawaii inset, or a globe that turns, shaded to look round. Over the land go the regions
// shaded by how many nodes they hold (a choropleth), the outlines, the user's GeoJSON, then
// the links and nodes. It replaced three views drawn with Leaflet and d3: the map, the
// choropleth and the globe. Everything it draws comes with MicrobeTrace, so it works offline
// and asks nothing of any other server.
import { SHADE_FIELDS, rewind } from '../src/geo.js';

const OCEAN = '#c6d7e1', LAND = '#f4f2ec', BORDER = '#8f989e', OUTLINE = '#b3bbc1';
// A node's radius, and how near (in pixels) the pointer must be to a node or a link to point at it
const RADIUS = 5, NEAR = 8, NEAR_LINK = 4;
const MARGIN = 20;

export function mount(root, ctx) {
  const { MT, settings, events } = ctx;

  const $ = selector => root.querySelector(selector);
  const pane = $('.left-pane'), canvas = $('.map-canvas'), legend = $('.map-legend');
  // Drawn by the CPU (which willReadFrequently asks for): drawing the outlines'
  // big paths on the GPU stalled the page's frames for seconds on an NVIDIA
  // machine, and on the CPU a frame with every county takes about 20 ms
  const context = canvas.getContext('2d', { willReadFrequently: true });
  let width = 0, height = 0, destroyed = false;

  const field = kind => {
    const value = settings.get('map-field-' + kind);
    return value && value !== 'None' ? value : null;
  };
  const fieldKeys = [...MT.locationKinds, 'lat', 'lon'].map(kind => 'map-field-' + kind);
  const globe = () => settings.get('map-projection') === 'globe';

  // The outlines, by name (countries, states, counties), once loaded. The
  // countries are the land, so they always load.
  const maps = {};
  const needed = () => ['countries',
    (settings.get('map-states-show') || settings.get('map-shade') === 'states') && 'states',
    (settings.get('map-counties-show') || settings.get('map-shade') === 'counties') && 'counties'].filter(Boolean);
  function loadMaps() {
    needed().filter(name => !maps[name]).forEach(name => MT.getMapData(name + '.json').then(data => {
      if (destroyed) return;
      maps[name] = data;
      if (name === 'countries' && fitPending) fit();
      schedule();
    }, error => MT.toast.error("The map's " + name + " couldn't be loaded. " + error.message)));
  }

  // Where each node goes ([lat, lon], by _id), moved by the jitter setting
  let positions = new Map(), placeRequest = 0, fitted = false, framed = false, fitPending = false;
  const jitter = MT.jitterer(() => settings.get('map-node-jitter'));
  const at = id => jitter.at(id, positions.get(id));
  const lonLat = id => { const [lat, lon] = at(id); return [lon, lat]; };
  async function place() {
    const ticket = ++placeRequest;
    const located = await MT.locateNodes(MT.getVisibleNodes(), field);
    // A newer request, or a closed view, makes this one moot
    if (ticket !== placeRequest || destroyed) return;
    positions = located;
    if (!fitted && positions.size) {
      fitted = true;
      fit();
    }
    schedule();
  }

  // The shaded regions: each region of the kind chosen, with its count of
  // visible nodes, and the legend's title and range
  let regions = null, shadeRequest = 0, fitShading = false;
  async function shade() {
    const ticket = ++shadeRequest, kind = settings.get('map-shade');
    if (!SHADE_FIELDS[kind]) {
      regions = null;
      showLegend();
      return schedule();
    }
    const [find, data] = await Promise.all([MT.placeFinders(field), MT.getMapData(kind + '.json')]);
    if (ticket !== shadeRequest || destroyed) return;
    const by = find[SHADE_FIELDS[kind]], counts = new Map();
    if (by) MT.getVisibleNodes().forEach(d => {
      const region = by(d);
      if (region) counts.set(region, (counts.get(region) || 0) + 1);
    });
    const list = data.features.map(feature => ({ feature, count: counts.get(feature) || 0 }));
    const values = list.map(r => r.count);
    const name = field(SHADE_FIELDS[kind]);
    regions = { kind, list, min: Math.min(...values), max: Math.max(...values),
      title: name ? 'Nodes by ' + MT.titleize(name) : 'Choose the ' + MT.titleize(SHADE_FIELDS[kind]) + ' field (Data)' };
    showLegend();
    if (fitShading) {
      fitShading = false;
      fit();
    }
    schedule();
  }
  const ramp = () => d3.scaleLinear().domain([0, 0.5, 1]).range(['low', 'medium', 'high'].map(level => settings.get('map-shade-color-' + level)));
  const regionColor = (color, count) => regions.max > regions.min ? color((count - regions.min) / (regions.max - regions.min)) : color(0);

  // The legend of the shading: what's counted over the color ramp, with the
  // lowest and highest counts below it
  function showLegend() {
    legend.hidden = !regions;
    if (!regions) return;
    const color = ramp();
    legend.querySelector('.legend-title').textContent = regions.title;
    legend.querySelector('.legend-ramp').style.background = `linear-gradient(to right, ${[0, 0.5, 1].map(t => d3.rgb(color(t)).formatHex()).join(', ')})`;
    const [low, high] = legend.querySelectorAll('.legend-ends span');
    low.textContent = regions.min;
    high.textContent = regions.max;
  }
  // The legend, as drawn into an exported image, at the bottom left
  function paintLegend(c, h) {
    if (!regions) return;
    const color = ramp(), x = 10, w = 200, top = h - 64;
    c.fillStyle = 'rgba(255, 255, 255, 0.9)';
    c.fillRect(x, top, w + 16, 56);
    c.fillStyle = '#212529';
    c.font = 'bold 13px sans-serif';
    c.textAlign = 'left';
    c.fillText(regions.title, x + 8, top + 17);
    const gradient = c.createLinearGradient(x + 8, 0, x + 8 + w, 0);
    [0, 0.5, 1].forEach(t => gradient.addColorStop(t, d3.rgb(color(t)).formatHex()));
    c.fillStyle = gradient;
    c.fillRect(x + 8, top + 24, w, 12);
    c.fillStyle = '#212529';
    c.font = '12px sans-serif';
    c.fillText(regions.min + '', x + 8, top + 50);
    c.textAlign = 'right';
    c.fillText(regions.max + '', x + 8 + w, top + 50);
  }

  // The projection. A flat one is fitted to the data (base), and zooming and
  // panning scale and move that fit (transform); the globe is fitted to the
  // view (baseScale), zooming scales it and dragging turns it.
  const sphere = { type: 'Sphere' }, graticule = d3.geoGraticule10();
  let projection, base = { scale: 1, translate: [0, 0] }, baseScale = 1, transform = d3.zoomIdentity;
  function makeProjection() {
    const kind = settings.get('map-projection');
    projection = kind === 'globe' ? d3.geoOrthographic().clipAngle(90).precision(0.3)
      : kind === 'albers-usa' ? d3.geoAlbersUsa() : d3.geoMercator();
    // A flat map draws straight lines between the outlines' points, which are
    // close enough together; only the globe needs d3 to add points along its curves
    if (kind !== 'globe') projection.precision(0);
    $('.autorotate-toggle').hidden = kind !== 'globe';
    if (kind !== 'globe') stopSpinning();
  }
  function applyTransform() {
    if (globe()) projection.scale(baseScale * transform.k);
    else projection.scale(base.scale * transform.k).translate([base.translate[0] * transform.k + transform.x, base.translate[1] * transform.k + transform.y]);
  }

  // Dragging pans the flat map and turns the globe; the wheel, a double click
  // and the zoom buttons zoom
  const zoom = d3.zoom().on('zoom', e => {
    const t = e.transform, source = e.sourceEvent;
    if (globe() && source && source.type !== 'wheel' && source.type !== 'dblclick') {
      // Turning the globe as far as the pointer moves over its surface
      const r = projection.rotate(), degrees = 180 / Math.PI / projection.scale();
      projection.rotate([r[0] + (t.x - transform.x) * degrees, Math.max(-90, Math.min(90, r[1] - (t.y - transform.y) * degrees)), r[2]]);
    }
    transform = t;
    applyTransform();
    MT.tooltip(null);
    schedule();
  });
  const selection = d3.select(canvas).call(zoom);
  // (A transform set from code, as fitting does, without turning the globe)
  const setTransform = t => selection.call(zoom.transform, t);

  // Fits the nodes and the shaded regions holding nodes (or, with neither, the
  // whole map), clear of the toolbar and of the tables docked at the right
  function fit() {
    if (!width || !height || !maps.countries) return void (fitPending = true);
    fitPending = false;
    framed = true;
    const points = Array.from(positions.keys(), lonLat);
    const counted = regions ? regions.list.filter(r => r.count).map(r => r.feature) : [];
    const room = MT.dockRoom(root);
    if (globe()) {
      // Turns the globe to face them, and zooms until they fill most of the
      // view (no closer than the whole globe, no further than 50 times that)
      projection.rotate([0, 0, 0]).fitExtent([[50, 50], [width - 50, height - 50]], sphere);
      baseScale = projection.scale();
      zoom.scaleExtent([0.5, 50]);
      const spots = points.concat(counted.map(f => d3.geoCentroid(f)));
      let k = 1;
      if (spots.length) {
        const center = d3.geoCentroid({ type: 'MultiPoint', coordinates: spots });
        projection.rotate([-center[0], -center[1], 0]);
        // A point at angle a from the center sits sin(a) of the radius from it
        const spread = d3.max(spots, p => d3.geoDistance(center, p));
        const reach = spread < Math.PI / 2 ? Math.sin(spread) : 1;
        k = Math.max(1, Math.min(50, 0.4 * Math.min(width, height) / (baseScale * Math.max(reach, 0.001))));
      }
      setTransform(d3.zoomIdentity.scale(k));
    } else {
      const features = counted.slice();
      if (points.length) features.push({ type: 'Feature', geometry: { type: 'MultiPoint', coordinates: padded(points) } });
      const extent = [[MARGIN, MARGIN + 40], [Math.max(MARGIN + 1, width - MARGIN - room), height - MARGIN]];
      projection.fitExtent(extent, features.length ? { type: 'FeatureCollection', features } : whole());
      base = { scale: projection.scale(), translate: projection.translate() };
      // Out to the whole world, in to a street
      zoom.scaleExtent([Math.min(1, width / (2 * Math.PI) / base.scale), Math.max(1, 1e7 / base.scale)]);
      setTransform(d3.zoomIdentity);
    }
    schedule();
  }
  // Points spread over at least a degree, so one place doesn't fit as a dot
  function padded(points) {
    const [[x0, y0], [x1, y1]] = [[d3.min(points, p => p[0]), d3.min(points, p => p[1])], [d3.max(points, p => p[0]), d3.max(points, p => p[1])]];
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, dx = Math.max(0.5, (x1 - x0) / 2), dy = Math.max(0.5, (y1 - y0) / 2);
    return points.concat([[cx - dx, cy - dy], [cx + dx, cy + dy]]);
  }
  // What a flat projection shows with nothing to fit: the inhabited world, or the United States
  const whole = () => ({ type: 'MultiPoint', coordinates: settings.get('map-projection') === 'albers-usa'
    ? [[-124, 49], [-67, 45], [-80, 25], [-117, 32], [-160, 20], [-165, 65]] : [[-170, 72], [180, -56]] });

  // Drawing --------------------------------------------------------------------

  // What the last frame drew: for pointing at things, and for the tests
  let drawn = { nodes: [], links: [] }, quadtree = null;

  // Each shape (GeoJSON) as a Path2D under the flat projection's fitted scale
  // (base), kept until the projection or the fit changes
  let shapes = new WeakMap(), shapesFor = '';
  function shapeOf(data) {
    const key = settings.get('map-projection') + ' ' + base.scale + ' ' + base.translate;
    if (key !== shapesFor) {
      shapes = new WeakMap();
      shapesFor = key;
    }
    if (!shapes.has(data)) {
      const shape = new Path2D();
      projection.scale(base.scale).translate(base.translate);
      d3.geoPath(projection, shape)(data);
      applyTransform();
      shapes.set(data, shape);
    }
    return shapes.get(data);
  }

  // Draws the map into a 2D context w by h pixels
  function render(c, w, h) {
    const path = d3.geoPath(projection, c);
    const frame = { nodes: [], links: [], borders: false, graticule: false, states: false, counties: false, regions: 0, layers: userLayers.length, globe: globe() };
    c.clearRect(0, 0, w, h);
    const center = projection.translate(), radius = projection.scale();
    const shine = (inner, outer) => c.createRadialGradient(center[0] - radius / 3, center[1] - radius / 3, radius * inner, center[0], center[1], radius * outer);

    // The sea, and the land on it. The globe stands off the page on its shadow;
    // a flat map is sea to its edges.
    c.fillStyle = OCEAN;
    if (frame.globe) {
      c.save();
      c.shadowColor = 'rgba(0, 0, 0, 0.35)';
      c.shadowBlur = Math.min(40, radius / 8);
      c.shadowOffsetY = Math.min(12, radius / 30);
      c.beginPath();
      path(sphere);
      c.fill();
      c.restore();
    } else {
      c.fillRect(0, 0, w, h);
    }
    // The land, the shaded regions, the outlines and the user's layers. On a
    // flat map each is projected once at the fitted scale (see shapeOf) and
    // drawn moved and scaled as zoomed, so zooming and panning don't project
    // the counties' hundred thousand points on every frame.
    const flat = !frame.globe, k = flat ? transform.k : 1;
    if (flat) {
      c.save();
      c.transform(k, 0, 0, k, transform.x, transform.y);
    }
    const trace = data => {
      if (flat) return shapeOf(data);
      c.beginPath();
      path(data);
    };
    const fill = (data, color) => {
      const shape = trace(data);
      c.fillStyle = color;
      if (shape) c.fill(shape); else c.fill();
    };
    const stroke = (data, color, lineWidth) => {
      const shape = trace(data);
      c.strokeStyle = color;
      c.lineWidth = lineWidth / k;
      if (shape) c.stroke(shape); else c.stroke();
    };
    if (maps.countries) fill(maps.countries, LAND);
    if (regions) {
      const color = ramp();
      c.globalAlpha = 1 - settings.get('map-shade-transparency');
      regions.list.forEach(({ feature, count }) => fill(feature, regionColor(color, count)));
      c.globalAlpha = 1;
      frame.regions = regions.list.length;
    }
    if (settings.get('map-counties-show') && maps.counties) { stroke(maps.counties, OUTLINE, 0.4); frame.counties = true; }
    if (settings.get('map-states-show') && maps.states) { stroke(maps.states, BORDER, 0.6); frame.states = true; }
    if (settings.get('map-countries-show') && maps.countries) { stroke(maps.countries, BORDER, 0.8); frame.borders = true; }
    if (settings.get('map-graticule-show')) { stroke(graticule, 'rgba(60, 70, 80, 0.35)', 0.5); frame.graticule = true; }
    userLayers.forEach(layer => {
      c.globalAlpha = 0.15;
      fill(layer.data, layer.color);
      c.globalAlpha = 1;
      stroke(layer.data, layer.color, 1.5);
    });
    if (flat) c.restore();

    // The globe's light: brighter toward the top left, darker at the rim
    if (frame.globe) {
      c.beginPath();
      path(sphere);
      const light = shine(0, 1.25);
      light.addColorStop(0, 'rgba(255, 255, 255, 0.35)');
      light.addColorStop(0.5, 'rgba(255, 255, 255, 0)');
      light.addColorStop(1, 'rgba(0, 0, 0, 0.3)');
      c.fillStyle = light;
      c.fill();
    }

    // Where a place is on screen, or null when it's out of sight (behind the
    // globe, or outside the United States' insets)
    const facing = frame.globe ? [-projection.rotate()[0], -projection.rotate()[1]] : null;
    const screen = point => (facing && d3.geoDistance(point, facing) > Math.PI / 2) ? null : projection(point);

    if (settings.get('map-link-show')) {
      const colorVariable = settings.get('link-color-variable'), linkColor = settings.get('link-color');
      const groups = new Map();
      MT.getVisibleLinks().forEach(d => {
        if (!positions.has(d.source) || !positions.has(d.target)) return;
        const s = lonLat(d.source), t = lonLat(d.target);
        const ends = [screen(s), screen(t)];
        if (frame.globe && (!ends[0] || !ends[1])) return;
        const color = colorVariable === 'None' ? linkColor : ctx.temp.style.linkColorMap(MT.linkColorValue(d, colorVariable));
        if (!groups.has(color)) groups.set(color, []);
        // (On the globe, an arc through the middle of the great circle)
        const link = { d, s, t, stroke: color, points: frame.globe ? [ends[0], screen(d3.geoInterpolate(s, t)(0.5)), ends[1]] : ends };
        groups.get(color).push(link);
        frame.links.push(link);
      });
      c.globalAlpha = frame.linkAlpha = 1 - settings.get('map-link-transparency');
      if (frame.globe) {
        // Each an arc over the surface, under a dark casing, so light colors
        // stand out from the sea
        const swoosh = d3.line().curve(d3.curveNatural).context(c);
        c.beginPath();
        frame.links.forEach(l => swoosh(l.points));
        c.lineWidth = 3.5;
        c.strokeStyle = 'rgba(0, 0, 0, 0.35)';
        c.stroke();
        groups.forEach((links, color) => {
          c.beginPath();
          links.forEach(l => swoosh(l.points));
          c.lineWidth = 2;
          c.strokeStyle = color;
          c.stroke();
        });
      } else {
        groups.forEach((links, color) => {
          c.beginPath();
          path({ type: 'MultiLineString', coordinates: links.map(l => [l.s, l.t]) });
          c.lineWidth = 1.5;
          c.strokeStyle = color;
          c.stroke();
        });
      }
      c.globalAlpha = 1;
    }

    if (settings.get('map-node-show')) {
      const colorVariable = settings.get('node-color-variable'), nodeColor = settings.get('node-color');
      const selected = settings.get('selected-color');
      c.globalAlpha = frame.nodeAlpha = 1 - settings.get('map-node-transparency');
      MT.getVisibleNodes().forEach(d => {
        if (!positions.has(d._id)) return;
        const p = screen(lonLat(d._id));
        if (!p) return;
        const fill = colorVariable === 'None' ? nodeColor : ctx.temp.style.nodeColorMap(d[colorVariable]);
        const edge = d.selected ? selected : '#000000';
        c.beginPath();
        c.arc(p[0], p[1], RADIUS, 0, 2 * Math.PI);
        c.fillStyle = fill;
        c.fill();
        c.lineWidth = d.selected ? 2.5 : 1;
        c.strokeStyle = edge;
        c.stroke();
        frame.nodes.push({ d, x: p[0], y: p[1], fill, stroke: edge });
      });
      c.globalAlpha = 1;
    }
    return frame;
  }

  // Draws a frame on the screen, at the screen's resolution
  let pending = 0;
  function draw() {
    pending = 0;
    if (!width || !height || destroyed) return;
    const ratio = window.devicePixelRatio || 1;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    drawn = render(context, width, height);
    quadtree = null;
  }
  const schedule = () => { if (!pending && !destroyed) pending = requestAnimationFrame(draw); };

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    const ratio = window.devicePixelRatio || 1;
    width = w;
    height = h;
    canvas.width = Math.round(w * ratio);
    canvas.height = Math.round(h * ratio);
    if (globe()) {
      // The globe stays the same size against the view
      const rotation = projection.rotate();
      projection.rotate([0, 0, 0]).fitExtent([[50, 50], [width - 50, height - 50]], sphere);
      baseScale = projection.scale();
      projection.rotate(rotation);
      applyTransform();
    }
    // The first time it has a size, it frames what it has
    if (fitPending || !framed) fit();
    schedule();
  }

  // Pointing at things ---------------------------------------------------------

  // The node, link or region under a point of the canvas, if any
  function hit([x, y]) {
    if (!quadtree) quadtree = d3.quadtree(drawn.nodes, n => n.x, n => n.y);
    const node = quadtree.find(x, y, NEAR);
    if (node) return { node: node.d };
    const linkTooltip = settings.get('map-link-tooltip-variable');
    if (linkTooltip && linkTooltip !== 'None') {
      const link = drawn.links.find(l => {
        for (let i = 1; i < l.points.length; i++) {
          if (l.points[i - 1] && l.points[i] && distance([x, y], l.points[i - 1], l.points[i]) <= NEAR_LINK) return true;
        }
        return false;
      });
      if (link) return { link: link.d };
    }
    if (regions) {
      const place = projection.invert([x, y]);
      if (place && (!globe() || d3.geoDistance(place, [-projection.rotate()[0], -projection.rotate()[1]]) <= Math.PI / 2)) {
        const region = regions.list.find(r => inBounds(r.feature, place) && d3.geoContains(r.feature, place));
        if (region) return { region };
      }
    }
    return {};
  }
  // From point p to the segment from a to b
  function distance([px, py], [ax, ay], [bx, by]) {
    const dx = bx - ax, dy = by - ay, length = dx * dx + dy * dy;
    const t = length ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / length)) : 0;
    return Math.hypot(px - ax - t * dx, py - ay - t * dy);
  }
  // Whether a place is in a region's bounding box (worked out once), to check
  // only the regions it might be in
  const bounds = new WeakMap();
  function inBounds(feature, [lon, lat]) {
    if (!bounds.has(feature)) bounds.set(feature, d3.geoBounds(feature));
    const [[x0, y0], [x1, y1]] = bounds.get(feature);
    return lat >= y0 && lat <= y1 && (x0 <= x1 ? lon >= x0 && lon <= x1 : lon >= x0 || lon <= x1);
  }

  const pointer = e => { const box = canvas.getBoundingClientRect(); return [e.clientX - box.left, e.clientY - box.top]; };
  function showTooltip(e) {
    const found = hit(pointer(e));
    const text = (key, d) => {
      const v = settings.get(key);
      return d && v && v !== 'None' && d[v] != null && d[v] !== '' ? MT.escape(d[v]) : '';
    };
    const html = found.node ? text('map-node-tooltip-variable', found.node)
      : found.link ? text('map-link-tooltip-variable', found.link)
      : found.region ? `<b>${MT.escape(found.region.feature.properties.name)}</b>&nbsp;${found.region.count}` : '';
    MT.tooltip(html || null, e);
    canvas.style.cursor = found.node ? 'pointer' : '';
  }
  canvas.addEventListener('pointermove', e => { if (!e.buttons) showTooltip(e); });
  canvas.addEventListener('pointerleave', () => MT.tooltip(null));
  // Clicking a node selects it alone (with Ctrl, adds or removes it)
  canvas.addEventListener('click', e => {
    const { node } = hit(pointer(e));
    if (!node) return;
    select(node, e.ctrlKey || e.metaKey);
  });
  function select(d, add) {
    if (!add) ctx.session.data.nodes.forEach(node => { if (node !== d) node.selected = false; });
    d.selected = !d.selected;
    events.emit('node-selected', 'geo_map');
  }

  // The keyboard pans (or turns the globe) with the arrows, and zooms with + and -
  canvas.addEventListener('keydown', e => {
    const step = 60, moves = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    if (moves[e.key]) {
      e.preventDefault();
      if (globe()) {
        const r = projection.rotate(), degrees = 180 / Math.PI / projection.scale();
        projection.rotate([r[0] + moves[e.key][0] * degrees, Math.max(-90, Math.min(90, r[1] - moves[e.key][1] * degrees)), r[2]]);
        schedule();
      } else {
        selection.transition().duration(150).call(zoom.translateBy, moves[e.key][0] / transform.k, moves[e.key][1] / transform.k);
      }
    } else if (e.key === '+' || e.key === '=' || e.key === '-') {
      e.preventDefault();
      zoomBy(e.key === '-' ? 0.5 : 2);
    }
  });
  const zoomBy = k => selection.transition().duration(250).call(zoom.scaleBy, k);
  $('.zoom-in-button').addEventListener('click', () => zoomBy(2));
  $('.zoom-out-button').addEventListener('click', () => zoomBy(0.5));
  $('.fit-button').addEventListener('click', fit);

  // The globe turns by itself while autorotation is on
  let spinner = null;
  function stopSpinning() {
    if (spinner) spinner.stop();
    spinner = null;
    const button = $('.autorotate-toggle');
    button.classList.remove('active');
    button.querySelector('.bi').className = 'bi bi-play-fill';
  }
  $('.autorotate-toggle').addEventListener('click', () => {
    if (spinner) return stopSpinning();
    let last = d3.now();
    spinner = d3.timer(() => {
      const now = d3.now(), r = projection.rotate();
      projection.rotate([r[0] - (now - last) * 6 / 1000, r[1], r[2]]);
      last = now;
      schedule();
    });
    const button = $('.autorotate-toggle');
    button.classList.add('active');
    // Play to turn it, pause to stop
    button.querySelector('.bi').className = 'bi bi-pause-fill';
  });

  $('.reroll-button').addEventListener('click', () => {
    jitter.reroll();
    schedule();
  });

  const userLayers = [];
  MT.geoJSONUpload($('.geojson-input'), $('.geojson-layers'), (data, color) => {
    const layer = { data: rewind(data), color };
    userLayers.push(layer);
    schedule();
    return {
      setColor: color => { layer.color = color; schedule(); },
      remove: () => { userLayers.splice(userLayers.indexOf(layer), 1); schedule(); }
    };
  }, '#990000');

  // Exporting ------------------------------------------------------------------

  function makeGeoJSON() {
    const nodes = MT.getVisibleNodes(true).filter(d => positions.has(d._id));
    const links = MT.getVisibleLinks(true).filter(d => positions.has(d.source) && positions.has(d.target));
    return {
      type: 'FeatureCollection',
      features: nodes.map(d => ({ type: 'Feature', geometry: { type: 'Point', coordinates: lonLat(d._id) }, properties: d }))
        .concat(links.map(d => ({ type: 'Feature', geometry: { type: 'LineString', coordinates: [lonLat(d.source), lonLat(d.target)] }, properties: d })))
        .concat(regions ? regions.list.map(({ feature, count }) => ({ ...feature, properties: { ...feature.properties, nodes: count } })) : [])
    };
  }
  // An image of the map at the view's size, on the view's background
  function image(type, filename) {
    const copy = document.createElement('canvas');
    copy.width = width;
    copy.height = height;
    const c = copy.getContext('2d');
    c.fillStyle = getComputedStyle(canvas).backgroundColor;
    c.fillRect(0, 0, width, height);
    const page = document.createElement('canvas');
    page.width = width;
    page.height = height;
    render(page.getContext('2d'), width, height);
    c.drawImage(page, 0, 0);
    paintLegend(c, height);
    copy.toBlob(blob => MT.saveImage(blob, filename + '.' + type), 'image/' + type);
  }
  MT.paneToggle($('.settings-toggle'), pane);
  MT.tableExport(root, {
    ...Object.fromEntries(['png', 'jpeg', 'webp'].map(type => [type, filename => image(type, filename)])),
    geojson: filename => MT.exportBlob(JSON.stringify(makeGeoJSON()), 'application/json', filename + '.geojson')
  });

  // Settings and events --------------------------------------------------------

  const redraw = () => { loadMaps(); schedule(); };
  const replace = () => { place(); shade(); };
  MT.pickLocationFields(settings, 'map-field-');
  makeProjection();
  const stop = [
    MTBind(pane, settings),
    settings.subscribe(fieldKeys, replace),
    settings.subscribe('map-projection', () => { makeProjection(); fit(); }),
    settings.subscribe('map-shade', () => { fitShading = true; loadMaps(); shade(); }),
    settings.subscribe(['map-shade-color-low', 'map-shade-color-medium', 'map-shade-color-high'], () => { showLegend(); schedule(); }),
    settings.subscribe(['map-countries-show', 'map-states-show', 'map-counties-show', 'map-graticule-show', 'map-node-show', 'map-link-show',
      'map-node-transparency', 'map-link-transparency', 'map-node-jitter', 'map-shade-transparency'], redraw),
    events.on('node-visibility', replace),
    ...['node-selected', 'node-color-change', 'selected-color-change', 'link-color-change', 'link-visibility'].map(type => events.on(type, schedule))
  ];
  loadMaps();
  replace();
  resize();

  const handle = ctx.temp.geoMap = {
    get projection() { return projection; },
    get positions() { return positions; },
    get drawn() { return drawn; },
    get regions() { return regions; },
    get transform() { return transform; },
    get maps() { return maps; },
    at, hit, redraw: schedule, fit, select
  };
  return {
    // The page's floating panels this view shows (see MT.placePanels)
    panels: ['link-colors', 'node-colors'],
    resize,
    hide: stopSpinning,
    destroy() {
      destroyed = true;
      stop.forEach(fn => fn());
      stopSpinning();
      selection.interrupt().on('.zoom', null);
      if (pending) cancelAnimationFrame(pending);
      MT.tooltip(null);
      if (ctx.temp.geoMap === handle) delete ctx.temp.geoMap;
    }
  };
}
