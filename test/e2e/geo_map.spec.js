// The map view, drawn with d3 on a canvas: placing nodes from coordinates and places, links,
// outlines, transparency, jitter, selection, tooltips, redraws, zooming, the United States and
// globe projections, shading regions by their counts (the choropleth), user layers, export,
// and sessions from when the globe and the choropleth were views of their own.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const { imageStats, watchErrors, loadNetwork, launchView, closeView, openExport } = require('./helpers');

test.describe.configure({ mode: 'serial' });

let page, errors;
const requests = [];
test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  await page.setViewportSize({ width: 1400, height: 900 });
  errors = watchErrors(page);
  page.on('request', r => requests.push(r.url()));
  await loadNetwork(page);
  await launchView(page, 'geo_map');
});
test.afterAll(() => page.close());

const view = () => page.locator('.lm_content:has(canvas.map-canvas)').first();
const canvas = () => view().locator('canvas.map-canvas');
const pane = () => view().locator('.left-pane');
const set = (key, value) => page.evaluate(([key, value]) => MT.settings.set(key, value), [key, value]);
const get = key => page.evaluate(key => session.style.widgets[key], key);
// What the last frame drew: each node (its id, where, and its colors) and each link
const nodes = () => page.evaluate(() => temp.geoMap ? temp.geoMap.drawn.nodes.map(n => ({ id: n.d._id, x: n.x, y: n.y, fill: n.fill, stroke: n.stroke })) : []);
const links = () => page.evaluate(() => temp.geoMap ? temp.geoMap.drawn.links.length : 0);
const frame = () => page.evaluate(() => { const { nodes, links, ...rest } = temp.geoMap.drawn; return { ...rest, nodes: nodes.length, links: links.length }; });
const node = async id => (await nodes()).find(n => n.id === id);
// The visible nodes with coordinates, and the visible links between them
const placed = () => page.evaluate(() => session.data.nodes.filter(d => d.visible && typeof d.lat === 'number').length);
const placedLinks = () => page.evaluate(() => {
  const placed = new Set(session.data.nodes.filter(d => d.visible && typeof d.lat === 'number').map(d => d._id));
  return MT.getVisibleLinks().filter(l => placed.has(l.source) && placed.has(l.target)).length;
});
// A point on the page, from one on the canvas
const onPage = async (x, y) => { const box = await canvas().boundingBox(); return [box.x + x, box.y + y]; };
const regions = () => page.evaluate(() => temp.geoMap.regions ? temp.geoMap.regions.list.map(r => ({ name: r.feature.properties.name, count: r.count })) : []);
const total = async () => (await regions()).reduce((sum, r) => sum + r.count, 0);

test('places the nodes from their latitude and longitude fields, and draws them where they are', async () => {
  await expect.poll(async () => (await nodes()).length).toBe(await placed());
  expect(await get('map-field-lat')).toBe('lat');
  expect(await get('map-field-lon')).toBe('lon');
  expect(await page.evaluate(() => temp.geoMap.positions.get('S0'))).toEqual([30, -120]);
  const s0 = await node('S0');
  const at = await page.evaluate(() => temp.geoMap.projection([-120, 30]));
  expect(s0.x).toBeCloseTo(at[0], 5);
  expect(s0.y).toBeCloseTo(at[1], 5);
  expect(await get('map-projection')).toBe('mercator');
});

test('draws the links between placed nodes, and opens fitted to the nodes, clear of the docked tables', async () => {
  await expect.poll(links).toBe(await placedLinks());
  expect(await links()).toBeGreaterThan(0);
  const box = await canvas().boundingBox();
  const dock = await view().locator('.panel-dock').boundingBox();
  for (const n of await nodes()) {
    expect(n.x).toBeGreaterThan(0);
    expect(n.y).toBeGreaterThan(30);
    expect(n.y).toBeLessThan(box.height);
    expect(box.x + n.x).toBeLessThan(dock ? dock.x : box.x + box.width);
  }
  expect((await frame()).borders).toBe(true);
  expect((await frame()).states).toBe(true);
});

