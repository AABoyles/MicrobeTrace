// The PDF library (dist/bundle.pdf.js, 1.9 MB) is fetched the first time a PDF
// is exported, not with the page (#251).
const { test, expect } = require('@playwright/test');
const { watchErrors, loadNetwork, launchView, openExport } = require('./helpers');

test('bundle.pdf.js is fetched by the first PDF export, not on load', async ({ page }) => {
  const errors = watchErrors(page);
  const requested = [];
  page.on('request', request => requested.push(new URL(request.url()).pathname));
  await loadNetwork(page);
  await launchView(page, 'crosstab');
  expect(requested.some(path => path.endsWith('/dist/bundle.secondary.js'))).toBe(true);
  expect(requested.filter(path => path.endsWith('/dist/bundle.pdf.js'))).toEqual([]);
  expect(await page.evaluate(() => typeof pdfMake)).toBe('undefined');

  const view = page.locator('.lm_content:has(button[title="Export crosstab data"])').first();
  const openPDF = async () => {
    const modal = await openExport(page, view, 'Export crosstab data');
    await modal.getByPlaceholder('Filename').fill('lazy-test');
    await modal.locator('select[name="export-filetype"]').selectOption('pdf');
    return modal;
  };
  let modal = await openPDF();

  // A failed load is reported, leaves the dialog usable, and can be retried
  await page.route('**/dist/bundle.pdf.js', route => route.abort());
  await modal.locator('button', { hasText: 'Export' }).click();
  await expect(page.getByText("The PDF library couldn't be loaded")).toBeVisible();
  await expect(page.locator('.modal.show')).toHaveCount(0); // the dialog closes as for any export
  expect(await page.evaluate(() => typeof pdfMake)).toBe('undefined');
  await page.unroute('**/dist/bundle.pdf.js');
  modal = await openPDF();

  const [download] = await Promise.all([page.waitForEvent('download'), modal.locator('button', { hasText: 'Export' }).click()]);
  expect(download.suggestedFilename()).toBe('lazy-test.pdf');
  expect(requested.filter(path => path.endsWith('/dist/bundle.pdf.js'))).toHaveLength(2); // the failed try and the retry
  expect(errors).toEqual([]);
});
