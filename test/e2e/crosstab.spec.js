// The crosstab view: choosing its variables, pivoting, datasets, redraws and
// export.
const { test, expect } = require('@playwright/test');
const { watchErrors, loadNetwork, launchView, openExport } = require('./helpers');

test.describe.configure({ mode: 'serial' });

let page, errors;
test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  errors = watchErrors(page);
  await loadNetwork(page);
  await launchView(page, 'crosstab');
});
test.afterAll(() => page.close());

const view = () => page.locator('.lm_content:has(button[title="Export crosstab data"])').first();
const pane = () => view().locator('.left-pane');
const fieldX = () => pane().locator('select').nth(0), fieldY = () => pane().locator('select').nth(1);
// The crosstab: its column titles, its first column, and the total count
const table = () => view().locator('.tabulator').evaluate(el => {
  const all = Tabulator.findTable(el), t = all[all.length - 1]; // the newest, if the element was redrawn
  const data = t.getData();
  const fields = t.getColumns().map(c => c.getField()).slice(1);
  return {
    columns: t.getColumns().map(c => c.getDefinition().title).slice(1),
    rows: data.map(r => r.col + ''),
    total: data.reduce((sum, r) => sum + fields.reduce((s, f) => s + (+r[f] || 0), 0), 0)
  };
});
// Each value of a field, as the crosstab labels it
const distinct = field => page.evaluate(field => Array.from(new Set(session.data.nodes.map(d => MT.valueLabel(d[field])))), field);

test('opens on its first two categorical variables, drawn', async () => {
  await expect.poll(async () => (await table()).total).toBe(310);
  await expect(fieldX()).toHaveValue('state');
  await expect(fieldY()).toHaveValue('group');
  // With a table to show, the settings start closed
  await expect(pane()).toBeHidden();
  await view().locator('.settings-toggle').click();
  await expect(pane()).toBeVisible();
  await expect.poll(() => fieldX().evaluate(el => Array.from(el.options).map(o => o.value))).toContain('group');
});

test('crosstabs two node variables', async () => {
  await fieldX().selectOption('group');
  await fieldY().selectOption('state');
  await expect.poll(async () => (await table()).total).toBe(310);
  const t = await table();
  expect(t.columns.length).toBe((await distinct('group')).length);
  expect(t.rows.sort()).toEqual((await distinct('state')).sort());
});

test('pivoting swaps the variables', async () => {
  await view().locator('button[title="Pivot Crosstab"]').click();
  await expect(fieldX()).toHaveValue('state');
  await expect(fieldY()).toHaveValue('group');
  await expect.poll(async () => (await table()).rows.sort()).toEqual((await distinct('group')).sort());
  expect((await table()).total).toBe(310);
});

test('the links dataset crosstabs link variables, and redraws with the visible links', async () => {
  await pane().locator('label', { hasText: 'Links' }).click();
  await expect.poll(() => fieldX().evaluate(el => Array.from(el.options).map(o => o.value))).toContain('distance');
  await fieldX().selectOption('origin');
  await fieldY().selectOption('contact');
  await expect.poll(async () => (await table()).total).toBe(476);
  await page.evaluate(() => (el => { el.value = 0.005; el.dispatchEvent(new Event('change', { bubbles: true })); })(document.getElementById('link-threshold')));
  await expect.poll(async () => (await table()).total).toBeLessThan(476);
  await page.evaluate(() => (el => { el.value = 0.015; el.dispatchEvent(new Event('change', { bubbles: true })); })(document.getElementById('link-threshold')));
  await expect.poll(async () => (await table()).total).toBe(476);
});

test('exports CSV', async () => {
  const modal = await openExport(page, view(), 'Export crosstab data');
  await modal.getByPlaceholder('Filename').fill('crosstab-test');
  const [download] = await Promise.all([page.waitForEvent('download'), modal.locator('button', { hasText: 'Export' }).click()]);
  expect(download.suggestedFilename()).toBe('crosstab-test.csv');
  expect(errors).toEqual([]);
});
