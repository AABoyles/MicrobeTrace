// The heatmap view: its settings, what they draw, restoring them, and export.
const { test, expect } = require('@playwright/test');
const { watchErrors, loadNetwork, launchView, closeView, openExport } = require('./helpers');

test.describe.configure({ mode: 'serial' });

let page, errors;
test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  errors = watchErrors(page);
  await loadNetwork(page);
  await launchView(page, 'heatmap');
});
test.afterAll(() => page.close());

const view = () => page.locator('.lm_content:has(.js-plotly-plot)').first();
const pane = () => view().locator('.left-pane');
const widget = key => page.evaluate(key => session.style.widgets[key], key);
const labels = () => page.evaluate(() => session.data.nodes.map(d => 'N' + d._id));

const plot = () => view().locator('.js-plotly-plot').evaluate(el => ({
  rows: el.data[0].z.length,
  columns: el.data[0].z[0].length,
  x0: el.data[0].x[0],
  y0: el.data[0].y[0],
  colors: el.data[0].colorscale.map(c => c[1]),
  tickLabels: el.layout.xaxis.showticklabels,
  width: el.layout.width,
  background: getComputedStyle(el.querySelector('.main-svg')).backgroundColor
}));

test('draws the distance matrix', async () => {
  await expect.poll(async () => (await plot()).rows).toBe(310);
  const p = await plot(), names = await labels();
  expect(p.columns).toBe(310);
  expect([p.x0, p.y0]).toEqual([names[0], names[0]]);
  expect(p.colors).toEqual(['#313695', '#ffffbf', '#a50026']);
  expect(p.tickLabels).toBe(false);
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

test('inverting an axis reverses it', async () => {
  const names = await labels();
  await pane().locator('label', { hasText: 'X-Axis' }).click();
  await expect.poll(async () => (await plot()).x0).toBe(names[names.length - 1]);
  expect((await plot()).y0).toBe(names[0]);
  expect(await widget('heatmap-invertX')).toBe(true);
  await expect(pane().locator('label', { hasText: 'X-Axis' })).toHaveClass(/active/);
  await pane().locator('label', { hasText: 'Y-Axis' }).click();
  await expect.poll(async () => (await plot()).y0).toBe(names[names.length - 1]);
  await pane().locator('label', { hasText: 'Y-Axis' }).click();
  await expect.poll(async () => (await plot()).y0).toBe(names[0]);
  expect(await widget('heatmap-invertY')).toBe(false);
});

test('axis labels can be shown', async () => {
  await pane().locator('label', { hasText: 'Show' }).click();
  await expect.poll(async () => (await plot()).tickLabels).toBe(true);
  expect(await widget('heatmap-axislabels-show')).toBe(true);
});

test('the color scheme applies', async () => {
  await pane().locator('input[type=color]').first().evaluate(el => {
    el.value = '#00ff00';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await expect.poll(async () => (await plot()).colors[2]).toBe('#00ff00');
  expect(await widget('heatmap-color-high')).toBe('#00ff00');
});

test('the background color applies', async () => {
  await page.evaluate(() => (el => { el.value = '#000000'; el.dispatchEvent(new Event('change', { bubbles: true })); })(document.getElementById('background-color')));
  await expect.poll(async () => (await plot()).background).toBe('rgb(0, 0, 0)');
  await page.evaluate(() => (el => { el.value = '#ffffff'; el.dispatchEvent(new Event('change', { bubbles: true })); })(document.getElementById('background-color')));
});

test('reopening the view restores its settings', async () => {
  const names = await labels();
  await closeView(page, 'heatmap');
  await launchView(page, 'heatmap');
  await expect.poll(async () => (await plot()).x0).toBe(names[names.length - 1]);
  const p = await plot();
  expect(p.tickLabels).toBe(true);
  expect(p.colors[2]).toBe('#00ff00');
  await expect(pane().locator('label', { hasText: 'X-Axis' })).toHaveClass(/active/);
  await expect(pane().locator('label', { hasText: 'Y-Axis' })).not.toHaveClass(/active/);
  await expect(pane().locator('label', { hasText: 'Show' })).toHaveClass(/active/);
  await expect(pane().locator('input[type=color]').first()).toHaveValue('#00ff00');
});

test('the plot follows the panel size', async () => {
  const before = (await plot()).width;
  await page.setViewportSize({ width: 1000, height: 900 });
  await expect.poll(async () => (await plot()).width).toBeLessThan(before - 200);
  await page.setViewportSize({ width: 1400, height: 900 });
  await expect.poll(async () => (await plot()).width).toBe(before);
});

for (const filetype of ['png', 'csv']) {
  test(`exports ${filetype.toUpperCase()}`, async () => {
    const modal = await openExport(page, view(), 'Export Heatmap');
    await modal.getByPlaceholder('Filename').fill('heatmap-test');
    await modal.locator('select').selectOption(filetype);
    const [download] = await Promise.all([page.waitForEvent('download'), modal.locator('button', { hasText: 'Export' }).click()]);
    expect(download.suggestedFilename()).toBe('heatmap-test.' + filetype);
    await expect(modal).toBeHidden();
    expect(errors).toEqual([]);
  });
}
