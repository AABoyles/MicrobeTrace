// Loads the fixture network once, then opens every view and checks it draws
// something without new errors.
const { test, expect } = require('@playwright/test');
const { watchErrors, loadNetwork, launchView, closeView } = require('./helpers');

test.describe.configure({ mode: 'serial' });

let page, errors;
test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  errors = watchErrors(page);
  await loadNetwork(page);
});
test.afterAll(() => page.close());

test('network statistics', async () => {
  const stats = await page.evaluate(() => ['numberOfNodes', 'numberOfVisibleLinks', 'numberOfSingletonNodes', 'numberOfDisjointComponents'].map(id => document.getElementById(id).textContent));
  expect(stats).toEqual(['310', '476', '22', '76']);
  expect(errors).toEqual([]);
});

// What each view draws, in its own element
const content = {
  network: 'canvas',
  table: '.tabulator-row',
  heatmap: '.main-svg',
  histogram: '.main-svg',
  scatterplot: '.main-svg',
  flow_diagram: '.main-svg',
  crosstab: '#crosstab-field-x option', // the table waits for two fields to be chosen
  aggregation: '.tabulator-row',
  phylogenetic_tree: 'svg circle',
  geo_map: '.leaflet-container',
  globe: 'canvas',
  bubbles: 'svg circle',
  gantt: 'svg',
  timeline: 'svg',
  waterfall: '.waterfall-clusters .list-group-item',
  sequences: '.sequences-panel canvas',
  choropleth: '.leaflet-container'
};

for (const [view, selector] of Object.entries(content)) {
  test(`${view} view`, async () => {
    errors.length = 0;
    await launchView(page, view);
    const item = await page.waitForFunction(view => {
      const item = layout.contentItems.find(i => i.componentType == view);
      return item && item.element;
    }, view);
    await expect.poll(() => item.evaluate((el, selector) => el.querySelectorAll(selector).length, selector), { timeout: 30000 }).toBeGreaterThan(0);
    await page.waitForTimeout(500);
    expect(errors).toEqual([]);
    if (view != 'network') await closeView(page, view);
  });
}
