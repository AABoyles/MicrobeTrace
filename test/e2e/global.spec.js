// The page around the views: filtering, the color tables and colors, the
// network statistics, search, the global timeline, saving and reopening
// sessions, stashes, shortcuts and New Session.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { watchErrors, loadNetwork, waitForModal } = require('./helpers');

test.describe.configure({ mode: 'serial' });

let page, errors;
// Where the saved session is kept, between the tests that save and open it
const saved = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mt-global-')), 'global-test.microbetrace');
test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  errors = watchErrors(page);
  await loadNetwork(page);
});
test.afterAll(() => page.close());

const dialog = () => page.locator('#global-settings-modal');
const stat = id => page.locator('#' + id).textContent().then(t => parseInt(t.replace(/,/g, '')));
const get = key => page.evaluate(key => session.style.widgets[key], key);
const set = (key, value) => page.evaluate(([key, value]) => MT.settings.set(key, value), [key, value]);
const visible = () => page.evaluate(() => session.data.nodes.filter(d => d.visible).length);

async function openSettings(tab) {
  if (!await dialog().isVisible()) {
    await page.click('#SettingsTab');
    await waitForModal(page, '#global-settings-modal');
  }
  await dialog().locator('.nav-link', { hasText: tab }).click();
}
async function closeSettings() {
  await dialog().locator('.btn-close').click();
  await expect(dialog()).toBeHidden();
}

test('the link threshold filters the links', async () => {
  await openSettings('Filtering');
  const threshold = dialog().locator('input[data-setting="link-threshold"]');
  await expect(threshold).toHaveValue('0.015');
  await threshold.fill('0.005');
  await threshold.press('Enter');
  await expect.poll(() => stat('numberOfVisibleLinks')).toBeLessThan(476);
  expect(await get('link-threshold')).toBe(0.005);
  // A click on the histogram sets it too
  const sparkline = dialog().locator('#link-threshold-sparkline');
  const box = await sparkline.boundingBox();
  await page.mouse.click(box.x + box.width - 2, box.y + box.height / 2);
  await expect.poll(() => get('link-threshold')).toBeGreaterThan(0.005);
  await threshold.fill('0.015');
  await threshold.press('Enter');
  await expect.poll(() => stat('numberOfVisibleLinks')).toBe(476);
});

test('the minimum cluster size hides small clusters, and Reveal shows everything', async () => {
  const size = dialog().locator('input[data-setting="cluster-minimum-size"]');
  await size.fill('5');
  await size.press('Enter');
  await expect.poll(visible).toBeLessThan(310);
  await expect(page.locator('#filtering-wrapper')).toBeHidden();
  await dialog().locator('button', { hasText: 'Everything' }).click();
  await expect.poll(visible).toBe(310);
  await expect(size).toHaveValue('1');
  await expect(page.locator('#filtering-wrapper')).toBeVisible();
});

test('nearest neighbor pruning keeps fewer links', async () => {
  await dialog().locator('label', { hasText: 'Nearest Neighbor' }).click();
  await expect(dialog().locator('.filtering-epsilon-row')).toBeVisible();
  await expect.poll(() => stat('numberOfVisibleLinks'), { timeout: 30000 }).toBeLessThan(476);
  await dialog().locator('label', { has: page.locator('input[data-setting="link-show-nn"][value="false"]') }).click();
  await expect(dialog().locator('.filtering-epsilon-row')).toBeHidden();
  await expect.poll(() => stat('numberOfVisibleLinks')).toBe(476);
});

test('coloring nodes by a variable lists its values in the node color table', async () => {
  await openSettings('Styling');
  await dialog().locator('select[data-setting="node-color-variable"]').selectOption('group');
  const table = page.locator('#node-color-table');
  const groups = await page.evaluate(() => new Set(session.data.nodes.filter(d => d.visible).map(d => d.group)).size);
  await expect(table.locator('input[type=color]')).toHaveCount(groups);
  await expect(page.locator('#node-color-table-wrapper')).toBeVisible();
  await expect(dialog().locator('.node-color-value-row')).toBeHidden();
  // Changing a value's color changes the map
  const first = await table.locator('td[data-value]').first().getAttribute('data-value');
  await table.locator('input[type=color]').first().evaluate(el => { el.value = '#123456'; el.dispatchEvent(new Event('change')); });
  expect(await page.evaluate(v => temp.style.nodeColorMap(v), first)).toBe('#123456');
});

