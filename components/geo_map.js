  MT.registerView('geo_map', (root, { settings, events }) => {

    const $ = selector => root.querySelector(selector);
    const pane = $('.left-pane');
    const map = L.map($('.map-canvas'), {
      center: [80, 0],
      zoom: 3,
      zoomControl: false,
      maxZoom: 20,
      preferCanvas: true
    });
    // Fitting leaves the docked tables at the right their room
    const clearOfDock = () => ({ paddingTopLeft: [20, 20], paddingBottomRight: [20 + MT.dockRoom(root), 20] });
    L.control.zoom({ position: 'bottomleft' }).addTo(map);
    const layers = { ...MT.tileLayers(), countries: null, states: null, counties: null, nodes: null, links: null };
    let destroyed = false;

    const field = name => {
      const value = settings.get('map-field-' + name);
      return value && value != 'None' ? value : null;
    };

    // Where each node goes ([lat, lon], by _id), moved by the jitter setting
    let positions = new Map(), request = 0, fitted = false;
    const jitter = MT.jitterer(() => settings.get('map-node-jitter'));
    const jittered = id => jitter.at(id, positions.get(id));
    const fieldKeys = [...MT.locationKinds, 'lat', 'lon'].map(kind => 'map-field-' + kind);

    async function place() {
      const ticket = ++request;
      const located = await MT.locateNodes(MT.getVisibleNodes(), field);
      // A newer request, or a closed view, makes this one moot
      if (ticket != request || destroyed) return;
      positions = located;
      drawLinks();
      drawNodes();
      if (!fitted && positions.size) {
        fitted = true;
        map.fitBounds(L.latLngBounds(Array.from(positions.values())), { animate: false, ...clearOfDock() });
      }
    }

    function drawNodes(collapse = settings.get('map-collapsing-on')) {
      if (layers.nodes) layers.nodes.remove();
      layers.nodes = null;
      if (!settings.get('map-node-show')) return;
      const colorVariable = settings.get('node-color-variable'), color = settings.get('node-color');
      const selected = settings.get('selected-color'), opacity = 1 - settings.get('map-node-transparency');
      const markers = MT.getVisibleNodes().filter(d => positions.has(d._id)).map(d => L.circleMarker(jittered(d._id), {
        weight: 1,
        opacity,
        color: d.selected ? selected : '#000000',
        fillColor: colorVariable == 'None' ? color : temp.style.nodeColorMap(d[colorVariable]),
        fillOpacity: opacity,
        data: d
      }));
      if (collapse) {
        layers.nodes = L.markerClusterGroup({ maxClusterRadius: 20, spiderLegPolylineOptions: { opacity: 0 } });
        layers.nodes.addLayers(markers);
      } else {
        layers.nodes = L.featureGroup(markers);
      }
      layers.nodes
        .on('mouseover', e => showTooltip(e, 'map-node-tooltip-variable'))
        .on('mouseout', () => MT.tooltip(null))
        .on('click', select)
        .addTo(map);
    }

    function drawLinks() {
      if (layers.links) layers.links.remove();
      layers.links = null;
      if (!settings.get('map-link-show')) return;
      const colorVariable = settings.get('link-color-variable'), color = settings.get('link-color');
      const opacity = 1 - settings.get('map-link-transparency');
      layers.links = L.featureGroup(MT.getVisibleLinks()
        .filter(d => positions.has(d.source) && positions.has(d.target))
        .map(d => L.polyline([jittered(d.source), jittered(d.target)], {
          color: colorVariable == 'None' ? color : temp.style.linkColorMap(MT.linkColorValue(d, colorVariable)),
          opacity,
          data: d
        })))
        .on('mouseover', e => showTooltip(e, 'map-link-tooltip-variable'))
        .on('mouseout', () => MT.tooltip(null))
        .addTo(map);
      restack();
    }

    function showTooltip(e, key) {
      const v = settings.get(key), d = e.layer && e.layer.options.data;
      if (d && v && v != 'None' && d[v] != null && d[v] !== '') MT.tooltip(MT.escape(d[v]), e.originalEvent);
    }

    // Clicking a node selects it alone (with Ctrl, adds or removes it)
    function select(e) {
      const d = e.layer && e.layer.options.data;
      if (!d) return;
      if (!(e.originalEvent && e.originalEvent.ctrlKey)) session.data.nodes.forEach(node => { if (node !== d) node.selected = false; });
      d.selected = !d.selected;
      events.emit('node-selected', 'geo_map');
    }

    // Layers, from the back: tiles, outlines (countries, states, counties), the
    // user's layers, links and nodes. Tiles are drawn in a pane of their own.
    function restack() {
      ['countries', 'states', 'counties'].forEach(name => layers[name] && map.hasLayer(layers[name]) && layers[name].bringToFront());
      userLayers.forEach(layer => layer.bringToFront());
      if (layers.links) layers.links.bringToFront();
      // A cluster group draws its single markers in a feature group of its own
      const nodes = layers.nodes instanceof L.MarkerClusterGroup ? layers.nodes._featureGroup : layers.nodes;
      if (nodes) nodes.bringToFront();
    }

    const outlines = {
      countries: { file: 'countries.json', weight: 1, fillOpacity: 1 },
      states: { file: 'states.json', weight: 0.5, fillOpacity: 0 },
      counties: { file: 'counties.json', weight: 0.5, fillOpacity: 0 }
    };
    function showLayers() {
      MT.showLayer(map, layers.basemap, settings.get('map-basemap-show'));
      MT.showLayer(map, layers.satellite, settings.get('map-satellite-show'));
      Object.entries(outlines).forEach(([name, style]) => {
        const show = settings.get(`map-${name}-show`);
        if (show && !layers[name]) {
          MT.getMapData(style.file).then(data => {
            if (destroyed || layers[name]) return;
            layers[name] = L.geoJSON(data, { color: '#dadde0', weight: style.weight, fillColor: '#fafaf8', fillOpacity: style.fillOpacity });
            showLayers();
          });
        }
        MT.showLayer(map, layers[name], show);
      });
      restack();
    }

    // A tile layer replaces the other and the outlines; with neither, the
    // countries and states come back
    const tiles = (key, other) => value => {
      if (value) {
        settings.set(other, false);
        ['countries', 'states', 'counties'].forEach(name => settings.set(`map-${name}-show`, false));
      } else if (!settings.get(other)) {
        settings.set('map-countries-show', true);
        settings.set('map-states-show', true);
      }
      showLayers();
    };

    function makeGeoJSON() {
      const point = id => { const [lat, lon] = jittered(id); return [lon, lat]; };
      const nodes = MT.getVisibleNodes(true).filter(d => positions.has(d._id));
      const links = MT.getVisibleLinks(true).filter(d => positions.has(d.source) && positions.has(d.target));
      return {
        type: 'FeatureCollection',
        features: nodes.map(d => ({ type: 'Feature', geometry: { type: 'Point', coordinates: point(d._id) }, properties: d }))
          .concat(links.map(d => ({ type: 'Feature', geometry: { type: 'LineString', coordinates: [point(d.source), point(d.target)] }, properties: d })))
      };
    }

    $('.fit-button').addEventListener('click', () => {
      if (positions.size) map.flyToBounds(L.latLngBounds(Array.from(positions.keys()).map(jittered)), clearOfDock());
    });
    $('.reroll-button').addEventListener('click', () => {
      jitter.reroll();
      drawLinks();
      drawNodes();
    });

    MT.paneToggle($('.settings-toggle'), pane);
    const userLayers = MT.leafletGeoJSONUpload($('.geojson-input'), $('.geojson-layers'), map);
    MT.tableExport(root, {
      // Images show every node, so they are drawn uncollapsed for a moment
      ...Object.fromEntries(['png', 'jpeg', 'webp'].map(type => [type, filename => {
        drawNodes(false);
        requestAnimationFrame(() => requestAnimationFrame(() => MT.mapImage(map, filename, type, () => drawNodes())));
      }])),
      geojson: filename => MT.saveAs(
        new Blob([JSON.stringify(makeGeoJSON())], { type: 'application/json;charset=utf-8' }),
        filename + '.geojson'
      )
    });

    MT.pickLocationFields(settings, 'map-field-');
    const redraw = () => { drawLinks(); drawNodes(); };
    const stop = [
      MTBind(pane, settings),
      settings.subscribe(fieldKeys, place),
      settings.subscribe(['map-node-show', 'map-collapsing-on', 'map-node-transparency'], () => drawNodes()),
      settings.subscribe(['map-link-show', 'map-link-transparency'], drawLinks),
      settings.subscribe('map-node-jitter', redraw),
      settings.subscribe(['map-countries-show', 'map-states-show', 'map-counties-show'], showLayers),
      settings.subscribe('map-basemap-show', tiles('map-basemap-show', 'map-satellite-show')),
      settings.subscribe('map-satellite-show', tiles('map-satellite-show', 'map-basemap-show')),
      events.on('node-visibility', place),
      ...['node-selected', 'node-color-change', 'selected-color-change'].map(type => events.on(type, () => drawNodes())),
      ...['link-color-change', 'link-visibility'].map(type => events.on(type, drawLinks))
    ];
    showLayers();
    place();

    const handle = temp.geoMap = { map, layers, userLayers };
    return {
      // The page's floating panels this view shows (see MT.placePanels)
      panels: ['link-colors', 'node-colors'],
      resize: () => map.invalidateSize(),
      destroy() {
        destroyed = true;
        stop.forEach(fn => fn());
        MT.tooltip(null);
        map.remove();
        if (temp.geoMap === handle) delete temp.geoMap;
      }
    };
  });
