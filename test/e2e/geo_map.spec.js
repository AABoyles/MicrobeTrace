// The geo map view: placing nodes from their coordinates, links, the layers,
// collapsing, transparency, jitter, selection, tooltips, redraws and export.
const { test, expect } = require('@playwright/test');
const { watchErrors, loadNetwork, launchView, closeView, openExport } = require('./helpers');

test.describe.configure({ mode: 'serial' });

let page, errors, tiles = 0;
test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  errors = watchErrors(page);
  // Tile servers are out of reach here: answer with an empty image, and count
  await page.route(/basemaps\.cartocdn\.com|arcgisonline\.com/, route => {
    tiles++;
    route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64') });
  });
  await loadNetwork(page);
  await launchView(page, 'geo_map');
});
test.afterAll(() => page.close());

const view = () => page.locator('.lm_content:has(.leaflet-container)').first();
const pane = () => view().locator('.left-pane');
const set = (key, value) => page.evaluate(([key, value]) => MT.settings.set(key, value), [key, value]);
const get = key => page.evaluate(key => session.style.widgets[key], key);
const onMap = layer => page.evaluate(layer => {
  const { map, layers } = temp.geoMap;
  return !!layers[layer] && map.hasLayer(layers[layer]);
}, layer);
// The markers drawn (inside clusters too) and the links
const markers = () => page.evaluate(() => {
  const { map, layers } = temp.geoMap;
  if (!layers.nodes || !map.hasLayer(layers.nodes)) return [];
  return layers.nodes.getLayers().map(m => ({
    id: m.options.data._id, lat: m.getLatLng().lat, lon: m.getLatLng().lng,
    color: m.options.color, fillOpacity: m.options.fillOpacity
  }));
});
const lines = () => page.evaluate(() => {
  const { map, layers } = temp.geoMap;
  return layers.links && map.hasLayer(layers.links) ? layers.links.getLayers().length : 0;
});
// The visible nodes with coordinates, and the visible links between them
const placed = () => page.evaluate(() => session.data.nodes.filter(d => d.visible && typeof d.lat == 'number').length);
const placedLinks = () => page.evaluate(() => {
  const placed = new Set(session.data.nodes.filter(d => d.visible && typeof d.lat == 'number').map(d => d._id));
  return MT.getVisibleLinks().filter(l => placed.has(l.source) && placed.has(l.target)).length;
});

test('places the nodes from their latitude and longitude fields', async () => {
  await expect.poll(async () => (await markers()).length).toBe(await placed());
  expect(await get('map-field-lat')).toBe('lat');
  expect(await get('map-field-lon')).toBe('lon');
  const s0 = (await markers()).find(m => m.id == 'S0');
  expect([s0.lat, s0.lon]).toEqual([30, -120]);
  expect(await page.evaluate(() => temp.geoMap.layers.nodes instanceof L.MarkerClusterGroup)).toBe(true);
});

test('draws the links between placed nodes', async () => {
  await expect.poll(lines).toBe(await placedLinks());
  expect(await lines()).toBeGreaterThan(0);
});

test('opens fitted to the nodes', async () => {
  await expect.poll(() => page.evaluate(() => {
    const { map, layers } = temp.geoMap;
    return map.getBounds().contains(layers.nodes.getBounds());
  })).toBe(true);
});

test('nodes and links can be hidden and shown', async () => {
  await view().locator('.settings-toggle').click();
  await expect(pane()).toBeVisible();
  await pane().locator('a', { hasText: 'Components' }).click();
  await pane().locator('button', { hasText: 'Network' }).click();
  const hideNodes = pane().locator('label', { has: page.locator('input[data-setting="map-node-show"][value="false"]') });
  await expect(hideNodes).toBeVisible();
  await hideNodes.click();
  await expect.poll(async () => (await markers()).length).toBe(0);
  await set('map-node-show', true);
  await expect.poll(async () => (await markers()).length).toBe(await placed());
  await set('map-link-show', false);
  await expect.poll(lines).toBe(0);
  await set('map-link-show', true);
  await expect.poll(lines).toBe(await placedLinks());
});

