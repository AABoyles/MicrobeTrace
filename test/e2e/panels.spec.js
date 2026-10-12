// The page's floating panels (the color tables and the network statistics),
// which sit in the dock of the view in front that shows them; the timeline
// bar below the views; the views' settings panes; and the dialogs' backdrops.
const { test, expect } = require('@playwright/test');
const { watchErrors, loadNetwork, launchView, closeView, waitForModal, openExport } = require('./helpers');

test.describe.configure({ mode: 'serial' });

let page, errors;
test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  errors = watchErrors(page);
  await loadNetwork(page);
  await page.evaluate(() => MT.settings.set('node-color-variable', 'group'));
});
test.afterAll(() => page.close());

const panels = ['link-color-table-wrapper', 'node-color-table-wrapper', 'network-statistics-wrapper'];
// Which view each panel is in (its componentType), or null, and whether it shows
const where = () => page.evaluate(ids => ids.map(id => {
  const panel = document.getElementById(id);
  const item = layout.contentItems.find(item => item.container.element.contains(panel));
  return [item ? item.componentType : null, !!panel.offsetParent];
}), panels);
const boxes = () => page.evaluate(ids => ids.map(id => document.getElementById(id).getBoundingClientRect().toJSON()), panels);
const overlap = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
const front = name => page.evaluate(name => MT.launchView(name), name);

test('the panels sit in the network, one above the other', async () => {
  await expect.poll(where).toEqual([['network', true], ['network', true], ['network', true]]);
  const [link, node, stats] = await boxes();
  expect(overlap(link, node) || overlap(node, stats) || overlap(link, stats)).toBe(false);
  // The statistics at the bottom of the view, the color tables above them
  const view = await page.locator('.lm_content:has(.network-view)').first().boundingBox();
  expect(stats.bottom).toBeLessThanOrEqual(view.y + view.height);
  expect(stats.bottom).toBeGreaterThan(view.y + view.height - 30);
  expect(link.top).toBeLessThan(node.top);
});

test('they still don\'t overlap in a small window', async () => {
  await page.setViewportSize({ width: 1000, height: 600 });
  await expect.poll(async () => {
    const [link, node, stats] = await boxes();
    return overlap(link, node) || overlap(node, stats) || overlap(link, stats);
  }).toBe(false);
  await page.setViewportSize({ width: 1400, height: 900 });
});

test('a view that shows no panels hides them', async () => {
  await launchView(page, 'heatmap');
  await expect.poll(where).toEqual([[null, false], [null, false], [null, false]]);
});

test('a view that draws colors takes the color table for what it draws, but not the statistics', async () => {
  // The histogram charts links, so takes the link color table alone
  await launchView(page, 'histogram');
  await expect.poll(where).toEqual([['histogram', true], [null, false], [null, false]]);
});

test('bringing the network back in front brings the panels back', async () => {
  await front('network');
  await expect.poll(where).toEqual([['network', true], ['network', true], ['network', true]]);
  await front('histogram');
  await expect.poll(where).toEqual([['histogram', true], [null, false], [null, false]]);
});

test('closing the view that has them hands them to the view now in front', async () => {
  await closeView(page, 'histogram');
  await front('network');
  await expect.poll(where).toEqual([['network', true], ['network', true], ['network', true]]);
  await closeView(page, 'heatmap');
  await expect.poll(where).toEqual([['network', true], ['network', true], ['network', true]]);
});

test('a panel\'s menu opens where it was clicked, and dragging moves the panel', async () => {
  const wrapper = page.locator('#node-color-table-wrapper');
  const box = await wrapper.boundingBox();
  await wrapper.click({ button: 'right', position: { x: 20, y: 10 } });
  const menu = page.locator('#node-color-table-context');
  await expect(menu).toBeVisible();
  const at = await menu.boundingBox();
  expect(Math.abs(at.x - (box.x + 20))).toBeLessThan(3);
  expect(Math.abs(at.y - (box.y + 10))).toBeLessThan(3);
  await menu.locator('a', { hasText: 'Drag' }).click();
  const handle = wrapper.locator('.draghandle');
  await expect(handle).toBeVisible();
  const grip = await handle.boundingBox();
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
  await page.mouse.down();
  await page.mouse.move(grip.x + grip.width / 2 - 100, grip.y + grip.height / 2 + 40, { steps: 5 });
  await page.mouse.up();
  const moved = await wrapper.boundingBox();
  expect(Math.round(moved.x - box.x)).toBe(-100);
  expect(Math.round(moved.y - box.y)).toBe(40);
  // Back where it was, and pinned
  await wrapper.evaluate(el => { el.style.translate = ''; });
  await wrapper.click({ button: 'right', position: { x: 20, y: 30 } });
  await menu.locator('a', { hasText: 'Pin' }).click();
  await expect(handle).toBeHidden();
});

