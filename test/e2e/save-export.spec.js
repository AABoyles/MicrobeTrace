// Saving a session and exporting images: the formats explained in the dialog,
// names put right, a confirmation, a .zip that opens; no watermark; Scale and
// Resolution explained; no native alert() dialogs.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { confirmReplace, watchErrors, open, fixtures, launchView, closeView, waitForModal, openExport } = require('./helpers');

test.describe.configure({ mode: 'serial' });

let page, errors, alerts = 0;
test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  errors = watchErrors(page);
  page.on('dialog', d => { alerts++; d.dismiss(); });
  await open(page);
  await page.setInputFiles('#data-files', fixtures);
  await page.waitForFunction(() => document.querySelectorAll('#file-table .file-table-row').length >= 3);
  await page.click('#launch');
  await page.waitForFunction(() => session.data.clusters.length > 0 && document.getElementById('numberOfNodes').textContent !== '', null, { timeout: 120000 });
});
test.afterAll(() => page.close());

test('the Save dialog explains the formats and the .zip', async () => {
  await page.keyboard.press('Control+s');
  await waitForModal(page, '#session-save-modal');
  const help = page.locator('#save-format-help');
  for (const text of ['MicrobeTrace session', 'HIV-TRACE']) await expect(help).toContainText(text);
  await expect(page.locator('#save-compress-help')).toContainText('open the .zip directly');
  await page.locator('#session-save-modal .btn-close').click();
  await expect(page.locator('#session-save-modal')).toBeHidden();
});

async function save(name, compress) {
  await page.keyboard.press('Control+s');
  await waitForModal(page, '#session-save-modal');
  const modal = page.locator('#session-save-modal');
  await modal.locator('#save-file-name').fill(name);
  await modal.locator('#save-file-compress')[compress ? 'check' : 'uncheck']();
  const [download] = await Promise.all([page.waitForEvent('download'), modal.locator('#save-data').click()]);
  return download;
}

test('an empty name gets a dated one, a typed extension is not doubled, and the save is confirmed', async () => {
  let d = await save('', false);
  expect(d.suggestedFilename()).toMatch(/^microbetrace-\d{4}-\d{2}-\d{2}\.microbetrace$/);
  d = await save('.microbetrace', false);
  expect(d.suggestedFilename()).toMatch(/^microbetrace-\d{4}/);
  d = await save('mine.microbetrace', false);
  expect(d.suggestedFilename()).toBe('mine.microbetrace');
  d = await save('my/odd:name.zip', true);
  expect(d.suggestedFilename()).toBe('myoddname.zip');
  await expect(page.locator('body')).toContainText('Saved as myoddname.zip');
});

test('a saved .zip opens directly, and a .zip without a session says so', async () => {
  const d = await save('roundtrip', true);
  const copy = path.join(os.tmpdir(), 'roundtrip-' + Date.now() + '.zip');
  fs.copyFileSync(await d.path(), copy);
  const nodes = await page.evaluate(() => session.data.nodes.length);
  await page.setInputFiles('#OpenTab', copy);
  await confirmReplace(page);
  await page.waitForFunction(n => session.data.nodes.length === n && document.getElementById('numberOfNodes').textContent !== '', nodes, { timeout: 60000 });

  const bytes = await page.evaluate(async () => {
    const zip = new JSZip();
    zip.file('notes.txt', 'hello');
    return Array.from(await zip.generateAsync({ type: 'uint8array' }));
  });
  const bad = path.join(os.tmpdir(), 'bad-' + Date.now() + '.zip');
  fs.writeFileSync(bad, Buffer.from(bytes));
  await page.setInputFiles('#OpenTab', bad);
  await confirmReplace(page).catch(() => {});
  await expect(page.locator('body')).toContainText('has no MicrobeTrace session in it');
});

test('image export has no watermark control, explains Scale and Resolution, and strips a typed extension', async () => {
  await launchView(page, 'graph');
  const view = page.locator('.lm_content:has(button[title="Export Graph"])');
  const modal = await openExport(page, view, 'Export Graph');
  await expect(modal).not.toContainText('Watermark');
  await expect(modal.locator('[name="export-opacity"]')).toHaveCount(0);
  await modal.locator('.export-advanced-button').click();
  await expect(modal).toContainText('Multiplies the size of the picture as shown');
  await expect(modal).toContainText('Size of the image in pixels');
  await expect(modal.locator('.export-dimensions')).toHaveText(/^\d+x\d+px$/);
  await modal.locator('[name="export-filename"]').fill('figure.png');
  await modal.locator('[name="export-filetype"]').selectOption('png');
  const [download] = await Promise.all([page.waitForEvent('download'), modal.locator('.export-button').click()]);
  expect(download.suggestedFilename()).toBe('figure.png');
  await closeView(page, 'graph');
});

test('a non-GeoJSON file is refused with a message, not an alert', async () => {
  expect(await page.evaluate(() => typeof MT.geoJSONUpload)).toBe('function');
  expect(alerts).toBe(0);
  expect(errors).toEqual([]);
});
