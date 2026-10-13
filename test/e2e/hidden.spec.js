// Nothing hidden behind anything else: the view tabs below a menu bar that
// wraps in a narrow window; the dialogs of the table views and of Sequence
// Settings covering the menu bar, as every other dialog does; the table's
// column picker's menu opening over the page; a
// search without matches saying so in the search box; the link threshold's
// histogram in its column, marking the threshold; and the table's pinned
// selected rows in line with the rest.
const { test, expect } = require('@playwright/test');
const { watchErrors, open, fixtures, loadNetwork, launchView, closeView, openExport, waitForModal } = require('./helpers');

test.describe.configure({ mode: 'serial' });

let page, errors;
test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  errors = watchErrors(page);
  await loadNetwork(page);
});
test.afterAll(() => page.close());

// What's drawn at the middle of an element, and whether it's that element
const onTop = locator => locator.evaluate(el => {
  const r = el.getBoundingClientRect();
  const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return !!hit && (el === hit || el.contains(hit));
});
// Whether a dialog covers the menu bar (it dims the whole page)
const menuBarCovered = () => page.evaluate(() => {
  const nav = document.querySelector('nav.navbar').getBoundingClientRect();
  const hit = document.elementFromPoint(nav.left + nav.width / 2, nav.top + nav.height / 2);
  return !!hit && !!hit.closest('.modal');
});

test('in a narrow window, the menu bar wraps above the view tabs, not over them', async () => {
  await page.setViewportSize({ width: 960, height: 640 });
  await expect.poll(() => page.evaluate(() => document.querySelector('nav.navbar').offsetHeight)).toBeGreaterThan(50);
  const tab = page.locator('.lm_tab').first();
  await expect.poll(() => onTop(tab)).toBe(true);
  await expect.poll(() => tab.evaluate(el => el.getBoundingClientRect().top >= document.querySelector('nav.navbar').getBoundingClientRect().bottom)).toBe(true);
  // A tab can be clicked
  await launchView(page, 'histogram');
  await page.locator('.lm_tab', { hasText: 'Network' }).click();
  await expect.poll(() => page.evaluate(() => layout.contentItems.find(i => i.componentType == 'network').parent.getActiveComponentItem().componentType)).toBe('network');
  await closeView(page, 'histogram');
  await page.setViewportSize({ width: 1400, height: 900 });
});

test('the table views’ export dialogs cover the menu bar', async () => {
  for (const [view, title] of [['table', 'Export table data'], ['aggregation', 'Export Aggregation data'], ['crosstab', 'Export crosstab data']]) {
    await launchView(page, view);
    const modal = await openExport(page, page.locator(`.lm_content:has(button[title="${title}"])`), title);
    expect([view, await menuBarCovered()]).toEqual([view, true]);
    await modal.locator('.btn-close').click();
    await expect(modal).toBeHidden();
    await closeView(page, view);
  }
});

test('the table’s column picker’s menu opens over the page', async () => {
  await launchView(page, 'table');
  const view = page.locator('.lm_content:has(.table-grid)');
  // The column menu is in the page body, above the views
  await view.locator('.ts-control input').click();
  const menu = page.locator('body > .ts-dropdown:visible');
  await expect(menu).toBeVisible();
  expect(await onTop(menu.locator('.option').first())).toBe(true);
  await page.keyboard.press('Escape');
});

test('the table’s pinned selected rows line up with the rest', async () => {
  await launchView(page, 'table');
  const view = page.locator('.lm_content:has(.table-grid)');
  await view.locator('.tabulator-tableholder .tabulator-row').nth(7).locator('.tabulator-cell').nth(1).click();
  const pinned = view.locator('.tabulator-header .tabulator-frozen-rows-holder .tabulator-row');
  await expect(pinned).toHaveCount(1);
  const cell = row => row.locator('.tabulator-cell').nth(1).evaluate(el => {
    const range = document.createRange();
    range.selectNodeContents(el);
    return { left: Math.round(range.getBoundingClientRect().left), weight: getComputedStyle(el).fontWeight };
  });
  expect(await cell(pinned)).toEqual(await cell(view.locator('.tabulator-tableholder .tabulator-row').first()));
  // Deselect it again
  await pinned.locator('.tabulator-cell').nth(1).click();
  await expect(pinned).toHaveCount(0);
  await closeView(page, 'table');
});

