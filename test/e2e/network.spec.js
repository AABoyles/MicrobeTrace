// The 2D network's tooltip-variables menu (the view itself is covered by
// views.spec.js).
const { test, expect } = require('@playwright/test');
const { watchErrors, loadNetwork } = require('./helpers');

test.describe.configure({ mode: 'serial' });

let page, errors;
test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  errors = watchErrors(page);
  await loadNetwork(page);
  await page.click('#network-settings-toggle');
  await expect(page.locator('#node-controls-labels')).toBeVisible();
});
test.afterAll(() => page.close());

const menu = () => page.locator('#node-controls-labels .ts-wrapper');
const chosen = () => menu().locator('.item').evaluateAll(items => items.map(i => i.dataset.value));
const setting = () => page.evaluate(() => [].concat(session.style.widgets['node-tooltip-variable']));

async function choose(title) {
  await menu().locator('input').fill(title);
  await expect(page.locator('.ts-dropdown .option.active').first()).toHaveText(title);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
}

test('starts with the node ID only', async () => {
  expect(await chosen()).toEqual(['_id']);
});

test('variables can be added, up to three', async () => {
  await choose('Group');
  await expect.poll(setting).toEqual(['_id', 'group']);
  await choose('State');
  await expect.poll(setting).toEqual(['_id', 'group', 'state']);
  // The menu takes no more than three
  await menu().locator('input').fill('Degree');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  expect(await chosen()).toEqual(['_id', 'group', 'state']);
});

test('variables can be removed', async () => {
  await menu().locator('.item[data-value="group"] .remove').click();
  await expect.poll(setting).toEqual(['_id', 'state']);
  expect(errors).toEqual([]);
});
