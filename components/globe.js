  MT.registerView('globe', (root, { settings, events }) => {

    const $ = selector => root.querySelector(selector);
    const pane = $('.left-pane');
    const canvas = $('.globe');
    const context = canvas.getContext('2d');
    let width = 0, height = 0, baseScale = 1, zoom = 1, destroyed = false;

    const sphere = { type: 'Sphere' };
    const graticule = d3.geoGraticule10();
    const projection = d3.geoOrthographic().precision(0.1);
    const path = d3.geoPath(projection, context);
    const starProjection = d3.geoAzimuthalEquidistant();
    const starPath = d3.geoPath(starProjection, context).pointRadius(1);
    const swoosh = d3.line().curve(d3.curveNatural).defined(d => projection.invert(d)).context(context);
    const map = { stars: null, countries: null };
    const userLayers = [];

    const field = kind => {
      const value = settings.get('globe-field-' + kind);
      return value && value != 'None' ? value : null;
    };
    const fieldKeys = [...MT.locationKinds, 'lat', 'lon'].map(kind => 'globe-field-' + kind);

    // Where each node goes ([lat, lon], by _id), moved by the jitter setting
    let positions = new Map(), request = 0, faced = false;
    const jitter = MT.jitterer(() => settings.get('globe-node-jitter'));
    const at = id => jitter.at(id, positions.get(id));
    async function place() {
      const ticket = ++request;
      const located = await MT.locateNodes(MT.getVisibleNodes(), field);
      if (ticket != request || destroyed) return;
      positions = located;
      cache = null;
      // The first time there are nodes to show, turn and zoom to them
      if (!faced && positions.size) {
        faced = true;
        fitPending = true;
      }
      if (fitPending) fit();
      draw();
    }

    // Turns the globe to face the nodes, and zooms until they fill most of the
    // view (no closer than the whole globe, no further than 50 times that)
    let fitPending = false;
    function fit() {
      if (!positions.size) return;
      if (!width || !height || !map.countries) return void (fitPending = true);
      fitPending = false;
      const points = Array.from(positions.values(), ([lat, lon]) => [lon, lat]);
      const center = d3.geoCentroid({ type: 'MultiPoint', coordinates: points });
      projection.rotate([-center[0], -center[1], 0]);
      // A point at angle a from the center sits sin(a) of the radius from it
      const spread = d3.max(points, p => d3.geoDistance(center, p));
      const reach = spread < Math.PI / 2 ? Math.sin(spread) : 1;
      const k = Math.max(1, Math.min(50, 0.4 * Math.min(width, height) / (baseScale * Math.max(reach, 0.001))));
      d3.select(canvas).call(zoomer.scaleTo, k);
    }

    function resize() {
      width = root.clientWidth;
      height = root.clientHeight;
      if (!width || !height) return;
      canvas.width = width;
      canvas.height = height;
      const rotation = projection.rotate();
      projection.rotate([0, 0, 0]).fitExtent([[50, 50], [width - 50, height - 50]], sphere);
      baseScale = projection.scale();
      projection.scale(baseScale * zoom).rotate(rotation);
      if (map.stars) starProjection.fitExtent([[0, 0], [3 * width, 3 * height]], map.stars).translate([width / 2, height / 2]);
      if (fitPending) fit();
      draw();
    }

    // What the last frame drew (for tests)
    let drawn = {};

    // Everything about the links and nodes that doesn't change as the globe
    // turns: node coordinates ([lon, lat], by _id), each link's ends, middle
    // and color, and the nodes grouped by color. Thrown away by redraw when a
    // position, color or visibility may have changed.
    let cache = null;
    function geometry() {
      if (cache) return cache;
      const points = new Map(), links = [], nodes = new Map();
      const point = id => {
        if (!points.has(id)) { const [lat, lon] = at(id); points.set(id, [lon, lat]); }
        return points.get(id);
      };
      const linkVariable = settings.get('link-color-variable'), linkColor = settings.get('link-color');
      MT.getVisibleLinks().forEach(d => {
        if (!positions.has(d.source) || !positions.has(d.target)) return;
        const s = point(d.source), t = point(d.target);
        links.push({
          source: d.source,
          target: d.target,
          s,
          t,
          m: d3.geoInterpolate(s, t)(0.5),
          stroke: linkVariable == 'None' ? linkColor : temp.style.linkColorMap(MT.linkColorValue(d, linkVariable))
        });
      });
      const nodeVariable = settings.get('node-color-variable'), nodeColor = settings.get('node-color');
      MT.getVisibleNodes().forEach(d => {
        if (!positions.has(d._id)) return;
        const fill = nodeVariable == 'None' ? nodeColor : temp.style.nodeColorMap(d[nodeVariable]);
        if (!nodes.has(fill)) nodes.set(fill, []);
        nodes.get(fill).push({ type: 'Point', coordinates: point(d._id) });
      });
      return (cache = { points, links, nodes });
    }
    const redraw = () => {
      cache = null;
      draw();
    };

    function draw() {
      if (!width || !height || !map.countries) return;
      const facing = [-projection.rotate()[0], -projection.rotate()[1]];
      const visible = point => d3.geoDistance(point, facing) <= Math.PI / 2;
      drawn = { stars: false, graticule: false, borders: false, nodes: 0, links: 0, layers: userLayers.length };
      context.clearRect(0, 0, width, height);

      if (settings.get('globe-stars-show') && map.stars) {
        starProjection.rotate([-projection.rotate()[0], -projection.rotate()[1]]);
        context.beginPath();
        starPath(map.stars);
        context.fillStyle = '#fff';
        context.fill();
        drawn.stars = true;
      }

      context.beginPath();
      path(sphere);
      context.fillStyle = '#bcd4e2'; // ocean
      context.fill();

      context.beginPath();
      path(map.countries);
      context.fillStyle = '#f3f1ea'; // land
      context.fill();
      if (settings.get('globe-countries-show')) {
        context.lineWidth = 1;
        context.strokeStyle = '#444444';
        context.stroke();
        drawn.borders = true;
      }

      userLayers.forEach(layer => {
        context.beginPath();
        path(layer.data);
        context.strokeStyle = layer.color;
        context.lineWidth = 1;
        context.stroke();
      });

      if (settings.get('globe-graticule-show')) {
        context.beginPath();
        path(graticule);
        context.strokeStyle = '#444';
        context.lineWidth = 1;
        context.stroke();
        drawn.graticule = true;
      }

      if (settings.get('globe-link-show')) {
        // Links between nodes facing the viewer, as arcs over the surface, a
        // path per color (as the link color table gives them)
        // The arcs' ends and middles are worked out once (see geometry), not on
        // every frame of a spin; a frame only projects them.
        const arcs = new Map(), shown = new Map();
        const faces = id => {
          if (!shown.has(id)) shown.set(id, visible(geometry().points.get(id)));
          return shown.get(id);
        };
        geometry().links.forEach(({ source, target, s, m, t, stroke }) => {
          if (!faces(source) || !faces(target)) return;
          if (!arcs.has(stroke)) arcs.set(stroke, []);
          arcs.get(stroke).push([projection(s), projection(m), projection(t)]);
        });
        context.globalAlpha = drawn.linkAlpha = 1 - settings.get('globe-link-transparency');
        // Each under a dark casing, so light colors stand out from the ocean
        context.beginPath();
        arcs.forEach(group => group.forEach(swoosh));
        context.lineWidth = 3.5;
        context.strokeStyle = 'rgba(0, 0, 0, 0.35)';
        context.stroke();
        arcs.forEach((group, stroke) => {
          context.beginPath();
          group.forEach(swoosh);
          context.lineWidth = 2;
          context.strokeStyle = stroke;
          context.stroke();
        });
        context.globalAlpha = 1;
        drawn.links = Array.from(arcs.values()).reduce((n, group) => n + group.length, 0);
        drawn.linkColors = Array.from(arcs.keys());
      }

      if (settings.get('globe-node-show')) {
        // The nodes, a path per color
        const groups = geometry().nodes;
        groups.forEach(points => { drawn.nodes += points.length; });
        context.globalAlpha = drawn.nodeAlpha = 1 - settings.get('globe-node-transparency');
        // Each outlined in a darker shade, so close nodes stay apart
        context.lineWidth = 1;
        groups.forEach((points, fill) => {
          context.beginPath();
          path({ type: 'GeometryCollection', geometries: points });
          context.fillStyle = fill;
          context.fill();
          context.strokeStyle = d3.color(fill).darker(1.5) + '';
          context.stroke();
        });
        context.globalAlpha = 1;
      }
    }

    // Dragging turns the globe; the wheel zooms
    const zoomer = d3.zoom().scaleExtent([0.5, 50]).filter(e => e.type == 'wheel').on('zoom', e => {
      zoom = e.transform.k;
      projection.scale(baseScale * zoom);
      draw();
    });
    let start, rotation;
    d3.select(canvas)
      .call(d3.drag()
        .on('start', e => { start = [e.x, e.y]; rotation = projection.rotate(); })
        .on('drag', e => {
          projection.rotate([
            (e.x - start[0]) / zoom + rotation[0],
            Math.max(-90, Math.min((start[1] - e.y) / zoom + rotation[1], 90)),
            0
          ]);
          draw();
        }))
      .call(zoomer);
    $('.fit-button').addEventListener('click', fit);

    let spinner = null, last;
    function autorotate() {
      const button = $('.autorotate-toggle');
      if (spinner) {
        spinner.stop();
        spinner = null;
      } else {
        last = d3.now();
        spinner = d3.timer(() => {
          const now = d3.now(), r = projection.rotate();
          projection.rotate([r[0] - (now - last) * 6 / 1000, r[1], r[2]]);
          last = now;
          draw();
        });
      }
      button.classList.toggle('active', !!spinner);
      // Play to turn it, pause to stop
      button.querySelector('.bi').className = 'bi ' + (spinner ? 'bi-pause-fill' : 'bi-play-fill');
    }
    $('.autorotate-toggle').addEventListener('click', autorotate);

    $('.reroll-button').addEventListener('click', () => {
      jitter.reroll();
      redraw();
    });

    MT.geoJSONUpload($('.geojson-input'), $('.geojson-layers'), (data, color) => {
      const layer = { data, color };
      userLayers.push(layer);
      draw();
      return {
        setColor: color => { layer.color = color; draw(); },
        remove: () => { userLayers.splice(userLayers.indexOf(layer), 1); draw(); }
      };
    }, '#990000');

    function makeGeoJSON() {
      const point = id => at(id).slice().reverse();
      const nodes = MT.getVisibleNodes(true).filter(d => positions.has(d._id));
      const links = MT.getVisibleLinks(true).filter(d => positions.has(d.source) && positions.has(d.target));
      return {
        type: 'FeatureCollection',
        features: nodes.map(d => ({ type: 'Feature', geometry: { type: 'Point', coordinates: point(d._id) }, properties: d }))
          .concat(links.map(d => ({ type: 'Feature', geometry: { type: 'LineString', coordinates: [point(d.source), point(d.target)] }, properties: d })))
      };
    }

    MT.paneToggle($('.settings-toggle'), pane);
    MT.tableExport(root, {
      ...Object.fromEntries(['png', 'jpeg', 'webp'].map(type => [type, filename =>
        canvas.toBlob(blob => MT.saveImage(blob, filename + '.' + type), 'image/' + type)])),
      geojson: filename => MT.exportBlob(JSON.stringify(makeGeoJSON()), 'application/json', filename + '.geojson')
    });

    MT.pickLocationFields(settings, 'globe-field-');
    const stop = [
      MTBind(pane, settings),
      settings.subscribe(fieldKeys, place),
      settings.subscribe(['globe-node-show', 'globe-link-show', 'globe-stars-show', 'globe-countries-show', 'globe-graticule-show',
        'globe-node-transparency', 'globe-link-transparency', 'globe-node-jitter'], redraw),
      events.on('node-visibility', place),
      ...['node-color-change', 'link-color-change', 'link-visibility'].map(type => events.on(type, redraw))
    ];
    // d3 fills a polygon on the side its winding points to, so one wound the
    // other way covers the rest of the sphere (as Bermuda's does in
    // countries.json). Reverse any that cover more than half of it.
    function rewind(collection) {
      collection.features.forEach(feature => {
        if (d3.geoArea(feature) <= 2 * Math.PI) return;
        const { type, coordinates } = feature.geometry;
        if (type == 'Polygon') coordinates.forEach(ring => ring.reverse());
        else if (type == 'MultiPolygon') coordinates.forEach(polygon => polygon.forEach(ring => ring.reverse()));
      });
      return collection;
    }
    Promise.all([MT.getMapData('stars.json'), MT.getMapData('countries.json')]).then(([stars, countries]) => {
      if (destroyed) return;
      map.stars = stars;
      map.countries = rewind(countries);
      resize();
    });
    place();

    const handle = temp.globe = { projection, get countries() { return map.countries; }, get positions() { return positions; }, get drawn() { return drawn; }, at, redraw };
    return {
      // The page's floating panels this view shows (see MT.placePanels)
      panels: ['link-colors', 'node-colors'],
      resize,
      destroy() {
        destroyed = true;
        stop.forEach(fn => fn());
        if (spinner) spinner.stop();
        if (temp.globe === handle) delete temp.globe;
      }
    };
  });
