  MT.registerView('choropleth', (root, { settings, events }) => {

    const $ = selector => root.querySelector(selector);
    const pane = $('.left-pane');
    const map = L.map($('.map-canvas'), {
      center: [39.8, -98.5],
      zoom: 5,
      zoomControl: false,
      maxZoom: 20,
      preferCanvas: true
    });
    const layers = { ...MT.tileLayers(), countries: null, aggregates: null };

    // The legend: what's counted, over the color ramp, with the lowest and
    // highest counts below it (solid, however see-through the regions are)
    const legendDiv = L.DomUtil.create('div', 'legend choropleth-legend');
    legendDiv.innerHTML = '<div class="legend-title"></div><div class="legend-ramp"></div><div class="legend-ends"><span></span><span></span></div>';
    let legendState = null;
    const legend = L.control({ position: 'bottomleft' });
    legend.onAdd = () => legendDiv;
    legend.addTo(map);
    L.control.zoom({ position: 'bottomleft' }).addTo(map);

    // Each kind of region: its map file, the keys a node's value may match it
    // by, and the node fields that likely hold them
    const units = {
      countries: { file: 'countries.json', keys: f => [f.id, f.properties.name], fields: ['country'] },
      states: { file: 'states.json', keys: f => [f.properties.usps, f.properties.name], fields: ['state'] },
      counties: { file: 'counties.json', keys: f => [f.properties.fips, parseFloat(f.properties.fips)], fields: ['county', 'fips'] }
    };
    const unit = () => units[settings.get('choropleth-aggregate-as')] || units.states;

    // With no field chosen, a node field named for the kind of region is used
    function pickField() {
      const field = settings.get('choropleth-aggregate-on');
      if (field && field != 'None' && session.data.nodeFields.includes(field)) return;
      const match = session.data.nodeFields.find(f => unit().fields.includes(f.toLowerCase()));
      if (match) settings.set('choropleth-aggregate-on', match);
    }

    // The regions, each with its count of visible nodes (properties.density)
    let regions = null, request = 0, destroyed = false, fitNext = true;
    async function aggregate() {
      const ticket = ++request, { file, keys } = unit();
      const data = await MT.getMapData(file);
      // A newer request, or a closed view, makes this one moot
      if (ticket != request || destroyed) return;
      const index = new Map();
      data.features.forEach(f => keys(f).forEach(k => {
        if (k != null && k === k) index.set(String(k), f);
      }));
      const counts = new Map(), field = settings.get('choropleth-aggregate-on');
      if (field && field != 'None') MT.getVisibleNodes().forEach(d => {
        const v = d[field];
        if (v == null || v === '') return;
        const number = parseFloat(v);
        const region = index.get(String(v)) || (isFinite(number) && index.get(String(number)));
        if (region) counts.set(region, (counts.get(region) || 0) + 1);
      });
      regions = {
        type: 'FeatureCollection',
        features: data.features.map(f => ({ ...f, properties: { ...f.properties, density: counts.get(f) || 0 } }))
      };
      draw();
    }

    const ramp = () => d3.scaleLinear().domain([0, 0.5, 1]).range([
      settings.get('choropleth-color-low'),
      settings.get('choropleth-color-medium'),
      settings.get('choropleth-color-high')
    ]);
    const opacity = () => 1 - settings.get('choropleth-transparency');

    function draw() {
      if (!regions) return;
      if (layers.aggregates) layers.aggregates.remove();
      const densities = regions.features.map(f => f.properties.density);
      const min = Math.min(...densities), max = Math.max(...densities), range = max - min;
      const color = ramp();
      layers.aggregates = L.geoJSON(regions, {
        style: f => ({
          fillColor: color(range ? (f.properties.density - min) / range : 0),
          weight: 2,
          opacity: 1,
          color: '#dadde0',
          fillOpacity: opacity()
        }),
        onEachFeature: (f, layer) => layer
          .on('mouseover', e => MT.tooltip(`<b>${f.properties.name}</b>&nbsp;${f.properties.density}`, e.originalEvent))
          .on('mouseout', () => MT.tooltip(null))
      }).addTo(map);
      drawLegend(color, min, max);
      // Opens on the regions with data, and again when what's counted changes
      if (fitNext) {
        fitNext = false;
        fit(false);
      }
    }

    function drawLegend(color, min, max) {
      const field = settings.get('choropleth-aggregate-on');
      const title = field && field != 'None' ? 'Nodes by ' + MT.titleize(field) : 'Nodes';
      legendState = { color, min, max, title };
      legendDiv.querySelector('.legend-title').textContent = title;
      legendDiv.querySelector('.legend-ramp').style.background = `linear-gradient(to right, ${[0, 0.5, 1].map(t => d3.rgb(color(t)).formatHex()).join(', ')})`;
      const [low, high] = legendDiv.querySelectorAll('.legend-ends span');
      low.textContent = min;
      high.textContent = max;
    }

    // The legend as drawn into an exported image, at the bottom left
    function paintLegend(context, canvas) {
      if (!legendState) return;
      const { color, min, max, title } = legendState;
      const x = 10, width = 200, top = canvas.height - 64;
      context.fillStyle = 'rgba(255, 255, 255, 0.9)';
      context.fillRect(x, top, width + 16, 56);
      context.fillStyle = '#212529';
      context.font = 'bold 13px sans-serif';
      context.textAlign = 'left';
      context.fillText(title, x + 8, top + 17);
      const gradient = context.createLinearGradient(x + 8, 0, x + 8 + width, 0);
      [0, 0.5, 1].forEach(t => gradient.addColorStop(t, d3.rgb(color(t)).formatHex()));
      context.fillStyle = gradient;
      context.fillRect(x + 8, top + 24, width, 12);
      context.fillStyle = '#212529';
      context.font = '12px sans-serif';
      context.fillText(min + '', x + 8, top + 50);
      context.textAlign = 'right';
      context.fillText(max + '', x + 8 + width, top + 50);
    }

    function setTransparency() {
      if (layers.aggregates) layers.aggregates.setStyle({ fillOpacity: opacity() });
    }

    // The tile layers take turns, and the countries show when neither does
    function showLayers() {
      const basemap = settings.get('choropleth-basemap-show'), satellite = settings.get('choropleth-satellite-show');
      MT.showLayer(map, layers.basemap, basemap);
      MT.showLayer(map, layers.satellite, satellite);
      MT.showLayer(map, layers.countries, !basemap && !satellite);
      // The countries are behind the regions
      if (layers.aggregates) layers.aggregates.bringToFront();
    }
    const takeTurns = other => value => {
      if (value) settings.set(other, false);
      showLayers();
    };

    MT.getMapData('countries.json').then(data => {
      if (destroyed) return;
      layers.countries = L.geoJSON(data, { color: '#dadde0', weight: 1, fillColor: '#fafaf8', fillOpacity: 1 });
      showLayers();
    });

    // Fits the regions that have nodes, or all of them if none do
    function fit(animate = true) {
      if (!layers.aggregates) return;
      const counted = layers.aggregates.getLayers().filter(l => l.feature.properties.density > 0);
      const bounds = (counted.length ? L.featureGroup(counted) : layers.aggregates).getBounds();
      if (animate) map.flyToBounds(bounds, { padding: [20, 20] });
      else map.fitBounds(bounds, { padding: [20, 20] });
    }
    $('.fit-button').addEventListener('click', () => fit());

    MT.paneToggle($('.settings-toggle'), pane);
    const userLayers = MT.leafletGeoJSONUpload($('.geojson-input'), $('.geojson-layers'), map);
    MT.tableExport(root, {
      ...Object.fromEntries(['png', 'jpeg', 'webp'].map(type => [type, filename => MT.mapImage(map, filename, type, paintLegend)])),
      geojson: filename => MT.saveAs(
        new Blob([JSON.stringify(regions)], { type: 'application/json;charset=utf-8' }),
        filename + '.geojson'
      )
    });

    pickField();
    const stop = [
      MTBind(pane, settings),
      settings.subscribe('choropleth-aggregate-as', pickField),
      settings.subscribe(['choropleth-aggregate-as', 'choropleth-aggregate-on'], () => { fitNext = true; aggregate(); }),
      settings.subscribe(['choropleth-color-low', 'choropleth-color-medium', 'choropleth-color-high'], draw),
      settings.subscribe('choropleth-transparency', setTransparency),
      settings.subscribe('choropleth-basemap-show', takeTurns('choropleth-satellite-show')),
      settings.subscribe('choropleth-satellite-show', takeTurns('choropleth-basemap-show')),
      events.on('node-visibility', aggregate)
    ];
    aggregate();
    showLayers();

    const handle = temp.choropleth = { map, layers, userLayers };
    return {
      resize: () => map.invalidateSize(),
      destroy() {
        destroyed = true;
        stop.forEach(fn => fn());
        MT.tooltip(null);
        map.remove();
        if (temp.choropleth === handle) delete temp.choropleth;
      }
    };
  });
