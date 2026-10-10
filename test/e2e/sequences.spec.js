// The sequences view: drawing the alignment, its cell size and characters, and
// export.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const { watchErrors, loadNetwork, launchView, closeView, openExport } = require('./helpers');

test.describe.configure({ mode: 'serial' });

let page, errors, ids;
const nodeIds = () => page.evaluate(() => session.data.nodes.map(d => d.id));
test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  errors = watchErrors(page);
  await loadNetwork(page);
  ids = await nodeIds();
  await launchView(page, 'sequences');
});
test.afterAll(() => page.close());

const view = () => page.locator('.lm_content:has(.modal-title:has-text("Export Sequences"))').first();
const pane = () => view().locator('.left-pane');
const canvases = () => view().locator('canvas');
const size = () => canvases().first().evaluate(c => [c.width, c.height]);
const set = (key, value) => page.evaluate(([key, value]) => MT.settings.set(key, value), [key, value]);
const sequences = () => page.evaluate(() => session.data.nodes.filter(d => d.seq).length);

test('draws one row per sequence', async () => {
  await expect(canvases()).toHaveCount(1);
  const [, height] = await size();
  expect(height).toBe(await sequences() * 12);
});

test('the cell size redraws the alignment, once', async () => {
  await view().locator('button[title="Sequences Settings"]').click();
  await expect(pane()).toBeVisible();
  const [width] = await size();
  await pane().locator('input[data-setting="sequences-cell-height"]').fill('6');
  await expect.poll(async () => (await size())[1]).toBe(await sequences() * 6);
  await pane().locator('input[data-setting="sequences-cell-width"]').fill('4');
  await expect.poll(async () => (await size())[0]).toBe(width * 2);
  await expect(canvases()).toHaveCount(1);
});

test('characters can be hidden', async () => {
  await pane().locator('label', { hasText: 'Hide' }).click();
  expect(await page.evaluate(() => session.style.widgets['sequences-show-chars'])).toBe(false);
  await expect(canvases()).toHaveCount(1);
});

test("drawing leaves the nodes' ids alone", async () => {
  expect(await nodeIds()).toEqual(ids);
});

test('reopening the view restores its settings', async () => {
  await closeView(page, 'sequences');
  await launchView(page, 'sequences');
  await expect.poll(async () => (await size())[1]).toBe(await sequences() * 6);
});

for (const [filetype, filename] of [['fasta', 'seqs-test.fasta'], ['mega', 'seqs-test.mega'], ['png', 'seqs-test.png']]) {
  test(`exports ${filetype}`, async () => {
    const modal = await openExport(page, view(), 'Export Sequences');
    await modal.getByPlaceholder('Filename').fill('seqs-test');
    await modal.locator('select').selectOption(filetype);
    const [download] = await Promise.all([page.waitForEvent('download'), modal.locator('button', { hasText: 'Export' }).click()]);
    expect(download.suggestedFilename()).toBe(filename);
    if (filetype != 'png') {
      const text = fs.readFileSync(await download.path(), 'utf8');
      expect(text.split(filetype == 'fasta' ? '>' : '#').length - 1).toBe(await sequences());
    }
    expect(errors).toEqual([]);
  });
}