test('collapsing can be turned off', async () => {
  await set('map-collapsing-on', false);
  await expect.poll(() => page.evaluate(() => temp.geoMap.layers.nodes instanceof L.MarkerClusterGroup)).toBe(false);
  expect((await markers()).length).toBe(await placed());
});

test('node transparency applies', async () => {
  await set('map-node-transparency', 0.25);
  await expect.poll(async () => (await markers())[0].fillOpacity).toBeCloseTo(0.75);
  await set('map-node-transparency', 0);
});

test('jitter moves the nodes, and reroll moves them again', async () => {
  await set('map-node-jitter', 1);
  await expect.poll(async () => (await markers()).find(m => m.id == 'S0').lat).not.toBe(30);
  const first = (await markers()).find(m => m.id == 'S0');
  await pane().locator('a', { hasText: 'Nodes' }).click();
  await pane().locator('button', { hasText: 'Reroll' }).click();
  await expect.poll(async () => (await markers()).find(m => m.id == 'S0').lat).not.toBe(first.lat);
  await set('map-node-jitter', -2);
  await expect.poll(async () => (await markers()).find(m => m.id == 'S0').lat).toBe(30);
});

test('clicking a node selects it, and selections made elsewhere show', async () => {
  const color = await get('selected-color');
  await page.evaluate(() => {
    const marker = temp.geoMap.layers.nodes.getLayers().find(m => m.options.data._id == 'S0');
    marker.fire('click', { originalEvent: new MouseEvent('click') }, true);
  });
  await expect.poll(() => page.evaluate(() => session.data.nodes.filter(d => d.selected).map(d => d._id))).toEqual(['S0']);
  await expect.poll(async () => (await markers()).find(m => m.id == 'S0').color).toBe(color);
  // Selection doesn't move the nodes
  expect((await markers()).find(m => m.id == 'S0').lat).toBe(30);
  await page.evaluate(() => {
    session.data.nodes.forEach(d => d.selected = false);
    MT.events.emit('node-selected');
  });
  await expect.poll(async () => (await markers()).find(m => m.id == 'S0').color).toBe('#000000');
});

test('a node tooltip shows its tooltip variable', async () => {
  await page.evaluate(() => {
    const marker = temp.geoMap.layers.nodes.getLayers().find(m => m.options.data._id == 'S1');
    temp.geoMap.layers.nodes.fire('mouseover', { layer: marker, originalEvent: new MouseEvent('mouseover', { clientX: 100, clientY: 100 }) });
  });
  await expect(page.locator('#tooltip')).toHaveText('S1');
  await page.evaluate(() => { temp.geoMap.layers.nodes.fire('mouseout'); });
});

test('redraws when the visible links change', async () => {
  const all = await lines();
  await page.evaluate(() => (el => { el.value = 0.005; el.dispatchEvent(new Event('change', { bubbles: true })); })(document.getElementById('link-threshold')));
  await expect.poll(lines).toBeLessThan(all);
  await expect.poll(lines).toBe(await placedLinks());
  await page.evaluate(() => (el => { el.value = 0.015; el.dispatchEvent(new Event('change', { bubbles: true })); })(document.getElementById('link-threshold')));
  await expect.poll(lines).toBe(all);
});

test('state and county outlines can be shown', async () => {
  await expect.poll(() => onMap('countries')).toBe(true);
  await expect.poll(() => onMap('states')).toBe(true);
  expect(await onMap('counties')).toBe(false);
  await set('map-counties-show', true);
  await expect.poll(() => onMap('counties')).toBe(true);
  await set('map-counties-show', false);
  await expect.poll(() => onMap('counties')).toBe(false);
});