test('nodes and links can be hidden and shown', async () => {
  await view().locator('.settings-toggle').click();
  await expect(pane()).toBeVisible();
  await pane().locator('a', { hasText: 'Layers' }).click();
  await pane().locator('button', { hasText: 'Network' }).click();
  const hideNodes = pane().locator('label', { has: page.locator('input[data-setting="map-node-show"][value="false"]') });
  await expect(hideNodes).toBeVisible();
  await hideNodes.click();
  await expect.poll(async () => (await nodes()).length).toBe(0);
  await set('map-node-show', true);
  await expect.poll(async () => (await nodes()).length).toBe(await placed());
  await set('map-link-show', false);
  await expect.poll(links).toBe(0);
  await set('map-link-show', true);
  await expect.poll(links).toBe(await placedLinks());
});

test('transparency applies to nodes and links', async () => {
  await set('map-node-transparency', 0.25);
  await expect.poll(async () => (await frame()).nodeAlpha).toBeCloseTo(0.75);
  await set('map-link-transparency', 0.5);
  await expect.poll(async () => (await frame()).linkAlpha).toBeCloseTo(0.5);
  await set('map-node-transparency', 0);
  await set('map-link-transparency', 0);
});

test('jitter moves the nodes, and reroll moves them again', async () => {
  const s0 = () => page.evaluate(() => temp.geoMap.at('S0'));
  await set('map-node-jitter', 1);
  await expect.poll(async () => (await s0())[0]).not.toBe(30);
  const first = await s0();
  await pane().locator('a', { hasText: 'Nodes' }).click();
  await pane().locator('button', { hasText: 'Reroll' }).click();
  await expect.poll(async () => (await s0())[0]).not.toBe(first[0]);
  await set('map-node-jitter', -2);
  await expect.poll(s0).toEqual([30, -120]);
  await view().locator('.settings-toggle').click();
  await expect(pane()).toBeHidden();
});

test('clicking a node selects it, and selections made elsewhere show', async () => {
  const color = await get('selected-color');
  const s0 = await node('S0');
  await page.mouse.click(...await onPage(s0.x, s0.y));
  await expect.poll(() => page.evaluate(() => session.data.nodes.filter(d => d.selected).map(d => d._id))).toEqual(['S0']);
  await expect.poll(async () => (await node('S0')).stroke).toBe(color);
  // Selection doesn't move the nodes
  expect((await node('S0')).x).toBeCloseTo(s0.x, 5);
  await page.evaluate(() => {
    session.data.nodes.forEach(d => d.selected = false);
    MT.events.emit('node-selected');
  });
  await expect.poll(async () => (await node('S0')).stroke).toBe('#000000');
});

test('pointing at a node shows its tooltip variable', async () => {
  const s1 = await node('S1');
  await page.mouse.move(...await onPage(s1.x, s1.y));
  await expect(page.locator('#tooltip')).toHaveText('S1');
  await page.mouse.move(...await onPage(5, 5));
});

test('redraws when the visible links change', async () => {
  const all = await links();
  await page.evaluate(() => (el => { el.value = 0.005; el.dispatchEvent(new Event('change', { bubbles: true })); })(document.getElementById('link-threshold')));
  await expect.poll(links).toBeLessThan(all);
  await expect.poll(links).toBe(await placedLinks());
  await page.evaluate(() => (el => { el.value = 0.015; el.dispatchEvent(new Event('change', { bubbles: true })); })(document.getElementById('link-threshold')));
  await expect.poll(links).toBe(all);
});

test('the outlines and gridlines can be shown and hidden', async () => {
  await set('map-counties-show', true);
  await expect.poll(async () => (await frame()).counties).toBe(true);
  await set('map-counties-show', false);
  await set('map-countries-show', false);
  await set('map-graticule-show', true);
  await expect.poll(async () => (await frame()).graticule).toBe(true);
  expect((await frame()).borders).toBe(false);
  expect((await frame()).counties).toBe(false);
  await set('map-countries-show', true);
  await set('map-graticule-show', false);
  await expect.poll(async () => (await frame()).borders).toBe(true);
});

