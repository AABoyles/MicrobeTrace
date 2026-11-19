// Link-list headers with characters like / keep their values, under their names as written (#217, #218);
// node fields are listed once each (#235); a view that fails to load says so,
// is not cached, and loads on the next try (#237).
const { test, expect } = require('@playwright/test');
const { watchErrors, open, loadNetwork, launchView } = require('./helpers');

test('link-list columns whose headers contain / keep their values, and are usable as Source and Target', async ({ page }) => {
  await open(page);
  const csv = 'From/ID,To/ID,Dist,Date/Time\nA,B,0.01,2024-01-02\nB,C,0.02,2024-01-03\n';
  await page.setInputFiles('#data-files', { name: 'links.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await page.waitForFunction(() => document.querySelectorAll('#file-table .file-table-row').length == 1);
  await page.evaluate(() => Object.assign(session.files[0], { format: 'link', field1: 'From/ID', field2: 'To/ID', field3: 'Dist' }));
  await page.click('#launch');
  await page.waitForFunction(() => session.data.nodes.length > 0 && !layout.contentItems.some(i => i.componentType == 'files'), null, { timeout: 60000 });
  const result = await page.evaluate(() => ({
    nodes: session.data.nodes.map(n => n._id).sort(),
    dates: session.data.links.map(l => l['Date/Time']).sort()
  }));
  expect(result.nodes).toEqual(['A', 'B', 'C']);
  expect(result.dates).toEqual(['2024-01-02', '2024-01-03']);
});

test.describe('after loading a network', () => {
  test.describe.configure({ mode: 'serial' });
  let page, errors;
  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    errors = watchErrors(page);
    await loadNetwork(page);
  });
  test.afterAll(() => page.close());

  test('node fields are listed once each', async () => {
    const fields = await page.evaluate(() => session.data.nodeFields);
    expect(fields.length).toBe(new Set(fields).size);
    await page.evaluate(() => MT.addNodeField('_diff', '_diff', 'seq'));
    const again = await page.evaluate(() => session.data.nodeFields);
    expect(again.length).toBe(new Set(again).size);
  });

  test('a view that fails to load says so, is not cached, and loads on the next try', async () => {
    await page.route('**/components/heatmap.html', route => route.fulfill({ status: 404, body: 'Not found' }));
    await page.evaluate(() => MT.launchView('heatmap'));
    await expect(page.locator('.toast', { hasText: 'Could not load the Heatmap view' })).toBeVisible();
    expect(await page.evaluate(() => 'heatmap' in temp.componentCache)).toBe(false);
    await page.unroute('**/components/heatmap.html');
    await launchView(page, 'heatmap');
    expect(errors).toEqual([]);
  });

  test('a view whose script fails to load says so, is closed, and loads on the next try', async () => {
    await page.route('**/components/histogram.js', route => route.fulfill({ status: 404, body: 'Not found' }));
    await page.evaluate(() => MT.launchView('histogram'));
    await expect(page.locator('.toast', { hasText: 'Could not load the Histogram view' })).toBeVisible();
    expect(await page.evaluate(() => 'histogram' in temp.componentCache)).toBe(false);
    await page.unroute('**/components/histogram.js');
    await launchView(page, 'histogram');
    expect(errors).toEqual([]);
  });
});
