// The flow diagram view: its variables, datasets, redraws and export.
const { test, expect } = require('@playwright/test');
const { watchErrors, loadNetwork, launchView, closeView, openExport } = require('./helpers');

test.describe.configure({ mode: 'serial' });

let page, errors;
test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  errors = watchErrors(page);
  await loadNetwork(page);
  await launchView(page, 'flow_diagram');
});
test.afterAll(() => page.close());

const view = () => page.locator('.lm_content:has(.js-plotly-plot)').first();
const pane = () => view().locator('.left-pane');
const selectors = () => pane().locator('li select');

// The sankey: node labels, the variable of each node, and the total flow
const plot = () => view().locator('.js-plotly-plot').evaluate(el => ({
  labels: el.data[0].node.label,
  variables: Array.from(new Set(el.data[0].node.customdata)),
  flow: el.data[0].link.value.reduce((a, b) => a + b, 0),
  width: el.layout.width
}));

test('draws clusters to clusters for the nodes by default', async () => {
  await expect(selectors()).toHaveCount(2);
  await expect.poll(async () => (await plot()).flow).toBe(310);
  expect((await plot()).variables).toEqual(['Cluster']);
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

test('changing a variable redraws', async () => {
  await selectors().nth(1).selectOption('group');
  await expect.poll(async () => (await plot()).variables).toEqual(['Cluster', 'Group']);
  expect((await plot()).flow).toBe(310);
  // Each variable's nodes are its own values only
  const groups = await page.evaluate(() => new Set(session.data.nodes.map(d => d.group)).size);
  const clusters = await page.evaluate(() => new Set(session.data.nodes.map(d => d.cluster)).size);
  expect((await plot()).labels.length).toBe(groups + clusters);
});

test('variables can be added and removed', async () => {
  await pane().locator('button', { hasText: 'Add Variable' }).click();
  await expect(selectors()).toHaveCount(3);
  await selectors().nth(2).selectOption('state');
  await expect.poll(async () => (await plot()).variables).toEqual(['Cluster', 'Group', 'State']);
  expect((await plot()).flow).toBe(620);
  await pane().locator('li .flow-remove').first().click();
  await expect(selectors()).toHaveCount(2);
  await expect.poll(async () => (await plot()).variables).toEqual(['Group', 'State']);
});

test('the links dataset offers link variables', async () => {
  await pane().locator('label', { hasText: 'Links' }).click();
  expect(await page.evaluate(() => session.style.widgets['flow-showNodes'])).toBe(false);
  await expect.poll(() => selectors().first().evaluate(el => Array.from(el.options).map(o => o.value))).toContain('distance');
  await selectors().nth(0).selectOption('origin');
  await selectors().nth(1).selectOption('contact');
  await expect.poll(async () => (await plot()).flow).toBe(476);
});

test('redraws when the visible links change', async () => {
  await page.evaluate(() => (el => { el.value = 0.005; el.dispatchEvent(new Event('change', { bubbles: true })); })(document.getElementById('link-threshold')));
  await expect.poll(async () => (await plot()).flow).toBeLessThan(476);
  await page.evaluate(() => (el => { el.value = 0.015; el.dispatchEvent(new Event('change', { bubbles: true })); })(document.getElementById('link-threshold')));
  await expect.poll(async () => (await plot()).flow).toBe(476);
});

test('reopening the view restores the dataset', async () => {
  await closeView(page, 'flow_diagram');
  await launchView(page, 'flow_diagram');
  await expect(pane().locator('label', { hasText: 'Links' })).toHaveClass(/active/);
  await expect.poll(() => selectors().first().evaluate(el => Array.from(el.options).map(o => o.value))).toContain('distance');
});

test('the plot follows the panel size', async () => {
  const before = (await plot()).width;
  await page.setViewportSize({ width: 1000, height: 900 });
  await expect.poll(async () => (await plot()).width).toBeLessThan(before - 200);
  await page.setViewportSize({ width: 1400, height: 900 });
  await expect.poll(async () => (await plot()).width).toBe(before);
});

test('exports a PNG', async () => {
  const modal = await openExport(page, view(), 'Export Flow Diagram');
  await modal.getByPlaceholder('Filename').fill('flow-test');
  const [download] = await Promise.all([page.waitForEvent('download'), modal.locator('button', { hasText: 'Export' }).click()]);
  expect(download.suggestedFilename()).toBe('flow-test.png');
  expect(errors).toEqual([]);
});