test("the node color table's menu toggles counts and hides it", async () => {
  await closeSettings();
  const wrapper = page.locator('#node-color-table-wrapper');
  await expect(wrapper.locator('th', { hasText: 'Count' })).toHaveCount(1);
  await wrapper.dispatchEvent('contextmenu');
  await page.locator('#node-color-table-context a', { hasText: 'Toggle Counts' }).click();
  await expect(wrapper.locator('th', { hasText: 'Count' })).toHaveCount(0);
  await wrapper.dispatchEvent('contextmenu');
  await page.locator('#node-color-table-context a', { hasText: 'Hide' }).click();
  await expect(wrapper).toBeHidden();
  expect(await get('node-color-table-show')).toBe(false);
  await set('node-color-table-show', true);
  await expect(wrapper).toBeVisible();
  await set('node-color-table-counts', true);
});

test('coloring links by origin lists the files', async () => {
  await set('link-color-variable', 'origin');
  await expect(page.locator('#link-color-table input[type=color]')).toHaveCount(2);
  await set('link-color-variable', 'None');
  await expect(page.locator('#link-color-table-wrapper')).toBeHidden();
});

test('the background color sets its contrasting color', async () => {
  await openSettings('Styling');
  await dialog().locator('input[data-setting="background-color"]').evaluate(el => { el.value = '#000000'; el.dispatchEvent(new Event('change')); });
  expect(await get('background-color-contrast')).toBe('#ffffff');
  await set('background-color', '#ffffff');
  expect(await get('background-color-contrast')).toBe('#000000');
  await closeSettings();
});

test('the statistics panel hides from its menu', async () => {
  const wrapper = page.locator('#network-statistics-wrapper');
  await expect(wrapper).toBeVisible();
  await wrapper.dispatchEvent('contextmenu');
  await page.locator('#network-statistics-context a', { hasText: 'Hide' }).click();
  await expect(wrapper).toBeHidden();
  await set('network-statistics-show', true);
  await expect(wrapper).toBeVisible();
});

test('searching selects the matching nodes', async () => {
  const selected = () => page.evaluate(() => session.data.nodes.filter(d => d.selected).length);
  await page.fill('#search', 'S10');
  await expect.poll(selected).toBeGreaterThan(1);
  await expect.poll(() => stat('numberOfSelectedNodes')).toBe(await selected());
  await expect(page.locator('#search-results li').first()).toBeVisible();
  // Whole words only: just S10 itself
  await page.click('#wholewordbutton');
  await expect.poll(selected).toBe(1);
  await page.click('#wholewordbutton');
  await page.fill('#search', '');
  await expect.poll(selected).toBe(0);
});

test('dates are read as local days, times and spreadsheet values', async () => {
  const read = values => page.evaluate(values => values.map(v => {
    const time = MT.parseDate(v);
    return time && [time.getFullYear(), time.getMonth() + 1, time.getDate(), time.getHours(), time.getMinutes()];
  }), values);
  expect(await read(['2020-03-14', '20200314', '2020-03', '2020', ' 2020-03-14 ', '2020-03-14T10:30', '3/14/2020', 'March 14, 2020']))
    .toEqual([[2020, 3, 14, 0, 0], [2020, 3, 14, 0, 0], [2020, 3, 1, 0, 0], [2020, 1, 1, 0, 0], [2020, 3, 14, 0, 0], [2020, 3, 14, 10, 30], [2020, 3, 14, 0, 0], [2020, 3, 14, 0, 0]]);
  expect(await read(['', null, undefined, 'not a date', '2020-02-30', '2020-13-01'])).toEqual([null, null, null, null, null, null]);
  expect(await page.evaluate(() => [MT.parseDate(0).getTime(), MT.parseDate(new Date(5)).getTime()])).toEqual([0, 5]);
});

