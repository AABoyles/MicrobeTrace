// The waterfall view: clusters, their nodes, a node's links, and redraws.
const { test, expect } = require('@playwright/test');
const { watchErrors, loadNetwork, launchView } = require('./helpers');

test.describe.configure({ mode: 'serial' });

let page, errors;
test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  errors = watchErrors(page);
  await loadNetwork(page);
  await launchView(page, 'waterfall');
});
test.afterAll(() => page.close());

const view = () => page.locator('.lm_content:has(h4:has-text("Clusters"))').first();
const column = n => view().locator('.list-group').nth(n).locator('.list-group-item');
// The visible clusters of more than one node
const clusters = () => page.evaluate(() => session.data.clusters.filter(c => c.visible && c.nodes > 1));

test('lists the clusters of more than one node', async () => {
  const expected = await clusters();
  await expect(column(0)).toHaveCount(expected.length);
  await expect(column(1)).toHaveCount(0);
});

test('choosing a cluster lists its nodes, and their details', async () => {
  const [first] = await clusters();
  await column(0).first().click();
  await expect(column(0).first()).toHaveClass(/active/);
  await expect(column(0).first()).toContainText('Links: ' + first.links);
  await expect(column(1)).toHaveCount(first.nodes);
});

test("choosing a node lists its links", async () => {
  await column(1).first().click();
  const id = (await column(1).first().locator('span').first().textContent()).trim();
  const links = await page.evaluate(id => MT.getVisibleNeighbors(id).length, id);
  await expect(column(2)).toHaveCount(links);
  // (The link color table floats over this column)
  await column(2).first().dispatchEvent('click');
  await expect(column(2).first()).toHaveClass(/active/);
});

test('choosing a node again closes its links', async () => {
  await column(1).first().click();
  await expect(column(2)).toHaveCount(0);
  await column(0).first().click();
  await expect(column(1)).toHaveCount(0);
});

test('redraws when the visible links change', async () => {
  const before = (await clusters()).length;
  await page.evaluate(() => (el => { el.value = 0.005; el.dispatchEvent(new Event('change', { bubbles: true })); })(document.getElementById('link-threshold')));
  await expect.poll(async () => (await clusters()).length).not.toBe(before);
  await expect(column(0)).toHaveCount((await clusters()).length);
  await page.evaluate(() => (el => { el.value = 0.015; el.dispatchEvent(new Event('change', { bubbles: true })); })(document.getElementById('link-threshold')));
  await expect(column(0)).toHaveCount(before);
});

test('follows the background color', async () => {
  await page.evaluate(() => { session.style.widgets['background-color'] = '#ff0000'; MT.events.emit('background-color-change'); });
  await expect(view().locator('.container-fluid')).toHaveCSS('background-color', 'rgb(255, 0, 0)');
  await page.evaluate(() => { session.style.widgets['background-color'] = '#ffffff'; MT.events.emit('background-color-change'); });
  expect(errors).toEqual([]);
});
