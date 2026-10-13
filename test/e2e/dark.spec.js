// The interface light or dark as the system is: Bootstrap's theme follows the
// system's setting, and changes with it; in dark, the menu bar, panel tabs,
// toolbars, settings panes, dialogs, floating tables, table views and
// multi-selects are dark, with light text. The views draw in their own colors.
const { test, expect } = require('@playwright/test');
const { watchErrors, loadNetwork, launchView, waitForModal } = require('./helpers');

test.describe.configure({ mode: 'serial' });

let page, errors;
test.beforeAll(async ({ browser }) => {
  page = await browser.newPage({ colorScheme: 'dark' });
  errors = watchErrors(page);
  await loadNetwork(page);
});
test.afterAll(() => page.close());

// An element's background (the first one, up its ancestors, that isn't
// see-through) and text, as relative luminance from 0 (black) to 1 (white)
const shade = locator => locator.first().evaluate(el => {
  const lum = color => {
    const [r, g, b] = color.match(/[\d.]+/g).slice(0, 3).map(v => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  // (A faint tint, like a card header's, shows what's under it)
  const seeThrough = color => color == 'transparent' || /rgba/.test(color) && +color.match(/[\d.]+/g)[3] < 0.5;
  let bg = el;
  while (bg && seeThrough(getComputedStyle(bg).backgroundColor)) bg = bg.parentElement;
  return { background: lum(getComputedStyle(bg || document.body).backgroundColor), text: lum(getComputedStyle(el).color) };
});
// (Polled: some colors ease in when the theme changes)
const dark = (locator, name) => expect.poll(async () => {
  const { background, text } = await shade(locator);
  return [name, background < 0.1, text > 0.5];
}).toEqual([name, true, true]);

test('the interface follows the system’s light or dark setting, as it changes', async () => {
  await expect(page.locator('html')).toHaveAttribute('data-bs-theme', 'dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-bs-theme', 'light');
  // Light as it was
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(248, 249, 250)');
  expect(await page.locator('nav.navbar').evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(248, 249, 250)');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-bs-theme', 'dark');
});

test('in dark, the menu bar, tabs, toolbar and settings pane are dark', async () => {
  await dark(page.locator('nav.navbar .nav-link'), 'menu bar');
  await page.locator('nav .dropdown-toggle').first().click();
  await dark(page.locator('.dropdown-menu.show .dropdown-item'), 'menu');
  await page.keyboard.press('Escape');
  await dark(page.locator('.lm_header .lm_tab.lm_active .lm_title'), 'active tab');
  const network = page.locator('.lm_content:has(.network-view)');
  await dark(network.locator('.view-controls .btn-light'), 'toolbar button');
  await network.locator('.settings-toggle').first().click();
  const pane = network.locator('.left-pane');
  await expect(pane).toBeVisible();
  await dark(pane.locator('label').first(), 'settings pane');
  await dark(pane.locator('.card-header button').first(), 'pane section header');
  // A chosen value in a multi-select
  await dark(pane.locator('.ts-wrapper.multi .ts-control > div').first(), 'multi-select item');
  await network.locator('.settings-toggle').first().click();
  // The floating color table
  await dark(page.locator('#link-color-table td').first(), 'color table');
});

test('in dark, dialogs, the threshold histogram and table views are dark', async () => {
  await page.click('#SettingsTab');
  await waitForModal(page, '#global-settings-modal');
  const dialog = page.locator('#global-settings-modal');
  await dark(dialog.locator('.modal-title'), 'dialog');
  // The histogram's bars stand out from the dialog
  expect(await dialog.locator('#link-threshold-sparkline .bar rect').first().evaluate(el => getComputedStyle(el).fill)).not.toBe('rgb(0, 0, 0)');
  await dialog.locator('.btn-close').click();
  await expect(dialog).toBeHidden();
  await launchView(page, 'table');
  const table = page.locator('.lm_content:has(.table-grid)');
  await dark(table.locator('.tabulator-col-title').first(), 'table header');
  await dark(table.locator('.tabulator-row .tabulator-cell').first(), 'table cell');
  expect((await shade(table.locator('.tabulator-tableholder .tabulator-table'))).background).toBeLessThan(0.1);
  // The views keep drawing in their own colors
  expect(await page.evaluate(() => MT.settings.get('background-color'))).toBe('#ffffff');
  expect(errors).toEqual([]);
});