test('the global timeline shows the network up to its date', async () => {
  await openSettings('Timeline');
  await dialog().locator('select[data-setting="node-timeline-variable"]').selectOption('date');
  await closeSettings();
  const timeline = page.locator('#global-timeline-wrapper');
  await expect(timeline).toBeVisible();
  await expect(page.locator('#global-timeline-field')).toHaveText('Date');
  const track = page.locator('#global-timeline .track-overlay');
  const box = await track.boundingBox();
  await page.mouse.click(box.x + box.width / 3, box.y + box.height / 2);
  await expect.poll(visible).toBeLessThan(310);
  await set('node-timeline-variable', 'None');
  await expect(timeline).toBeHidden();
  await expect.poll(visible).toBe(310);
});

test('Ctrl+S opens the save dialog, which saves the session', async () => {
  await page.keyboard.press('Control+s');
  await waitForModal(page, '#session-save-modal');
  const modal = page.locator('#session-save-modal');
  await modal.locator('#save-file-name').fill('global-test');
  await modal.locator('#save-file-compress').uncheck();
  const [download] = await Promise.all([page.waitForEvent('download'), modal.locator('#save-data').click()]);
  expect(download.suggestedFilename()).toBe('global-test.microbetrace');
  fs.copyFileSync(await download.path(), saved);
  // Saving closes the dialog
  await expect(modal).toBeHidden();
});

test('New Session starts over with the default settings', async () => {
  expect(await get('node-color-variable')).toBe('group');
  await page.locator('nav .dropdown-toggle', { hasText: 'File' }).click();
  await page.click('#NewTab');
  await waitForModal(page, '#exit-modal');
  await page.click('#exit-button');
  await page.waitForFunction(() => layout.contentItems.some(i => i.componentType == 'files'));
  expect(await get('node-color-variable')).toBe('None');
  expect(await page.evaluate(() => MT.defaultWidgets['node-color-variable'])).toBe('None');
  await expect(page.locator('#node-color-table-wrapper')).toBeHidden();
});

test('a saved session opens as it was saved', async () => {
  await page.setInputFiles('#OpenTab', saved);
  await page.waitForFunction(() => session.data.nodes.length == 310 && document.getElementById('numberOfNodes').textContent == '310', null, { timeout: 60000 });
  expect(await get('node-color-variable')).toBe('group');
  await expect(page.locator('#node-color-table-wrapper')).toBeVisible();
  await openSettings('Styling');
  await expect(dialog().locator('select[data-setting="node-color-variable"]')).toHaveValue('group');
  await closeSettings();
});

test('a stashed session can be recalled', async () => {
  await page.locator('nav .dropdown-toggle', { hasText: 'File' }).click();
  await page.click('#StashDataTab');
  await waitForModal(page, '#session-stash-modal');
  await page.fill('#stash-name', 'global-stash');
  await page.click('#stash-data');
  await expect(page.locator('.alertify-notifier')).toContainText('Stashed');
  // Stashing closes the dialog
  await expect(page.locator('#session-stash-modal')).toBeHidden();
  // Recalled into a new session
  await page.locator('nav .dropdown-toggle', { hasText: 'File' }).click();
  await page.click('#NewTab');
  await waitForModal(page, '#exit-modal');
  await page.click('#exit-button');
  await page.waitForFunction(() => session.data.nodes.length == 0);
  await page.locator('nav .dropdown-toggle', { hasText: 'File' }).click();
  await page.click('#RecallDataTab');
  await waitForModal(page, '#session-recall-modal');
  const row = page.locator('#recall-stashes-available .tabulator-row', { hasText: 'global-stash' });
  await expect(row).toHaveCount(1);
  await row.click();
  await expect(row).toHaveClass(/tabulator-selected/);
  await page.click('#recall-load-stash');
  await page.waitForFunction(() => session.data.nodes.length == 310 && document.getElementById('numberOfNodes').textContent == '310', null, { timeout: 60000 });
  expect(await get('node-color-variable')).toBe('group');
  expect(errors).toEqual([]);
});
