// Privacy (#262) and the license dialog (#255): the About dialog states what is
// stored and who is contacted, and can delete everything stored in the browser;
// Reject no longer leaves for another site.
const { test, expect } = require('@playwright/test');
const { watchErrors, open, waitForModal } = require('./helpers');

test('Reject explains instead of leaving, and no text sends users to cdc.gov', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/index.html');
  await waitForModal(page, 'div#licenseAgreement');
  await expect(page.locator('#reject-message')).toBeHidden();
  await page.click('#rejectAgreement');
  await expect(page.locator('#reject-message')).toBeVisible();
  await expect(page.locator('div#licenseAgreement')).toBeVisible();
  expect(new URL(page.url()).hostname).not.toMatch(/cdc\.gov$/);
  expect(await page.evaluate(() => /cdc\.gov/i.test(document.documentElement.outerHTML))).toBe(false);
  expect(errors).toEqual([]);
});

test('About states the privacy facts and deletes everything stored in the browser', async ({ page }) => {
  const errors = watchErrors(page);
  await open(page);
  await expect.poll(() => page.evaluate(() => db.getItem('licenseAccepted'))).toBeTruthy();
  await page.evaluate(() => db.setItem('stash-1-test', 'x'));
  await page.evaluate(() => { localStorage.setItem('probe', '1'); });

  await page.click('button.nav-link:text-is("Help")');
  await page.click('#AboutTab');
  await waitForModal(page, '#about-modal');
  const statement = page.locator('#privacy-statement');
  await expect(statement).toContainText('IndexedDB');
  await expect(statement).toContainText('CARTO');
  await expect(statement).toContainText('WebMCP');

  await page.click('#delete-everything');
  await waitForModal(page, '#delete-everything-modal');
  // Cancel keeps everything
  await page.click('#delete-everything-modal .modal-footer .btn-secondary');
  await page.locator('#delete-everything-modal').waitFor({ state: 'hidden' });
  expect(await page.evaluate(() => db.getItem('stash-1-test'))).toBe('x');

  await page.click('button.nav-link:text-is("Help")');
  await page.click('#AboutTab');
  await waitForModal(page, '#about-modal');
  await page.click('#delete-everything');
  await waitForModal(page, '#delete-everything-modal');
  await Promise.all([page.waitForNavigation(), page.click('#delete-everything-confirm')]);
  await page.waitForSelector('#data-files', { state: 'attached' });

  expect(await page.evaluate(() => db.keys())).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem('probe'))).toBeNull();
  // The license is asked for again
  await expect(page.locator('div#licenseAgreement')).toBeVisible();
  expect(errors).toEqual([]);
});
