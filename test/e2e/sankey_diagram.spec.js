// The Sankey diagram view: its variables, datasets, redraws and export.
const { test, expect } = require('@playwright/test');
const { watchErrors, loadNetwork, launchView, closeView, openExport } = require('./helpers');

test.describe.configure({ mode: 'serial' });

let page, errors;
test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  errors = watchErrors(page);
  await loadNetwork(page);
  await launchView(page, 'sankey_diagram');
});
test.afterAll(() => page.close());

const view = () => page.locator('.lm_content:has(.sankey-plot)').first();
const pane = () => view().locator('.left-pane');
const selectors = () => pane().locator('li select');

// The sankey: node labels, the variable of each node, and the total flow
const plot = () => view().locator('.sankey-svg').evaluate(el => {
  const nodes = Array.from(el.querySelectorAll('.sankey-nodes rect'));
  return {
    labels: nodes.map(n => n.dataset.label),
    variables: Array.from(new Set(nodes.map(n => n.dataset.variable))),
    flow: Array.from(el.querySelectorAll('.sankey-links path')).reduce((sum, p) => sum + +p.dataset.value, 0),
    broken: Array.from(el.querySelectorAll('.sankey-links path, .sankey-nodes rect')).filter(e => /NaN|Infinity/.test(e.outerHTML)).length,
    width: +el.getAttribute('width')
  };
});

test('draws the first two categorical variables of the nodes by default', async () => {
  await expect(selectors()).toHaveCount(2);
  await expect.poll(async () => (await plot()).flow).toBe(310);
  expect((await plot()).variables).toEqual(['State', 'Group']);
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
  await selectors().nth(0).selectOption('cluster');
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
  await pane().locator('li .sankey-remove').first().click();
  await expect(selectors()).toHaveCount(2);
  await expect.poll(async () => (await plot()).variables).toEqual(['Group', 'State']);
});

test('one variable is drawn, with nothing flowing from it', async () => {
  await pane().locator('li .sankey-remove').first().click();
  await expect.poll(async () => (await plot()).variables).toEqual(['State']);
  expect(await plot()).toMatchObject({ flow: 0, broken: 0 });
  await pane().locator('button', { hasText: 'Add Variable' }).click();
  await expect(selectors()).toHaveCount(2);
});

test('the links dataset offers link variables', async () => {
  await pane().locator('label', { hasText: 'Links' }).click();
  expect(await page.evaluate(() => session.style.widgets['sankey-showNodes'])).toBe(false);
  await expect.poll(() => selectors().first().evaluate(el => Array.from(el.options).map(o => o.value))).toContain('distance');
  await selectors().nth(0).selectOption('origin');
  await selectors().nth(1).selectOption('contact');
  await expect.poll(async () => (await plot()).flow).toBe(299);
});

test('redraws when the visible links change', async () => {
  await page.evaluate(() => (el => { el.value = 0.005; el.dispatchEvent(new Event('change', { bubbles: true })); })(document.getElementById('link-threshold')));
  await expect.poll(async () => (await plot()).flow).toBeLessThan(299);
  await page.evaluate(() => (el => { el.value = 0.015; el.dispatchEvent(new Event('change', { bubbles: true })); })(document.getElementById('link-threshold')));
  await expect.poll(async () => (await plot()).flow).toBe(299);
});

test('reopening the view restores the dataset', async () => {
  await closeView(page, 'sankey_diagram');
  await launchView(page, 'sankey_diagram');
  await expect(pane().locator('label', { hasText: 'Links' }).locator('input')).toBeChecked();
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
  const modal = await openExport(page, view(), 'Export Sankey Diagram');
  await modal.getByPlaceholder('Filename').fill('sankey-test');
  const [download] = await Promise.all([page.waitForEvent('download'), modal.locator('button', { hasText: 'Export' }).click()]);
  expect(download.suggestedFilename()).toBe('sankey-test.png');
  expect(errors).toEqual([]);
});
