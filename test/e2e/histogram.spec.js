// The histogram view: its settings, what they draw, and how they're saved and
// restored.
const { test, expect } = require('@playwright/test');
const { imageStats, watchErrors, loadNetwork, launchView, closeView, openExport } = require('./helpers');

test.describe.configure({ mode: 'serial' });

let page, errors;
test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  errors = watchErrors(page);
  await loadNetwork(page);
  await launchView(page, 'histogram');
});
test.afterAll(() => page.close());

const view = () => page.locator('.lm_content:has(.js-plotly-plot)').first();
const pane = () => view().locator('.left-pane');
const widget = key => page.evaluate(key => session.style.widgets[key], key);

// What Plotly drew: axis titles and types, and the trace sizes
const plot = () => view().locator('.js-plotly-plot').evaluate(el => ({
  x: el.layout.xaxis && el.layout.xaxis.title.text,
  y: el.layout.yaxis && el.layout.yaxis.title.text,
  xType: el.layout.xaxis && el.layout.xaxis.type,
  yType: el.layout.yaxis && el.layout.yaxis.type,
  traces: el.data.map(t => (t.x || t.y).length),
  horizontal: el.data.every(t => t.y && !t.x),
  width: el.layout.width
}));

test('draws link distances by default', async () => {
  await expect.poll(async () => (await plot()).x).toBe('Distance');
  const p = await plot();
  expect(p.y).toBe('Number of Links');
  // Colored by origin, as the link legend is: by the file each link came from first
  expect(p.traces).toEqual([10, 466]);
});

test('the settings pane opens and closes', async () => {
  const toggle = view().locator('.view-controls button').first();
  await toggle.click();
  await expect(pane()).toBeVisible();
  await expect.poll(() => pane().evaluate(el => getComputedStyle(el).left)).toBe('0px');
  await toggle.click();
  await expect(pane()).toBeHidden();
  await toggle.click();
  await expect(pane()).toBeVisible();
});

test('choosing a node variable redraws and is saved', async () => {
  await pane().getByLabel('Variable').selectOption('nodes-degree');
  await expect.poll(async () => (await plot()).x).toBe('Degree');
  expect((await plot()).y).toBe('Number of Nodes');
  expect((await plot()).traces).toEqual([310]);
  expect(await widget('histogram-variable')).toBe('nodes-degree');
});

test('the Y axis setting turns the histogram sideways', async () => {
  await pane().locator('label', { hasText: /^\s*Y\s*$/ }).click();
  await expect.poll(async () => (await plot()).y).toBe('Degree');
  expect((await plot()).horizontal).toBe(true);
  expect(await widget('histogram-axis-x')).toBe(false);
  await expect(pane().locator('label', { hasText: /^\s*Y\s*$/ })).toHaveClass(/active/);
});

test('the log scale applies to the count axis', async () => {
  await pane().locator('label', { hasText: 'Log' }).click();
  await expect.poll(async () => (await plot()).xType).toBe('log');
  expect(await widget('histogram-scale-log')).toBe(true);
  await expect(pane().locator('label', { hasText: 'Log' })).toHaveClass(/active/);
  await expect(pane().locator('label', { hasText: 'Linear' })).not.toHaveClass(/active/);
});

test('coloring nodes by a variable stacks the bars', async () => {
  await page.evaluate(() => (el => { el.value = 'group'; el.dispatchEvent(new Event('change', { bubbles: true })); })(document.getElementById('node-color-variable')));
  await expect.poll(async () => (await plot()).traces.length).toBeGreaterThan(1);
  expect((await plot()).traces.reduce((a, b) => a + b, 0)).toBe(310);
  await page.evaluate(() => (el => { el.value = 'None'; el.dispatchEvent(new Event('change', { bubbles: true })); })(document.getElementById('node-color-variable')));
  await expect.poll(async () => (await plot()).traces.length).toBe(1);
});

test('reopening the view restores its settings', async () => {
  await closeView(page, 'histogram');
  await launchView(page, 'histogram');
  await expect.poll(async () => (await plot()).y).toBe('Degree');
  expect((await plot()).xType).toBe('log');
  await expect(pane().getByLabel('Variable')).toHaveValue('nodes-degree');
  await expect(pane().locator('label', { hasText: /^\s*Y\s*$/ })).toHaveClass(/active/);
  await expect(pane().locator('label', { hasText: 'Log' })).toHaveClass(/active/);
  await expect(pane().locator('input[type=radio]:checked')).toHaveCount(2);
});

test('a setting changed elsewhere updates the controls and the plot', async () => {
  await page.evaluate(() => MT.settings.set('histogram-axis-x', true));
  await expect.poll(async () => (await plot()).x).toBe('Degree');
  await expect(pane().locator('label', { hasText: /^\s*X\s*$/ })).toHaveClass(/active/);
  await expect(pane().locator('label', { hasText: /^\s*Y\s*$/ })).not.toHaveClass(/active/);
});

test('redraws when the background color or the visible links change', async () => {
  await page.evaluate(() => (el => { el.value = '#000000'; el.dispatchEvent(new Event('change', { bubbles: true })); })(document.getElementById('background-color')));
  await expect.poll(() => view().locator('.js-plotly-plot').evaluate(el => el.layout.paper_bgcolor)).toBe('#000000');
  await page.evaluate(() => (el => { el.value = '#ffffff'; el.dispatchEvent(new Event('change', { bubbles: true })); })(document.getElementById('background-color')));
  await page.evaluate(() => MT.settings.set('histogram-variable', 'links-distance'));
  const total = async () => (await plot()).traces.reduce((a, b) => a + b, 0);
  await expect.poll(total).toBe(476);
  await page.evaluate(() => (el => { el.value = 0.005; el.dispatchEvent(new Event('change', { bubbles: true })); })(document.getElementById('link-threshold')));
  await expect.poll(total).toBeLessThan(476);
  await page.evaluate(() => (el => { el.value = 0.015; el.dispatchEvent(new Event('change', { bubbles: true })); })(document.getElementById('link-threshold')));
  await expect.poll(total).toBe(476);
});

test('the plot follows the panel size', async () => {
  const before = (await plot()).width;
  await page.setViewportSize({ width: 1000, height: 900 });
  await expect.poll(async () => (await plot()).width).toBeLessThan(before - 200);
  await page.setViewportSize({ width: 1400, height: 900 });
  await expect.poll(async () => (await plot()).width).toBe(before);
});

test('exports a PNG', async () => {
  const modal = await openExport(page, view(), 'Export Histogram');
  await modal.getByPlaceholder('Filename').fill('histogram-test');
  const [download] = await Promise.all([page.waitForEvent('download'), modal.locator('button', { hasText: 'Export' }).click()]);
  expect(download.suggestedFilename()).toBe('histogram-test.png');
  // The plot, with its styles: more than its background
  const stats = await imageStats(page, download);
  expect(stats.width).toBe(Math.round(await view().locator('.main-svg').first().evaluate(el => el.getBoundingClientRect().width)));
  expect(stats.colors).toBeGreaterThan(10);
  expect(errors).toEqual([]);
});

test('closing the view stops its subscriptions', async () => {
  const subscribers = () => page.evaluate(() => ['histogram-variable', 'histogram-axis-x', 'histogram-scale-log'].map(k => (MT.settings.subscribers.get(k) || new Set()).size));
  expect(await subscribers()).toEqual([2, 2, 2]);
  await closeView(page, 'histogram');
  expect(await subscribers()).toEqual([0, 0, 0]);
  expect(errors).toEqual([]);
});
