// The choropleth view: aggregating the nodes over states and countries, its
// colors and transparency, the tile layers, redraws, fitting and export.
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
  await launchView(page, 'choropleth');
});
test.afterAll(() => page.close());

const view = () => page.locator('.lm_content:has(.leaflet-container)').first();
const pane = () => view().locator('.left-pane');
const set = (key, value) => page.evaluate(([key, value]) => MT.settings.set(key, value), [key, value]);
// The aggregate layer: each region's name, count and fill
const regions = () => page.evaluate(() => temp.choropleth.layers.aggregates.getLayers().map(l => ({
  name: l.feature.properties.name, density: l.feature.properties.density,
  fill: d3.rgb(l.options.fillColor).formatHex(), opacity: l.options.fillOpacity
})));
const total = async () => (await regions()).reduce((s, r) => s + r.density, 0);
const onMap = layer => page.evaluate(layer => {
  const { map, layers } = temp.choropleth;
  return !!layers[layer] && map.hasLayer(layers[layer]);
}, layer);

test('counts the nodes in each state, from their state field', async () => {
  await expect.poll(total).toBe(300);
  const georgia = (await regions()).find(r => r.name == 'Georgia');
  expect(georgia.density).toBe(60);
  expect(await page.evaluate(() => session.style.widgets['choropleth-aggregate-on'])).toBe('state');
  await expect.poll(() => onMap('countries')).toBe(true);
});

test('the busiest regions get the high color, the empty ones the low', async () => {
  const r = await regions();
  expect(r.find(r => r.name == 'Georgia').fill).toBe('#800026');
  expect(r.find(r => r.name == 'Alaska').fill).toBe('#ffffcc');
  await view().locator('.settings-toggle').click();
  await expect(pane()).toBeVisible();
  await set('choropleth-color-high', '#0000ff');
  await expect.poll(async () => (await regions()).find(r => r.name == 'Georgia').fill).toBe('#0000ff');
});

test('transparency applies to the regions and the legend', async () => {
  await set('choropleth-transparency', 0.6);
  await expect.poll(async () => (await regions())[0].opacity).toBeCloseTo(0.4);
  await expect(view().locator('.legend canvas')).toHaveCSS('opacity', '0.4');
});

test('aggregates over countries', async () => {
  await pane().locator('select[data-setting="choropleth-aggregate-as"]').selectOption('countries');
  await expect.poll(async () => (await regions()).length).toBeGreaterThan(100);
  await pane().locator('select[data-setting="choropleth-aggregate-as"]').selectOption('states');
  await expect.poll(total).toBe(300);
});

test('redraws when nodes are hidden', async () => {
  await page.evaluate(() => {
    session.data.nodes.forEach(d => { if (d.state == 'Georgia') d.visible = false; });
    MT.events.emit('node-visibility');
  });
  await expect.poll(total).toBe(240);
  await page.evaluate(() => {
    session.data.nodes.forEach(d => { d.visible = true; });
    MT.events.emit('node-visibility');
  });
  await expect.poll(total).toBe(300);
});

test('the basemap and satellite layers take turns, over the countries', async () => {
  const before = tiles;
  await pane().locator('a', { hasText: 'Layers' }).click();
  await pane().locator('label', { has: page.locator('input[data-setting="choropleth-basemap-show"][value="true"]') }).click();
  await expect.poll(() => onMap('basemap')).toBe(true);
  expect(await onMap('countries')).toBe(false);
  await expect.poll(() => tiles).toBeGreaterThan(before);
  await set('choropleth-satellite-show', true);
  await expect.poll(() => onMap('satellite')).toBe(true);
  expect(await onMap('basemap')).toBe(false);
  expect(await page.evaluate(() => session.style.widgets['choropleth-basemap-show'])).toBe(false);
  await set('choropleth-satellite-show', false);
  await expect.poll(() => onMap('countries')).toBe(true);
  expect(await onMap('satellite')).toBe(false);
});

test('fitting shows every region with nodes', async () => {
  await page.evaluate(() => { temp.choropleth.map.setView([0, 0], 3, { animate: false }); });
  await view().locator('button[title="Fit to the Regions"]').click();
  await expect.poll(() => page.evaluate(() => {
    const { map, layers } = temp.choropleth;
    const counted = L.featureGroup(layers.aggregates.getLayers().filter(l => l.feature.properties.density > 0));
    return map.getBounds().contains(counted.getBounds()) && map.getZoom() > 3;
  })).toBe(true);
});

test('the map follows the panel size', async () => {
  const width = () => page.evaluate(() => temp.choropleth.map.getSize().x);
  const before = await width();
  await page.setViewportSize({ width: 1000, height: 900 });
  await expect.poll(width).toBeLessThan(before - 200);
  await page.setViewportSize({ width: 1400, height: 900 });
  await expect.poll(width).toBe(before);
});

test('reopening the view restores its settings', async () => {
  await closeView(page, 'choropleth');
  expect(await page.evaluate(() => temp.choropleth)).toBeUndefined();
  await launchView(page, 'choropleth');
  await expect.poll(total).toBe(300);
  expect((await regions()).find(r => r.name == 'Georgia').fill).toBe('#0000ff');
  await expect(view().locator('input[data-setting="choropleth-transparency"]')).toHaveValue('0.6');
});

for (const [filetype, filename] of [['geojson', 'choropleth-test.geojson'], ['png', 'choropleth-test.png']]) {
  test(`exports ${filetype}`, async () => {
    const modal = await openExport(page, view(), 'Export Choropleth');
    await modal.getByPlaceholder('Filename').fill('choropleth-test');
    await modal.locator('select').selectOption(filetype);
    const [download] = await Promise.all([page.waitForEvent('download'), modal.locator('button', { hasText: 'Export' }).click()]);
    expect(download.suggestedFilename()).toBe(filename);
    if (filetype == 'geojson') {
      const data = JSON.parse(require('fs').readFileSync(await download.path(), 'utf8'));
      expect(data.features.reduce((s, f) => s + f.properties.density, 0)).toBe(300);
    }
    expect(errors).toEqual([]);
  });
}
