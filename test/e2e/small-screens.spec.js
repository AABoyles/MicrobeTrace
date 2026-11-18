// Small screens and large zoom (#275): the menus fold behind a toggler below
// 1200 px, the settings pane never overflows the window, and nothing makes
// the page scroll sideways at 1024 px or 320 px (400% zoom of 1280 px).
const { test, expect } = require('@playwright/test');
const { watchErrors, loadNetwork } = require('./helpers');

test.describe.configure({ mode: 'serial' });

let page, errors;
test.beforeAll(async ({ browser }) => {
  page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  errors = watchErrors(page);
  await loadNetwork(page);
});
test.afterAll(() => page.close());

const overflowX = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

test('at 1280 px the menus are shown and the toggler is not', async () => {
  await expect(page.locator('.navbar-toggler')).toBeHidden();
  await expect(page.locator('#navbar-menus >> text=File')).toBeVisible();
});

for (const width of [1024, 320]) {
  test(`at ${width} px the toggler opens and closes the menus`, async () => {
    await page.setViewportSize({ width, height: 800 });
    const toggler = page.locator('.navbar-toggler');
    await expect(toggler).toBeVisible();
    await expect(page.locator('#navbar-menus')).toBeHidden();
    await expect(toggler).toHaveAttribute('aria-expanded', 'false');
    await toggler.click();
    await expect(page.locator('#navbar-menus')).toBeVisible();
    await expect(toggler).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#SettingsTab')).toBeVisible();
    // A menu opens from it
    await page.locator('#navbar-menus .nav-link.dropdown-toggle', { hasText: 'File' }).click();
    await expect(page.locator('#NewTab')).toBeVisible();
    await page.locator('#navbar-menus .nav-link.dropdown-toggle', { hasText: 'File' }).click();
    await expect(page.locator('#NewTab')).toBeHidden();
    await expect(page.locator('#navbar-menus.collapse.show')).toBeVisible();
    await toggler.click();
    await expect(page.locator('#navbar-menus')).toBeHidden();
  });

  test(`at ${width} px the settings pane fits the window`, async () => {
    await page.setViewportSize({ width, height: 800 });
    await page.locator('.settings-toggle').first().click();
    const pane = page.locator('.left-pane:visible').first();
    await expect(pane).toBeVisible();
    await expect.poll(async () => (await pane.boundingBox()).x).toBeGreaterThanOrEqual(-1);
    const box = await pane.boundingBox();
    expect(box.width).toBeLessThanOrEqual(width);
    expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
    expect(await overflowX()).toBeLessThanOrEqual(0);
    await page.locator('.settings-toggle').first().click();
  });
}

test('back at 1280 px the layout is as it was', async () => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(page.locator('.navbar-toggler')).toBeHidden();
});

test('no errors', () => expect(errors).toEqual([]));
