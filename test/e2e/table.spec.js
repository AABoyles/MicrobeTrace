// The table view: datasets, the column picker, selecting rows, text size and
// export.
const { test, expect } = require('@playwright/test');
const { watchErrors, loadNetwork, launchView, openExport } = require('./helpers');

test.describe.configure({ mode: 'serial' });

let page, errors;
test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  errors = watchErrors(page);
  await loadNetwork(page);
  await launchView(page, 'table');
});
test.afterAll(() => page.close());

const view = () => page.locator('.lm_content:has(button[title="Export table data"])').first();
// What Tabulator holds: the column titles and the number of rows
const table = () => view().locator('.tabulator').evaluate(el => {
  const all = Tabulator.findTable(el), t = all[all.length - 1]; // the newest, if the element was redrawn
  return { columns: t.getColumns().map(c => c.getDefinition().title), rows: t.getDataCount() };
});
const dataset = name => view().locator('.view-controls label', { hasText: name }).click();
// The column picker, whichever multi-select draws it
const picker = () => view().locator('.chosen-container, .ts-wrapper').first();
const removeColumn = title => picker().locator(`.search-choice:has-text("${title}") .search-choice-close, .item:has-text("${title}") .remove`).first().click();
async function addColumn(title) {
  const input = picker().locator('input').first();
  await input.click();
  await input.fill(title);
  // Enter picks the highlighted option, so wait for the menu to filter
  await expect(picker().locator('.ts-dropdown .option.active, .chosen-results .highlighted').first()).toHaveText(title);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
}

test('shows the nodes with their first fields', async () => {
  await expect.poll(async () => (await table()).rows).toBe(310);
  expect((await table()).columns).toEqual(['Index', 'ID', 'Cluster', 'Degree', 'Origin']);
});

test('columns can be removed and added', async () => {
  await removeColumn('Degree');
  await expect.poll(async () => (await table()).columns).toEqual(['Index', 'ID', 'Cluster', 'Origin']);
  await addColumn('Group');
  await expect.poll(async () => (await table()).columns).toEqual(['Index', 'ID', 'Cluster', 'Origin', 'Group']);
});

test('shows links and clusters', async () => {
  await dataset('Links');
  await expect.poll(async () => (await table()).rows).toBe(476);
  expect((await table()).columns).toContain('Distance');
  await dataset('Clusters');
  const clusters = await page.evaluate(() => session.data.clusters.length);
  await expect.poll(async () => (await table()).rows).toBe(clusters);
  await dataset('Nodes');
  await expect.poll(async () => (await table()).rows).toBe(310);
});

test('clicking a row selects its node', async () => {
  const row = view().locator('.tabulator-row').first();
  await row.click();
  await expect.poll(() => page.evaluate(() => session.data.nodes.filter(d => d.selected).length)).toBe(1);
  const color = await page.evaluate(() => session.style.widgets['selected-color']);
  await expect.poll(() => view().locator('.tabulator-row').first().evaluate(el => el.style.backgroundColor)).not.toBe('');
  expect(await view().locator('.tabulator-row').first().evaluate((el, color) => {
    const probe = document.createElement('div');
    probe.style.backgroundColor = color;
    return el.style.backgroundColor == probe.style.backgroundColor;
  }, color)).toBe(true);
  await view().locator('.tabulator-row').first().click();
  await expect.poll(() => page.evaluate(() => session.data.nodes.filter(d => d.selected).length)).toBe(0);
});

test('selections made elsewhere show', async () => {
  // The row of the second node (selected rows move to the top)
  const background = () => view().locator('.tabulator').evaluate(el => {
    const all = Tabulator.findTable(el), t = all[all.length - 1];
    const row = t.getRows().find(r => r.getData()._id == session.data.nodes[1]._id);
    return row.getElement().style.backgroundColor;
  });
  await page.evaluate(() => { session.data.nodes[1].selected = true; MT.events.emit('node-selected'); });
  await expect.poll(background).not.toBe('');
  await page.evaluate(() => { session.data.nodes[1].selected = false; MT.events.emit('node-selected'); });
  await expect.poll(background).toBe('');
});

test('the text size setting applies', async () => {
  await view().locator('.view-controls button').first().click();
  const slider = view().locator('.left-pane input[type=range]');
  await expect(slider).toBeVisible();
  await slider.fill('20');
  await expect.poll(() => view().locator('.tabulator').evaluate(el => el.closest('[style*="font-size"]') && el.closest('[style*="font-size"]').style.fontSize)).toBe('20px');
  await view().locator('.view-controls button').first().click();
  await expect(view().locator('.left-pane')).toBeHidden();
});

test('exports CSV', async () => {
  const modal = await openExport(page, view(), 'Export table data');
  await modal.getByPlaceholder('Filename').fill('table-test');
  const [download] = await Promise.all([page.waitForEvent('download'), modal.locator('button', { hasText: 'Export' }).click()]);
  expect(download.suggestedFilename()).toBe('table-test.csv');
  expect(errors).toEqual([]);
});
