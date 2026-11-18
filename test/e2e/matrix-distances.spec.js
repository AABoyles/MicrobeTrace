// Distance values from files (#220, #221): an Excel matrix whose top-left cell
// is empty loads; a matrix that cannot be read is reported by name and the
// loading dialog goes; links with no distance column have no distance (not 0) but are still shown.
const XLSX = require('xlsx');
const { test, expect } = require('@playwright/test');
const { watchErrors, open } = require('./helpers');

let page, errors;
test.beforeEach(async ({ browser }) => {
  page = await browser.newPage();
  errors = watchErrors(page);
  await open(page);
});
test.afterEach(() => page.close());

const file = (name, buffer) => ({ name, mimeType: 'application/octet-stream', buffer: Buffer.from(buffer) });
const rows = () => page.locator('#file-table .file-table-row');
const kind = async value => { await rows().first().locator(`label:has(input[value="${value}"])`).click(); };

test('an Excel matrix with an empty top-left cell loads', async () => {
  const sheet = XLSX.utils.aoa_to_sheet([[null, 'A', 'B', 'C'], ['A', 0, 1, 5], ['B', 1, 0, 2], ['C', 5, 2, 0]]);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'm');
  await page.setInputFiles('#data-files', [file('m.xlsx', XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }))]);
  await expect(rows()).toHaveCount(1);
  await kind('matrix');
  await page.click('#launch');
  await page.waitForFunction(() => session.data.nodes.length == 3 && session.data.clusters.length > 0, null, { timeout: 60000 });
  expect(await page.evaluate(() => session.data.graph.m)).toBe(3);
  expect(errors).toEqual([]);
});

test('a matrix that cannot be read is reported by name, and the dialog goes', async () => {
  await page.setInputFiles('#data-files', [file('empty.csv', ',,\n,,\n')]);
  await expect(rows()).toHaveCount(1);
  await kind('matrix');
  await page.click('#launch');
  await expect(page.locator('.toast', { hasText: 'empty.csv' }).first()).toBeVisible({ timeout: 20000 });
  await page.waitForFunction(() => !document.getElementById('loading-information-modal').classList.contains('show'), null, { timeout: 20000 });
  await expect(page.locator('#launch')).toBeEnabled();
});

test('links with no distance column have no distance, are reported, and are shown', async () => {
  await page.setInputFiles('#data-files', [file('l.csv', 'a,b\nA,B\nB,C\n')]);
  await expect(rows()).toHaveCount(1);
  await page.click('#launch');
  await page.waitForFunction(() => session.data.nodes.length == 3, null, { timeout: 60000 });
  await expect(page.locator('.toast', { hasText: 'no distance' }).first()).toBeVisible();
  const values = await page.evaluate(() => {
    const g = session.data.graph, out = [];
    for (let e = 0; e < g.m; e++) out.push(g.getValue(e, session.style.widgets['default-distance-metric']));
    return out;
  });
  expect(values).toEqual([null, null]);
  // ...but they are shown: the threshold has nothing to judge them by
  await page.waitForFunction(() => session.data.graph.visibleCount == 2, null, { timeout: 20000 });
});
