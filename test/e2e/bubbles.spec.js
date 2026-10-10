// The bubbles view: a bubble per node, grouping by variables, size, selection,
// colors, redraws and export.
const { test, expect } = require('@playwright/test');
const { watchErrors, loadNetwork, launchView, closeView, openExport } = require('./helpers');

test.describe.configure({ mode: 'serial' });

let page, errors;
test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  errors = watchErrors(page);
  await loadNetwork(page);
  await launchView(page, 'bubbles');
});
test.afterAll(() => page.close());

const view = () => page.locator('.lm_content:has(button[title="Export Bubbles"])').first();
const pane = () => view().locator('.left-pane');
const bubbles = () => view().locator('svg circle');
const set = (key, value) => page.evaluate(([key, value]) => MT.settings.set(key, value), [key, value]);
const visible = () => page.evaluate(() => session.data.nodes.filter(d => d.visible).length);

test('draws a bubble per visible node', async () => {
  await expect(bubbles()).toHaveCount(await visible());
});

test('grouping by a variable labels its values', async () => {
  await view().locator('button[title="Bubbles Settings"]').click();
  await expect(pane()).toBeVisible();
  await pane().locator('a', { hasText: 'Physics' }).click();
  await pane().locator('select[data-setting="bubble-x"]').selectOption('state');
  const states = await page.evaluate(() => Array.from(new Set(session.data.nodes.filter(d => d.visible).map(d => d.state == null ? '' : '' + d.state))).sort());
  await expect.poll(() => view().locator('svg .xtitle').allTextContents().then(t => t.sort())).toEqual(states);
  await expect(view().locator('svg .x-label')).toHaveText('State');
  // The bubbles settle into columns, Georgia's left of Utah's
  await expect.poll(() => page.evaluate(() => {
    const x = state => {
      const circles = Array.from(document.querySelectorAll('svg circle')).filter(c => d3.select(c).datum().node.state == state);
      return circles.reduce((s, c) => s + +c.getAttribute('cx'), 0) / circles.length;
    };
    return x('Georgia') < x('Utah');
  }), { timeout: 15000 }).toBe(true);
  await pane().locator('select[data-setting="bubble-x"]').selectOption('None');
  await expect(view().locator('svg .xtitle')).toHaveCount(0);
});

test('the size setting applies', async () => {
  await set('bubble-size', 9);
  await expect(bubbles().first()).toHaveAttribute('r', '9');
});

test('clicking a bubble selects its node', async () => {
  const color = await page.evaluate(() => session.style.widgets['selected-color']);
  await bubbles().first().dispatchEvent('click');
  await expect.poll(() => page.evaluate(() => session.data.nodes.filter(d => d.selected).length)).toBe(1);
  await expect.poll(() => view().locator('svg circle[stroke="' + color + '"]').count()).toBe(1);
  await page.evaluate(() => { session.data.nodes.forEach(d => d.selected = false); MT.events.emit('node-selected'); });
  await expect.poll(() => view().locator('svg circle[stroke="' + color + '"]').count()).toBe(0);
});

test('follows the node color', async () => {
  await page.evaluate(() => { session.style.widgets['node-color'] = '#00ff00'; MT.events.emit('node-color-change'); });
  await expect.poll(() => bubbles().first().getAttribute('fill')).toBe('#00ff00');
});

test('redraws when nodes are hidden', async () => {
  await page.evaluate(() => {
    session.data.nodes.forEach((d, i) => { if (i < 50) d.visible = false; });
    MT.events.emit('node-visibility');
  });
  await expect(bubbles()).toHaveCount(await visible());
  await page.evaluate(() => {
    session.data.nodes.forEach(d => { d.visible = true; });
    MT.events.emit('node-visibility');
  });
  await expect(bubbles()).toHaveCount(await visible());
});

test('reopening the view restores its settings', async () => {
  await closeView(page, 'bubbles');
  await launchView(page, 'bubbles');
  await expect(bubbles()).toHaveCount(await visible());
  await expect(bubbles().first()).toHaveAttribute('r', '9');
});

test('exports a PNG', async () => {
  const modal = await openExport(page, view(), 'Export Bubbles');
  await modal.getByPlaceholder('Filename').fill('bubbles-test');
  const [download] = await Promise.all([page.waitForEvent('download'), modal.locator('button', { hasText: 'Export' }).click()]);
  expect(download.suggestedFilename()).toBe('bubbles-test.png');
  expect(errors).toEqual([]);
});
