// The aggregation view: one table per variable, adding, changing and removing
// them, redraws and export.
const { test, expect } = require('@playwright/test');
const { watchErrors, loadNetwork, launchView, openExport } = require('./helpers');

test.describe.configure({ mode: 'serial' });

let page, errors;
test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  errors = watchErrors(page);
  await loadNetwork(page);
  await launchView(page, 'aggregation');
});
test.afterAll(() => page.close());

const view = () => page.locator('.lm_content:has(button[title="Export Aggregation data"])').first();
const pane = () => view().locator('.left-pane');
const selectors = () => pane().locator('li select');
// Each table: its first column's title, its rows and its total count
const tables = () => view().locator('.tabulator').evaluateAll(els => els.map(el => {
  const all = Tabulator.findTable(el), t = all[all.length - 1]; // the newest, if the element was redrawn
  const data = t.getData();
  return { title: t.getColumns()[0].getDefinition().title, rows: data.length, total: data.reduce((s, r) => s + r.n, 0) };
}));
const distinct = field => page.evaluate(field => new Set(session.data.nodes.map(d => d[field])).size, field);

test('opens with node clusters', async () => {
  await expect.poll(async () => (await tables()).length).toBe(1);
  const [t] = await tables();
  expect(t.title).toBe('Node Cluster');
  expect(t.rows).toBe(await distinct('cluster'));
  expect(t.total).toBe(310);
});

test('numbers sort as numbers', async () => {
  // Sorted by cluster: IDs 0, 1, 2 … rather than 0, 1, 10, 11 …
  await view().locator('.tabulator-col', { hasText: 'Node Cluster' }).locator('.tabulator-col-title').click();
  const values = await view().locator('.tabulator').first().evaluate(el => {
    const all = Tabulator.findTable(el), t = all[all.length - 1];
    return t.getRows('active').map(r => r.getData().cluster);
  });
  expect(values.length).toBeGreaterThan(11);
  expect(values.map(Number)).toEqual(values.map(Number).slice().sort((a, b) => a - b));
});

test('a variable can be added and changed', async () => {
  await view().locator('.view-controls button').first().click();
  await expect(pane()).toBeVisible();
  await pane().locator('button', { hasText: 'Add Variable' }).click();
  await expect(selectors()).toHaveCount(2);
  await selectors().nth(1).selectOption('node group');
  await expect.poll(async () => (await tables()).map(t => t.title)).toEqual(['Node Cluster', 'Node Group']);
  expect((await tables())[1].rows).toBe(await distinct('group'));
});

test('removing a variable removes its table', async () => {
  await pane().locator('li .aggregation-remove').first().click();
  await expect(selectors()).toHaveCount(1);
  await expect.poll(async () => (await tables()).map(t => t.title)).toEqual(['Node Group']);
});

test('link variables count the visible links', async () => {
  await selectors().nth(0).selectOption('link contact');
  await expect.poll(async () => (await tables())[0].total).toBe(476);
  await page.evaluate(() => (el => { el.value = 0.005; el.dispatchEvent(new Event('change', { bubbles: true })); })(document.getElementById('link-threshold')));
  await expect.poll(async () => (await tables())[0].total).toBeLessThan(476);
  await page.evaluate(() => (el => { el.value = 0.015; el.dispatchEvent(new Event('change', { bubbles: true })); })(document.getElementById('link-threshold')));
  await expect.poll(async () => (await tables())[0].total).toBe(476);
});

for (const [filetype, filename] of [['csv.zip', 'aggregation-test.zip'], ['xlsx', 'aggregation-test.xlsx']]) {
  test(`exports ${filetype}`, async () => {
    const modal = await openExport(page, view(), 'Export Aggregation data');
    await modal.getByPlaceholder('Filename').fill('aggregation-test');
    await modal.locator('select').selectOption(filetype);
    const [download] = await Promise.all([page.waitForEvent('download'), modal.locator('button', { hasText: 'Export' }).click()]);
    expect(download.suggestedFilename()).toBe(filename);
    await expect(modal).toBeHidden();
    expect(errors).toEqual([]);
  });
}
