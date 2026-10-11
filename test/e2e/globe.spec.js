// The globe view: placing nodes, links, the layers, transparency, jitter,
// rotating, redraws, restoring and export.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const { watchErrors, loadNetwork, launchView, closeView, openExport } = require('./helpers');

test.describe.configure({ mode: 'serial' });

let page, errors;
test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  errors = watchErrors(page);
  await loadNetwork(page);
  await launchView(page, 'globe');
});
test.afterAll(() => page.close());

const view = () => page.locator('.lm_content:has(button[title="Export Globe"])').first();
const pane = () => view().locator('.left-pane');
const set = (key, value) => page.evaluate(([key, value]) => MT.settings.set(key, value), [key, value]);
// What the last frame drew
const drawn = () => page.evaluate(() => temp.globe && temp.globe.drawn);
const placed = () => page.evaluate(() => session.data.nodes.filter(d => d.visible && typeof d.lat == 'number').length);

test('places the nodes from their latitude and longitude fields', async () => {
  await expect.poll(async () => (await drawn() || {}).nodes).toBe(await placed());
  expect(await page.evaluate(() => session.style.widgets['globe-field-lat'])).toBe('lat');
  expect(await page.evaluate(() => temp.globe.positions.get('S0'))).toEqual([30, -120]);
  expect((await drawn()).stars).toBe(true);
});

test('opens facing its nodes, with land and sea told apart', async () => {
  // These nodes are in the US
  const [lon, lat] = await page.evaluate(() => temp.globe.projection.rotate());
  expect(-lon).toBeGreaterThan(-130);
  expect(-lon).toBeLessThan(-65);
  expect(-lat).toBeGreaterThan(20);
  expect(-lat).toBeLessThan(50);
  // A country wound the wrong way would cover the rest of the sphere
  expect(await page.evaluate(() => temp.globe.countries.features.filter(f => d3.geoArea(f) > 2 * Math.PI).length)).toBe(0);
});

test('draws the links facing the viewer', async () => {
  // Turn the globe to face the nodes
  await page.evaluate(() => { temp.globe.projection.rotate([105, -35, 0]); temp.globe.redraw(); });
  await expect.poll(async () => (await drawn()).links).toBeGreaterThan(0);
});

test('the layers can be shown and hidden', async () => {
  await view().locator('button[title="Globe Settings"]').click();
  await expect(pane()).toBeVisible();
  await pane().locator('a', { hasText: 'Layers' }).click();
  await pane().locator('label', { has: page.locator('input[data-setting="globe-stars-show"][value="false"]') }).click();
  await expect.poll(async () => (await drawn()).stars).toBe(false);
  await set('globe-graticule-show', true);
  await expect.poll(async () => (await drawn()).graticule).toBe(true);
  await set('globe-countries-show', true);
  await expect.poll(async () => (await drawn()).borders).toBe(true);
  await set('globe-node-show', false);
  await expect.poll(async () => (await drawn()).nodes).toBe(0);
  await set('globe-link-show', false);
  await expect.poll(async () => (await drawn()).links).toBe(0);
  await set('globe-node-show', true);
  await set('globe-link-show', true);
  await expect.poll(async () => (await drawn()).nodes).toBe(await placed());
});

test('transparency applies', async () => {
  await set('globe-node-transparency', 0.25);
  await expect.poll(async () => (await drawn()).nodeAlpha).toBeCloseTo(0.75);
  await set('globe-link-transparency', 0.5);
  await expect.poll(async () => (await drawn()).linkAlpha).toBeCloseTo(0.5);
});

test('jitter moves the nodes', async () => {
  const s0 = () => page.evaluate(() => temp.globe.at('S0'));
  await set('globe-node-jitter', 1);
  await expect.poll(async () => (await s0())[0]).not.toBe(30);
  await set('globe-node-jitter', -2);
  await expect.poll(s0).toEqual([30, -120]);
});

test('redraws when nodes are hidden', async () => {
  await page.evaluate(() => {
    session.data.nodes.forEach((d, i) => { if (i < 50) d.visible = false; });
    MT.events.emit('node-visibility');
  });
  await expect.poll(async () => (await drawn()).nodes).toBe(await placed());
  await page.evaluate(() => {
    session.data.nodes.forEach(d => { d.visible = true; });
    MT.events.emit('node-visibility');
  });
  await expect.poll(async () => (await drawn()).nodes).toBe(await placed());
});

test('dragging turns the globe, and autorotation spins it', async () => {
  const rotation = () => page.evaluate(() => temp.globe.projection.rotate()[0]);
  const before = await rotation();
  // A point on the canvas that nothing floats over (the color tables can)
  const [x, y] = await view().locator('canvas').evaluate(canvas => {
    const box = canvas.getBoundingClientRect();
    for (let fy = 0.5; fy < 0.95; fy += 0.1) for (let fx = 0.5; fx < 0.9; fx += 0.1) {
      const x = box.x + box.width * fx, y = box.y + box.height * fy;
      if (document.elementFromPoint(x, y) === canvas && document.elementFromPoint(x - 100, y) === canvas) return [x, y];
    }
  });
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - 100, y, { steps: 5 });
  await page.mouse.up();
  await expect.poll(rotation).not.toBe(before);
  const dragged = await rotation();
  await view().locator('button[title="Toggle Autorotation"]').click();
  await expect.poll(rotation).not.toBe(dragged);
  await view().locator('button[title="Toggle Autorotation"]').click();
  const stopped = await rotation();
  await page.waitForTimeout(300);
  expect(await rotation()).toBe(stopped);
});

test('the globe follows the panel size', async () => {
  const width = () => view().locator('canvas').evaluate(c => c.width);
  const before = await width();
  await page.setViewportSize({ width: 1000, height: 900 });
  await expect.poll(width).toBeLessThan(before - 200);
  await page.setViewportSize({ width: 1400, height: 900 });
  await expect.poll(width).toBe(before);
});

test('reopening the view restores its settings', async () => {
  await closeView(page, 'globe');
  expect(await page.evaluate(() => temp.globe)).toBeUndefined();
  await launchView(page, 'globe');
  await expect.poll(async () => (await drawn() || {}).nodes).toBe(await placed());
  expect((await drawn()).stars).toBe(false);
  expect((await drawn()).nodeAlpha).toBeCloseTo(0.75);
});

for (const [filetype, filename] of [['geojson', 'globe-test.geojson'], ['png', 'globe-test.png']]) {
  test(`exports ${filetype}`, async () => {
    const modal = await openExport(page, view(), 'Export Globe');
    await modal.getByPlaceholder('Filename').fill('globe-test');
    await modal.locator('select').selectOption(filetype);
    const [download] = await Promise.all([page.waitForEvent('download'), modal.locator('button', { hasText: 'Export' }).click()]);
    expect(download.suggestedFilename()).toBe(filename);
    if (filetype == 'geojson') {
      const data = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
      expect(data.features.filter(f => f.geometry.type == 'Point').length).toBe(await placed());
      expect(data.features.find(f => f.properties._id == 'S0').geometry.coordinates).toEqual([-120, 30]);
    }
    expect(errors).toEqual([]);
  });
}