test('the wheel, the buttons and the keyboard zoom, and dragging pans', async () => {
  const k = () => page.evaluate(() => temp.geoMap.transform.k);
  const s0 = async () => (await node('S0')).x;
  await view().locator('button[title="Zoom In"]').click();
  await expect.poll(k).toBeCloseTo(2, 3);
  await view().locator('button[title="Zoom Out"]').click();
  await expect.poll(k).toBeCloseTo(1, 3);
  const [x, y] = await onPage(600, 400);
  await page.mouse.move(x, y);
  await page.mouse.wheel(0, -300);
  await expect.poll(k).toBeGreaterThan(1);
  const before = await s0();
  await page.mouse.down();
  await page.mouse.move(x + 100, y, { steps: 5 });
  await page.mouse.up();
  await expect.poll(s0).toBeCloseTo(before + 100, 0);
  await canvas().focus();
  const zoomed = await k();
  await page.keyboard.press('-');
  await expect.poll(k).toBeCloseTo(zoomed / 2, 3);
  await page.keyboard.press('ArrowLeft');
  await expect.poll(s0).toBeGreaterThan(before + 100 - 1);
  // Fit puts it back as it opened
  await view().locator('button[title="Fit to the Nodes"]').click();
  await expect.poll(k).toBe(1);
});

test('choosing the State field alone places nodes at their states', async () => {
  await set('map-field-lat', 'None');
  await set('map-field-lon', 'None');
  await expect.poll(async () => new Set((await nodes()).map(n => Math.round(n.x) + ',' + Math.round(n.y))).size).toBe(5);
  await set('map-field-lat', 'lat');
  await set('map-field-lon', 'lon');
  await expect.poll(() => page.evaluate(() => temp.geoMap.positions.get('S0'))).toEqual([30, -120]);
});

test('shades each state by its count of nodes, from the State field, under a legend', async () => {
  expect(await view().locator('.map-legend').isHidden()).toBe(true);
  await set('map-shade', 'states');
  await expect.poll(total).toBe(300);
  expect((await regions()).find(r => r.name === 'Georgia').count).toBe(60);
  const legend = view().locator('.map-legend');
  await expect(legend.locator('.legend-title')).toHaveText('Nodes by State');
  expect(await legend.locator('.legend-ends span').allTextContents()).toEqual(['0', '60']);
  expect((await frame()).regions).toBeGreaterThan(50);
  // Pointing at a state with no nodes names it and its count
  const kansas = await page.evaluate(() => temp.geoMap.projection([-98.5, 38.5]));
  await page.mouse.move(...await onPage(...kansas));
  await expect(page.locator('#tooltip')).toHaveText(/Kansas/);
  await page.mouse.move(...await onPage(5, 5));
});

test('shading follows the colors, and the nodes shown', async () => {
  const georgia = () => page.evaluate(() => {
    const ramp = d3.scaleLinear().domain([0, 0.5, 1]).range(['low', 'medium', 'high'].map(l => MT.settings.get('map-shade-color-' + l)));
    const r = temp.geoMap.regions;
    return d3.rgb(ramp((r.list.find(x => x.feature.properties.name === 'Georgia').count - r.min) / (r.max - r.min))).formatHex();
  });
  expect(await georgia()).toBe('#800026');
  await set('map-shade-color-high', '#0000ff');
  await expect.poll(georgia).toBe('#0000ff');
  await page.evaluate(() => {
    session.data.nodes.forEach(d => { if (d.state === 'Georgia') d.visible = false; });
    MT.events.emit('node-visibility');
  });
  await expect.poll(total).toBe(240);
  await page.evaluate(() => {
    session.data.nodes.forEach(d => { d.visible = true; });
    MT.events.emit('node-visibility');
  });
  await expect.poll(total).toBe(300);
});

test('shades countries, and turns shading off', async () => {
  await set('map-field-country', 'None');
  await set('map-shade', 'countries');
  await expect.poll(async () => (await regions()).length).toBeGreaterThan(100);
  await expect(view().locator('.map-legend .legend-title')).toHaveText('Choose the Country field (Data)');
  await set('map-shade', 'none');
  await expect(view().locator('.map-legend')).toBeHidden();
  await expect.poll(async () => (await frame()).regions).toBe(0);
});

