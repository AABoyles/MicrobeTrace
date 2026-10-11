// How controls and text look: links, toggle groups, buttons, focus, the color
// tables' controls, color settings, panel tabs, settings labels and the
// network statistics.
const { test, expect } = require('@playwright/test');
const { watchErrors, loadNetwork, launchView, waitForModal, openExport } = require('./helpers');

test.describe.configure({ mode: 'serial' });

let page, errors;
test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  errors = watchErrors(page);
  await loadNetwork(page);
});
test.afterAll(() => page.close());

const style = (locator, ...props) => locator.evaluate((el, props) => {
  const cs = getComputedStyle(el);
  return Object.fromEntries(props.map(p => [p, cs[p]]));
}, props);
const primary = () => page.evaluate(() => getComputedStyle(document.body).getPropertyValue('--bs-primary').trim());
const rgb = hex => `rgb(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)})`;
const settings = () => page.locator('#global-settings-modal');
async function openSettings(tab) {
  await page.click('#SettingsTab');
  await waitForModal(page, '#global-settings-modal');
  await settings().locator('.nav-link', { hasText: tab }).click();
}
const closeSettings = () => settings().locator('.btn-close').click();

test('links look like links, and say where they go', async () => {
  await page.locator('nav .dropdown-toggle', { hasText: 'Help' }).click();
  await page.click('#AboutTab');
  await waitForModal(page, '#about-modal');
  const link = page.locator('#about-modal a', { hasText: 'Read the MicrobeTrace wiki' });
  await expect(link).toBeVisible();
  const look = await style(link, 'color', 'textDecorationLine');
  expect(look.color).not.toBe('rgb(85, 85, 85)');
  expect(look.textDecorationLine).toBe('underline');
  await expect(page.locator('#about-modal')).not.toContainText(/click here/i);
  await page.locator('#about-modal .btn-close').click();
});

test("a toggle group's chosen option is marked in the primary color", async () => {
  await openSettings('Filtering');
  const chosen = settings().locator('label.active', { has: page.locator('[data-setting="network-statistics-show"]') });
  const other = settings().locator('label:not(.active)', { has: page.locator('[data-setting="network-statistics-show"]') });
  const [on, off] = [await style(chosen, 'borderColor', 'fontWeight', 'backgroundColor'), await style(other, 'backgroundColor')];
  expect(on.borderColor).toBe(rgb(await primary()));
  expect(on.fontWeight).toBe('500');
  expect(on.backgroundColor).not.toBe(off.backgroundColor);
  expect(on.backgroundColor).not.toBe('rgb(211, 212, 213)');
});

test('settings labels have room enough not to wrap', async () => {
  const label = settings().locator('label', { hasText: 'Minimum Cluster Size' });
  const lineHeight = await label.evaluate(el => parseFloat(getComputedStyle(el).lineHeight));
  expect((await label.boundingBox()).height).toBeLessThan(lineHeight * 1.5);
  await closeSettings();
});

test('color settings show a swatch and its value', async () => {
  await openSettings('Styling');
  const input = settings().locator('input[data-setting="node-color-border"]');
  expect((await input.boundingBox()).width).toBeLessThan(60);
  const value = settings().locator('input[data-setting="node-color-border"] + .color-value');
  await expect(value).toHaveText('#000000');
  await page.evaluate(() => MT.settings.set('node-color-border', '#123456'));
  await expect(value).toHaveText('#123456');
  await page.evaluate(() => MT.settings.set('node-color-border', '#000000'));
  await closeSettings();
});