test('a search without matches says so in the search box', async () => {
  await page.fill('#search', 'nothing-is-called-this');
  await expect(page.locator('#search')).toHaveClass(/is-invalid/);
  await expect(page.locator('#search-results li.no-matches')).toHaveText('No matches');
  await expect(page.locator('.alertify-notifier .ajs-message', { hasText: 'No matches' })).toHaveCount(0);
  // A match clears it
  await page.fill('#search', 'S1');
  await expect(page.locator('#search')).not.toHaveClass(/is-invalid/);
  await expect(page.locator('#search-results li.no-matches')).toHaveCount(0);
  await page.fill('#search', '');
});

test('the link threshold’s histogram sits in its column and marks the threshold', async () => {
  await page.click('#SettingsTab');
  await waitForModal(page, '#global-settings-modal');
  const dialog = page.locator('#global-settings-modal');
  const box = el => el.evaluate(e => { const r = e.getBoundingClientRect(); return { left: Math.round(r.left), right: Math.round(r.right), top: r.top, width: r.width }; });
  const sparkline = await box(dialog.locator('#link-threshold-sparkline'));
  const input = await box(dialog.locator('#link-threshold'));
  const other = await box(dialog.locator('#cluster-minimum-size'));
  expect([sparkline.left, input.left]).toEqual([other.left, other.left]);
  expect(sparkline.right).toBe(other.right);
  expect(input.top).toBeGreaterThan(sparkline.top);
  // The mark is at the threshold, and moves to where the histogram is clicked
  const mark = () => page.evaluate(() => {
    const svg = document.getElementById('link-threshold-sparkline'), line = svg.querySelector('line.threshold-mark');
    return line.getBoundingClientRect().left - svg.getBoundingClientRect().left;
  });
  const before = await mark();
  const r = await dialog.locator('#link-threshold-sparkline').boundingBox();
  await page.mouse.click(r.x + r.width * 0.25, r.y + r.height / 2);
  await expect.poll(mark).not.toBeCloseTo(before, 0);
  expect(Math.abs(await mark() - r.width * 0.25)).toBeLessThan(3);
  // The threshold set is the value under the pointer: the visible links are within it
  const threshold = await page.evaluate(() => MT.settings.get('link-threshold'));
  const bounds = await page.evaluate(() => { let lo = Infinity, hi = -Infinity; session.data.graph.forEachValue('distance', v => { lo = Math.min(lo, +v); hi = Math.max(hi, +v); }); return [lo, hi]; });
  // (to three places, and within a pixel)
  expect(Math.abs(threshold - (bounds[0] + (bounds[1] - bounds[0]) * 0.25))).toBeLessThan(0.003);
  await dialog.locator('#link-threshold').fill('0.015');
  await dialog.locator('#link-threshold').press('Enter');
  await dialog.locator('.btn-close').click();
  await expect(dialog).toBeHidden();
  expect(errors).toEqual([]);
});

test('Sequence Settings covers the menu bar', async ({ browser }) => {
  const fresh = await browser.newPage();
  const freshErrors = watchErrors(fresh);
  await open(fresh);
  await fresh.setInputFiles('#data-files', fixtures);
  await fresh.locator('button', { hasText: 'Sequence Settings' }).click();
  await waitForModal(fresh, '#sequence-controls-modal');
  const covered = await fresh.evaluate(() => {
    const nav = document.querySelector('nav.navbar').getBoundingClientRect();
    const hit = document.elementFromPoint(nav.left + nav.width / 2, nav.top + nav.height / 2);
    return !!hit && !!hit.closest('.modal');
  });
  expect(covered).toBe(true);
  expect(freshErrors).toEqual([]);
  await fresh.close();
});