test('the United States projection insets Alaska and Hawaii', async () => {
  await set('map-projection', 'albers-usa');
  await expect.poll(async () => (await frame()).nodes).toBe(await placed());
  const [anchorage, honolulu, kansas] = await page.evaluate(() => [[-149.9, 61.2], [-157.9, 21.3], [-98.5, 38.5]].map(p => temp.geoMap.projection(p)));
  const box = await canvas().boundingBox();
  // Both in view, below and left of the middle of the country
  for (const p of [anchorage, honolulu]) {
    expect(p).not.toBeNull();
    expect(p[0]).toBeGreaterThan(0);
    expect(p[0]).toBeLessThan(kansas[0]);
    expect(p[1]).toBeGreaterThan(kansas[1]);
    expect(p[1]).toBeLessThan(box.height);
  }
  // Places outside the United States are not drawn
  expect(await page.evaluate(() => temp.geoMap.projection([2.35, 48.85]))).toBeNull();
});

test('the globe faces its nodes, turns when dragged, and autorotates', async () => {
  await expect(view().locator('button[title="Toggle Autorotation"]')).toBeHidden();
  await set('map-projection', 'globe');
  await expect(view().locator('button[title="Toggle Autorotation"]')).toBeVisible();
  await expect.poll(async () => (await frame()).globe).toBe(true);
  // These nodes are in the US
  const [lon, lat] = await page.evaluate(() => temp.geoMap.projection.rotate());
  expect(-lon).toBeGreaterThan(-130);
  expect(-lon).toBeLessThan(-65);
  expect(-lat).toBeGreaterThan(20);
  expect(-lat).toBeLessThan(50);
  await expect.poll(async () => (await frame()).nodes).toBe(await placed());
  expect((await frame()).links).toBeGreaterThan(0);
  // No country is wound the wrong way, to cover the rest of the sphere
  expect(await page.evaluate(() => temp.geoMap.maps.countries.features.filter(f => d3.geoArea(f) > 2 * Math.PI).length)).toBe(0);
  const rotation = () => page.evaluate(() => temp.geoMap.projection.rotate()[0]);
  const before = await rotation();
  const [x, y] = await onPage(600, 450);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - 100, y, { steps: 5 });
  await page.mouse.up();
  await expect.poll(rotation).toBeLessThan(before);
  const dragged = await rotation();
  const toggle = view().locator('button[title="Toggle Autorotation"]');
  await toggle.click();
  await expect(toggle.locator('.bi-pause-fill')).toBeVisible();
  await expect.poll(rotation).not.toBe(dragged);
  await toggle.click();
  await expect(toggle.locator('.bi-play-fill')).toBeVisible();
  const stopped = await rotation();
  // Waits to see the rotation stay stopped
  await page.waitForTimeout(300);
  expect(await rotation()).toBe(stopped);
  // Nodes on the far side aren't drawn
  await page.evaluate(() => { temp.geoMap.projection.rotate([-80, 0, 0]); temp.geoMap.redraw(); });
  await expect.poll(async () => (await frame()).nodes).toBe(0);
  await view().locator('button[title="Fit to the Nodes"]').click();
  await expect.poll(async () => (await frame()).nodes).toBe(await placed());
});

test('GeoJSON files can be added as layers, and removed', async () => {
  const square = { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[[-100, 35], [-99, 35], [-99, 36], [-100, 36], [-100, 35]]] } }] };
  await view().locator('.settings-toggle').click();
  await pane().locator('a', { hasText: 'Layers' }).click();
  await pane().locator('button', { hasText: 'User-Provided' }).click();
  await pane().locator('.geojson-input').setInputFiles({ name: 'square.geojson', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(square)) });
  await expect(pane().locator('.geojson-layers')).toContainText('square');
  await expect.poll(async () => (await frame()).layers).toBe(1);
  await pane().locator('.geojson-layers a[title="Remove this file"]').click();
  await expect(pane().locator('.geojson-layers')).not.toContainText('square');
  await expect.poll(async () => (await frame()).layers).toBe(0);
  // A file that isn't GeoJSON says so
  await pane().locator('.geojson-input').setInputFiles({ name: 'broken.geojson', mimeType: 'application/json', buffer: Buffer.from('{ nope') });
  await expect(page.locator('.toast', { hasText: 'could not be read as GeoJSON' })).toBeVisible();
  await view().locator('.settings-toggle').click();
});