test('primary buttons use one blue in every state, and secondary actions are not primary', async () => {
  const view = page.locator('.lm_content:has(.network-view)').first();
  const modal = await openExport(page, view, 'Export Network');
  const exportButton = await style(modal.locator('.export-button'), 'backgroundColor', 'borderColor');
  expect(exportButton.backgroundColor).toBe(rgb(await primary()));
  expect(exportButton.borderColor).toBe(rgb(await primary()));
  // Advanced is a link that opens more options, without a button's border
  const advanced = modal.locator('.export-advanced-button');
  await expect(advanced).toHaveClass(/btn-link/);
  expect((await style(advanced, 'borderTopColor')).borderTopColor).toBe('rgba(0, 0, 0, 0)');
  // Cancel is a secondary button, still with a button's border
  const cancel = modal.locator('button', { hasText: 'Cancel' });
  await expect(cancel).toHaveClass(/btn-secondary/);
  expect((await style(cancel, 'borderTopColor')).borderTopColor).not.toBe('rgba(0, 0, 0, 0)');
  // Closed from the keyboard, the dialog leaves its button focused, shown by a
  // ring rather than a pressed look
  await page.keyboard.press('Escape');
  await expect(modal).toBeHidden();
  const button = view.locator('button[title="Export Network"]');
  await expect.poll(() => button.evaluate(el => el.matches(':focus-visible'))).toBe(true);
  const focused = await style(button, 'backgroundColor', 'boxShadow');
  const plain = await style(view.locator('button[title="Toggle Network Settings"], .settings-toggle').first(), 'backgroundColor');
  expect(focused.backgroundColor).toBe(plain.backgroundColor);
  expect(focused.boxShadow).not.toBe('none');
  await button.blur();
  // Leave Session's Cancel isn't styled as the main action
  await page.locator('nav .dropdown-toggle', { hasText: 'File' }).click();
  await page.click('#NewTab');
  await waitForModal(page, '#exit-modal');
  await expect(page.locator('#exit-modal button', { hasText: 'Cancel' })).not.toHaveClass(/btn-primary/);
  await page.locator('#exit-modal button', { hasText: 'Cancel' }).click();
  await expect(page.locator('#exit-modal')).toBeHidden();
});

test("the color tables' controls are labelled icons, and values sort by name", async () => {
  await page.evaluate(() => MT.settings.set('node-color-variable', 'group'));
  const table = page.locator('#node-color-table');
  await expect(table.locator('td[data-value]')).toHaveCount(5);
  // Ascending by the raw values, where the empty one's key comes after "g3"
  expect(await table.locator('td[data-value]').allTextContents()).toEqual(['G0', 'G1', 'G2', 'G3', '(Empty)']);
  await expect(table.locator('th [title="Sort"] .bi-arrow-down-up').first()).toBeVisible();
  await expect(table.locator('td [title="Transparency"] .bi-droplet-half')).toHaveCount(5);
  await expect(table.locator('td[data-value]').first()).toHaveAttribute('title', 'Double-click to rename');
  // Sorting still flips the order
  await table.locator('th').first().locator('[title="Sort"]').click();
  await expect.poll(async () => (await table.locator('td[data-value]').allTextContents())[0]).toBe('(Empty)');
  await table.locator('th').first().locator('[title="Sort"]').click();
  await expect.poll(async () => (await table.locator('td[data-value]').allTextContents())[0]).toBe('G0');
});

test('panel tabs are 13px, closer to the menus', async () => {
  expect((await style(page.locator('.lm_tab').first(), 'fontSize')).fontSize).toBe('13px');
});

test("a view's settings labels don't wrap", async () => {
  await launchView(page, 'crosstab');
  // (It opens drawn, with its settings closed)
  await page.locator('.lm_content:has(.crosstab-x) .settings-toggle').click();
  const label = page.locator('.lm_content:has(.crosstab-x) label', { hasText: 'X Variable' }).first();
  await expect(label).toBeVisible();
  const lineHeight = await label.evaluate(el => parseFloat(getComputedStyle(el).lineHeight));
  expect((await label.boundingBox()).height).toBeLessThan(lineHeight * 1.5);
  await page.evaluate(() => MT.launchView('network'));
});

test('the statistics read as sentences', async () => {
  const stats = page.locator('#network-statistics-table');
  await expect(stats).toContainText('310 nodes, 0 selected');
  await expect(stats).toContainText('476 links');
  expect(errors).toEqual([]);
});
