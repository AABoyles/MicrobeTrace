// Shared UI: the license dialog, the navbar menus, the settings dialog and its
// toggle buttons, and the search buttons.
const { test, expect } = require('@playwright/test');
const { fixtures, watchErrors, waitForModal } = require('./helpers');

test.describe.configure({ mode: 'serial' });

let page, errors;
test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  errors = watchErrors(page);
});
test.afterAll(() => page.close());

test('the license agreement shows and closes', async () => {
  await page.goto('/index.html');
  await expect(page.locator('div#licenseAgreement')).toBeVisible();
  await waitForModal(page, 'div#licenseAgreement');
  await page.click('#acceptAgreement');
  await expect(page.locator('div#licenseAgreement')).toBeHidden();
});

test('files load and launch the network', async () => {
  await page.setInputFiles('#data-files', fixtures);
  await expect(page.locator('#file-table .file-table-row')).toHaveCount(3);
  await page.click('#launch');
  await expect(page.locator('#numberOfNodes')).toHaveText('310', { timeout: 120000 });
});

test('the View menu opens and launches a view', async () => {
  await page.click('text=View');
  const menu = page.locator('.dropdown-menu.show');
  await expect(menu.locator('.viewbutton').first()).toBeVisible();
  await menu.locator('.viewbutton[data-href="table"]').click();
  await expect.poll(() => page.evaluate(() => layout.contentItems.map(i => i.componentType))).toContain('table');
});

test('the settings dialog opens, switches tabs and closes', async () => {
  const dialog = page.locator('#global-settings-modal');
  await page.click('#SettingsTab');
  await expect(dialog).toBeVisible();
  const tabs = dialog.locator('.nav-tabs .nav-link');
  await tabs.nth(1).click();
  await expect(tabs.nth(1)).toHaveClass(/active/);
  await tabs.nth(0).click();
  await waitForModal(page, '#global-settings-modal');
  await dialog.locator('.btn-close').click();
  await expect(dialog).toBeHidden();
});

test('a toggle-button group switches the statistics panel', async () => {
  const dialog = page.locator('#global-settings-modal');
  await page.click('#SettingsTab');
  await expect(dialog).toBeVisible();
  const pane = await page.evaluate(() => document.querySelector('#network-statistics-hide').closest('.tab-pane').id);
  await dialog.locator(`a[href="#${pane}"]`).click();
  await dialog.locator('label:has(#network-statistics-hide)').click();
  await expect(page.locator('label:has(#network-statistics-hide)')).toHaveClass(/active/);
  await expect(page.locator('label:has(#network-statistics-show)')).not.toHaveClass(/active/);
  await expect(page.locator('#network-statistics-wrapper')).toBeHidden();
  await dialog.locator('label:has(#network-statistics-show)').click();
  await expect(page.locator('#network-statistics-wrapper')).toBeVisible();
  await waitForModal(page, '#global-settings-modal');
  await dialog.locator('.btn-close').click();
  await expect(dialog).toBeHidden();
});

test('single toggle buttons keep their state', async () => {
  await page.click('#casesensitivebutton');
  await expect(page.locator('#casesensitivebutton')).toHaveClass(/active/);
  expect(await page.evaluate(() => session.style.widgets['search-case-sensitive'])).toBe(true);
  await page.click('#casesensitivebutton');
  await expect(page.locator('#casesensitivebutton')).not.toHaveClass(/active/);
});

test('the New Session dialog opens', async () => {
  await page.click('.navbar .nav-link.dropdown-toggle >> nth=0');
  await page.click('#NewTab');
  await expect(page.locator('#exit-modal')).toBeVisible();
  expect(errors).toEqual([]);
});