test('tile layers replace the outlines, and hiding them brings them back', async () => {
  const before = tiles;
  await set('map-basemap-show', true);
  await expect.poll(() => onMap('basemap')).toBe(true);
  expect(await onMap('countries')).toBe(false);
  expect(await onMap('states')).toBe(false);
  await expect.poll(() => tiles).toBeGreaterThan(before);
  await set('map-satellite-show', true);
  await expect.poll(() => onMap('satellite')).toBe(true);
  expect(await onMap('basemap')).toBe(false);
  await set('map-satellite-show', false);
  await expect.poll(() => onMap('countries')).toBe(true);
  expect(await onMap('states')).toBe(true);
});

test('GeoJSON files can be added as layers, and removed', async () => {
  const square = { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]]] } }] };
  await pane().locator('a', { hasText: 'Components' }).click();
  await pane().locator('button', { hasText: 'User-Provided' }).click();
  await pane().locator('.geojson-input').setInputFiles({ name: 'square.geojson', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(square)) });
  await expect(pane().locator('.geojson-layers')).toContainText('square');
  const userLayers = () => page.evaluate(() => Array.from(temp.geoMap.userLayers).filter(l => temp.geoMap.map.hasLayer(l)).length);
  expect(await userLayers()).toBe(1);
  await pane().locator('.geojson-layers a[title="Remove this file"]').click();
  await expect(pane().locator('.geojson-layers')).not.toContainText('square');
  expect(await userLayers()).toBe(0);
});

test('choosing the State field alone places nodes at their states', async () => {
  await set('map-field-lat', 'None');
  await set('map-field-lon', 'None');
  await pane().locator('a', { hasText: 'Data' }).click();
  await pane().locator('select[data-setting="map-field-state"]').selectOption('state');
  await expect.poll(async () => new Set((await markers()).map(m => m.lat + ',' + m.lon)).size).toBe(5);
  await set('map-field-state', 'None');
  await set('map-field-lat', 'lat');
  await set('map-field-lon', 'lon');
  await expect.poll(async () => (await markers()).find(m => m.id == 'S0').lat).toBe(30);
});

test('the map follows the panel size', async () => {
  const width = () => page.evaluate(() => temp.geoMap.map.getSize().x);
  const before = await width();
  await page.setViewportSize({ width: 1000, height: 900 });
  await expect.poll(width).toBeLessThan(before - 200);
  await page.setViewportSize({ width: 1400, height: 900 });
  await expect.poll(width).toBe(before);
});

test('reopening the view restores its settings', async () => {
  await closeView(page, 'geo_map');
  expect(await page.evaluate(() => temp.geoMap)).toBeUndefined();
  await launchView(page, 'geo_map');
  await expect.poll(async () => (await markers()).length).toBe(await placed());
  expect(await page.evaluate(() => temp.geoMap.layers.nodes instanceof L.MarkerClusterGroup)).toBe(false);
});

for (const [filetype, filename] of [['geojson', 'map-test.geojson'], ['png', 'map-test.png']]) {
  test(`exports ${filetype}`, async () => {
    const modal = await openExport(page, view(), 'Export Geo Map');
    await modal.getByPlaceholder('Filename').fill('map-test');
    await modal.locator('select').selectOption(filetype);
    const [download] = await Promise.all([page.waitForEvent('download'), modal.locator('button', { hasText: 'Export' }).click()]);
    expect(download.suggestedFilename()).toBe(filename);
    if (filetype == 'geojson') {
      const data = JSON.parse(require('fs').readFileSync(await download.path(), 'utf8'));
      const kinds = data.features.map(f => f.geometry.type);
      expect(kinds.filter(k => k == 'Point').length).toBe(await placed());
      expect(kinds.filter(k => k == 'LineString').length).toBe(await placedLinks());
      const s0 = data.features.find(f => f.properties._id == 'S0');
      expect(s0.geometry.coordinates).toEqual([-120, 30]);
    }
    expect(errors).toEqual([]);
  });
}
