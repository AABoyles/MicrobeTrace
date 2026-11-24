// The scatterplot view: its settings, what they draw, restoring them, and export.
const { test, expect } = require('@playwright/test');
const { watchErrors, loadNetwork, launchView, closeView, openExport } = require('./helpers');

test.describe.configure({ mode: 'serial' });

let page, errors;
test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  errors = watchErrors(page);
  await loadNetwork(page);
  await launchView(page, 'scatterplot');
});
test.afterAll(() => page.close());

const view = () => page.locator('.lm_content:has(.js-plotly-plot)').first();
const pane = () => view().locator('.left-pane');
const widget = key => page.evaluate(key => session.style.widgets[key], key);
const options = label => pane().getByLabel(label).evaluate(el => Array.from(el.options).map(o => o.value));

const plot = () => view().locator('.js-plotly-plot').evaluate(el => ({
  x: el.layout.xaxis.title.text,
  y: el.layout.yaxis.title.text,
  yType: el.layout.yaxis.type,
  points: el.data[0].x.length,
  color: el.data[0].marker.color,
  width: el.layout.width
}));

test('plots link variables by default: distance by cluster, with one measurement', async () => {
  await expect.poll(async () => (await plot()).points).toBe(299);
  const p = await plot();
  expect([p.x, p.y]).toEqual(['Cluster', 'TN93']);
  expect(await options('X Variable')).toContain('distance');
});

test('the settings pane opens and closes', async () => {
  const toggle = view().locator('.view-controls button').first();
  await toggle.click();
  await expect.poll(() => pane().evaluate(el => getComputedStyle(el).left)).toBe('0px');
  await toggle.click();
  await expect(pane()).toBeHidden();
  await toggle.click();
  await expect(pane()).toBeVisible();
});

test('choosing variables redraws and is saved', async () => {
  await pane().getByLabel('X Variable').selectOption('distance');
  await expect.poll(async () => (await plot()).x).toBe('Distance');
  expect(await widget('scatterplot-xVar')).toBe('distance');
  await pane().getByLabel('Y Variable').selectOption('index');
  await expect.poll(async () => (await plot()).y).toBe('Index');
  expect(await widget('scatterplot-yVar')).toBe('index');
});

test('the log scale applies to the Y axis', async () => {
  await pane().locator('label', { hasText: 'Log' }).click();
  await expect.poll(async () => (await plot()).yType).toBe('log');
  expect(await widget('scatterplot-logScale')).toBe(true);
  await pane().locator('label', { hasText: 'Linear' }).click();
  await expect.poll(async () => (await plot()).yType).not.toBe('log');
});

test('switching to nodes offers node variables and plots nodes', async () => {
  await pane().locator('label', { hasText: 'Nodes' }).click();
  expect(await widget('scatterplot-showNodes')).toBe(true);
  await expect.poll(() => options('X Variable')).toContain('degree');
  await pane().getByLabel('X Variable').selectOption('degree');
  await pane().getByLabel('Y Variable').selectOption('cluster');
  await expect.poll(async () => (await plot()).points).toBe(310);
  expect([(await plot()).x, (await plot()).y]).toEqual(['Degree', 'Cluster']);
});

test('reopening the view restores its settings', async () => {
  await closeView(page, 'scatterplot');
  await launchView(page, 'scatterplot');
  await expect.poll(async () => (await plot()).points).toBe(310);
  expect([(await plot()).x, (await plot()).y]).toEqual(['Degree', 'Cluster']);
  await expect(pane().locator('label', { hasText: 'Nodes' }).locator('input')).toBeChecked();
  await expect(pane().getByLabel('X Variable')).toHaveValue('degree');
  await expect(pane().getByLabel('Y Variable')).toHaveValue('cluster');
});

test('switching back to links offers link variables', async () => {
  await page.evaluate(() => MT.settings.set('scatterplot-showNodes', false));
  await expect.poll(() => options('X Variable')).toContain('distance');
  await expect(pane().locator('label', { hasText: 'Links' }).locator('input')).toBeChecked();
  await page.evaluate(() => { MT.settings.set('scatterplot-xVar', 'index'); MT.settings.set('scatterplot-yVar', 'distance'); });
  await expect(pane().getByLabel('Y Variable')).toHaveValue('distance');
  await expect.poll(async () => (await plot()).points).toBe(299);
});

test('the plot follows the panel size', async () => {
  const before = (await plot()).width;
  await page.setViewportSize({ width: 1000, height: 900 });
  await expect.poll(async () => (await plot()).width).toBeLessThan(before - 200);
  await page.setViewportSize({ width: 1400, height: 900 });
  await expect.poll(async () => (await plot()).width).toBe(before);
});

test('exports a PNG', async () => {
  const modal = await openExport(page, view(), 'Export Scatterplot');
  await modal.getByPlaceholder('Filename').fill('scatter-test');
  const [download] = await Promise.all([page.waitForEvent('download'), modal.locator('button', { hasText: 'Export' }).click()]);
  expect(download.suggestedFilename()).toBe('scatter-test.png');
  expect(errors).toEqual([]);
});

test('more than 2,000 points are drawn on a canvas, and still export under the CSP (#252)', async () => {
  const fs = require('fs');
  const setThreshold = value => page.evaluate(value => (el => { el.value = value; el.dispatchEvent(new Event('change', { bubbles: true })); })(document.getElementById('link-threshold')), value);
  // (Nearly every pair of the 300 sequences is within 1)
  await setThreshold(1);
  await expect.poll(async () => (await plot()).points).toBeGreaterThan(40000);
  expect(await view().locator('.js-plotly-plot').evaluate(el => el.data[0].type)).toBe('scattergl');
  for (const [filetype, check] of [
    ['png', bytes => bytes.subarray(1, 4).toString() === 'PNG'],
    ['svg', bytes => /<svg[\s\S]*<image[^>]*href="data:image\/png/.test(bytes.toString())]
  ]) {
    const modal = await openExport(page, view(), 'Export Scatterplot');
    await modal.getByPlaceholder('Filename').fill('scatter-gl');
    await modal.locator('[name="export-filetype"]').selectOption(filetype);
    const [download] = await Promise.all([page.waitForEvent('download'), modal.locator('button', { hasText: 'Export' }).click()]);
    expect(download.suggestedFilename()).toBe('scatter-gl.' + filetype);
    const bytes = fs.readFileSync(await download.path());
    expect(bytes.length).toBeGreaterThan(10000);
    expect(check(bytes)).toBe(true);
  }
  // (A blob: image the Content Security Policy refused would be logged as an error)
  expect(errors).toEqual([]);
  await setThreshold(0.015);
  await expect.poll(async () => (await plot()).points).toBe(299);
});