test('the map follows the panel size', async () => {
  const width = () => canvas().evaluate(c => c.clientWidth);
  const before = await width();
  await page.setViewportSize({ width: 1000, height: 900 });
  await expect.poll(width).toBeLessThan(before - 200);
  await expect.poll(() => canvas().evaluate(c => c.width)).toBe(await width() * await page.evaluate(() => devicePixelRatio));
  await page.setViewportSize({ width: 1400, height: 900 });
  await expect.poll(width).toBe(before);
});

test('reopening the view restores its settings', async () => {
  await set('map-shade', 'states');
  await closeView(page, 'geo_map');
  expect(await page.evaluate(() => temp.geoMap)).toBeUndefined();
  await launchView(page, 'geo_map');
  await expect.poll(async () => (await frame()).nodes).toBe(await placed());
  expect((await frame()).globe).toBe(true);
  await expect.poll(total).toBe(300);
  await expect(view().locator('select[data-setting="map-projection"]')).toHaveValue('globe');
});

for (const [filetype, filename] of [['geojson', 'map-test.geojson'], ['png', 'map-test.png']]) {
  test(`exports ${filetype}`, async () => {
    const modal = await openExport(page, view(), 'Export Map');
    await modal.getByPlaceholder('Filename').fill('map-test');
    await modal.locator('select').selectOption(filetype);
    const [download] = await Promise.all([page.waitForEvent('download'), modal.locator('button', { hasText: 'Export' }).click()]);
    expect(download.suggestedFilename()).toBe(filename);
    if (filetype === 'geojson') {
      const data = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
      const kinds = data.features.map(f => f.geometry.type);
      expect(kinds.filter(k => k === 'Point').length).toBe(await placed());
      expect(kinds.filter(k => k === 'LineString').length).toBe(await placedLinks());
      expect(data.features.find(f => f.properties._id === 'S0').geometry.coordinates).toEqual([-120, 30]);
      // The shaded states, with their counts
      expect(data.features.filter(f => f.properties.nodes !== undefined).reduce((sum, f) => sum + f.properties.nodes, 0)).toBe(300);
    } else {
      // The map at its size, with the sea, the land, the shading, the nodes and the legend
      const stats = await imageStats(page, download);
      const box = await canvas().boundingBox();
      expect([stats.width, stats.height]).toEqual([Math.round(box.width), Math.round(box.height)]);
      expect(stats.colors).toBeGreaterThan(10);
    }
  });
}

test('a session that had a globe and a choropleth opens the map as a shaded globe', async () => {
  await set('map-projection', 'mercator');
  await set('map-shade', 'none');
  await closeView(page, 'geo_map');
  await page.evaluate(() => {
    const old = JSON.parse(JSON.stringify(session));
    const w = old.style.widgets;
    ['map-projection', 'map-shade', 'map-shade-color-high'].forEach(k => delete w[k]);
    Object.assign(w, { 'globe-field-lat': 'lat', 'globe-field-lon': 'lon', 'globe-node-transparency': 0.4, 'globe-stars-show': true,
      'choropleth-aggregate-as': 'states', 'choropleth-aggregate-on': 'state', 'choropleth-color-high': '#00ff00', 'map-basemap-show': true });
    old.layout = { type: 'row', content: [{ type: 'network' }, { type: 'stack', content: [{ type: 'globe' }, { type: 'choropleth' }] }] };
    MT.applySession(old);
  });
  await expect.poll(() => page.evaluate(() => layout.contentItems.map(i => i.componentType).sort())).toEqual(['geo_map', 'network']);
  await expect.poll(async () => (await frame()).nodes).toBe(await placed());
  expect(await get('map-projection')).toBe('globe');
  expect(await get('map-shade')).toBe('states');
  expect(await get('map-shade-color-high')).toBe('#00ff00');
  expect(await get('map-node-transparency')).toBeCloseTo(0.4);
  expect(await page.evaluate(() => Object.keys(session.style.widgets).filter(k => /^(globe|choropleth)-|^map-basemap/.test(k)))).toEqual([]);
  await expect.poll(total).toBe(300);
});

test('asks nothing of any other server, and nothing threw', () => {
  const origin = new URL(page.url()).origin;
  expect(requests.filter(url => !url.startsWith(origin) && !url.startsWith('data:') && !url.startsWith('blob:'))).toEqual([]);
  expect(errors).toEqual([]);
});