test('the views end above the timeline bar, and fill the page again without it', async () => {
  const bottom = () => page.evaluate(() => document.querySelector('.lm_goldenlayout').getBoundingClientRect().bottom);
  const full = await bottom();
  await page.evaluate(() => MT.settings.set('node-timeline-variable', 'date'));
  const bar = page.locator('#global-timeline-wrapper');
  await expect(bar).toBeVisible();
  const top = (await bar.boundingBox()).y;
  await expect.poll(bottom).toBeLessThanOrEqual(top + 1);
  // The bar is opaque, so nothing shows through it
  expect(await bar.evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(248, 249, 250)');
  // The statistics, at the bottom of the network, are above it too
  await expect.poll(async () => (await boxes())[2].bottom).toBeLessThanOrEqual(top);
  await page.evaluate(() => MT.settings.set('node-timeline-variable', 'None'));
  await expect(bar).toBeHidden();
  await expect.poll(bottom).toBe(full);
});

test('a settings pane closes with its close button or Escape', async () => {
  const view = page.locator('.lm_content:has(.network-view)').first();
  const pane = view.locator('.left-pane');
  const toggle = view.locator('.settings-toggle');
  await toggle.click();
  await expect(pane).toBeVisible();
  // Light, with a shadow, rather than the old grey frame
  expect(await pane.evaluate(el => getComputedStyle(el).backgroundColor)).not.toBe('rgb(213, 213, 213)');
  await pane.locator('.pane-close').click();
  await expect(pane).toBeHidden();
  await expect(toggle).not.toHaveClass(/active/);
  await toggle.click();
  await expect(pane).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(pane).toBeHidden();
  // The button opens it again
  await toggle.click();
  await expect(pane).toBeVisible();
  await toggle.click();
  await expect(pane).toBeHidden();
});

test('the files pane moves the file list aside rather than covering it', async () => {
  await launchView(page, 'files');
  const view = page.locator('.lm_content:has(#file-table)').first();
  const list = view.locator('.file-panel');
  await view.locator('button[title="Files Settings"]').click();
  await expect(view.locator('.left-pane')).toBeVisible();
  await expect.poll(() => list.evaluate(el => parseFloat(getComputedStyle(el).paddingLeft))).toBeGreaterThanOrEqual(400);
  await view.locator('.left-pane .pane-close').click();
  await expect.poll(() => list.evaluate(el => parseFloat(getComputedStyle(el).paddingLeft))).toBeLessThan(50);
  await closeView(page, 'files');
});

test('dialogs dim the page, except Global Settings', async () => {
  await page.keyboard.press('Control+s');
  await waitForModal(page, '#session-save-modal');
  await expect(page.locator('.modal-backdrop.show')).toHaveCount(1);
  await page.locator('#session-save-modal .btn-close').click();
  await expect(page.locator('.modal-backdrop')).toHaveCount(0);
  // A view's export dialog dims with its own layer
  const modal = await openExport(page, page.locator('.lm_content:has(.network-view)').first(), 'Export Network');
  expect(await modal.evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgba(0, 0, 0, 0.5)');
  await modal.locator('.btn-close').click();
  await expect(modal).toBeHidden();
  // Global Settings leaves the network in view, to watch changes
  await page.click('#SettingsTab');
  await waitForModal(page, '#global-settings-modal');
  await expect(page.locator('.modal-backdrop')).toHaveCount(0);
  expect(await page.locator('#global-settings-modal').evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
  await page.locator('#global-settings-modal .btn-close').click();
  expect(errors).toEqual([]);
});
