// The golden-layout panel: tabs, splitting, resizing, saving and restoring the
// layout, closing every view, and New Session.
const { test, expect } = require('@playwright/test');
const { watchErrors, loadNetwork, launchView, viewNames } = require('./helpers');

test.describe.configure({ mode: 'serial' });

let page, errors;
test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  errors = watchErrors(page);
  await loadNetwork(page);
});
test.afterAll(() => page.close());

const tabs = () => page.evaluate(() => [...document.querySelectorAll('.lm_tab')].map(t => t.textContent.trim() + (t.classList.contains('lm_active') ? '*' : '')));
const savedLayout = () => page.evaluate(() => session.layout);

test('opening views adds active tabs', async () => {
  expect(await viewNames(page)).toEqual(['network']);
  await launchView(page, 'table');
  await launchView(page, 'histogram');
  expect(await tabs()).toEqual(['Network', 'Table', 'Histogram*']);
  await expect.poll(savedLayout).toEqual({ type: 'stack', content: [{ type: 'network' }, { type: 'table' }, { type: 'histogram' }] });
});

test('clicking a tab or relaunching a view activates it', async () => {
  await page.click('.lm_tab >> nth=0');
  await expect.poll(tabs).toEqual(['Network*', 'Table', 'Histogram']);
  await launchView(page, 'table');
  await expect.poll(tabs).toEqual(['Network', 'Table*', 'Histogram']);
});

test('dragging a tab to the edge splits the panel', async () => {
  const tab = await page.locator('.lm_tab', { hasText: 'Histogram' }).boundingBox();
  const panel = await page.locator('#main-panel').boundingBox();
  await page.mouse.move(tab.x + tab.width / 2, tab.y + tab.height / 2);
  await page.mouse.down();
  await page.mouse.move(tab.x + 60, tab.y + 60, { steps: 5 });
  await page.mouse.move(panel.x + panel.width - 40, panel.y + panel.height / 2, { steps: 15 });
  await page.mouse.up();
  await expect.poll(savedLayout).toEqual({
    type: 'row',
    content: [
      { type: 'stack', content: [{ type: 'network' }, { type: 'table' }] },
      { type: 'stack', content: [{ type: 'histogram' }] }
    ]
  });
});

test('stacks resize with the window', async () => {
  const widths = () => page.evaluate(() => [...document.querySelectorAll('.lm_stack')].map(s => Math.round(s.getBoundingClientRect().width)));
  const before = await widths();
  await page.setViewportSize({ width: 1000, height: 800 });
  await expect.poll(async () => (await widths()).reduce((a, b) => a + b, 0)).toBeLessThan(before.reduce((a, b) => a + b, 0) - 300);
  await page.setViewportSize({ width: 1400, height: 900 });
});

test('a saved layout reloads with all its views', async () => {
  const saved = await savedLayout();
  await page.evaluate(saved => MT.loadLayout(saved), saved);
  await expect.poll(() => viewNames(page)).toEqual(['network', 'table', 'histogram']);
  await expect.poll(savedLayout).toEqual(saved);
  // As launching them one by one did, the last view in each stack is active
  await expect.poll(tabs).toEqual(['Network', 'Table*', 'Histogram*']);
});

test('the old names of the network view open it, once', async () => {
  await page.evaluate(() => MT.loadLayout({ type: 'row', content: [
    { type: 'stack', content: [{ type: '2d_network' }, { type: 'table' }] },
    { type: 'stack', content: [{ type: 'pixi' }, { type: '3d_network' }] }
  ] }));
  await expect.poll(() => viewNames(page)).toEqual(['network', 'table']);
  await page.evaluate(() => MT.launchView('3d_network'));
  await expect.poll(tabs).toEqual(['Network*', 'Table']);
  expect(await viewNames(page)).toEqual(['network', 'table']);
  expect(errors).toEqual([]);
});

test('closing every view leaves an empty layout, and views launch again', async () => {
  while (await page.locator('.lm_tab .lm_close_tab').count()) {
    await page.locator('.lm_tab .lm_close_tab').first().click();
  }
  await expect.poll(() => viewNames(page)).toEqual([]);
  // golden-layout throttles stateChanged, so the saved layout can lag a moment
  await expect.poll(savedLayout).toEqual({ type: 'stack', content: [] });
  await launchView(page, 'table');
  await expect.poll(tabs).toEqual(['Table*']);
});

test('New Session shows the files view and keeps saving the layout', async () => {
  await page.evaluate(() => MT.reset());
  await expect.poll(() => viewNames(page)).toEqual(['files']);
  await launchView(page, 'table');
  await expect.poll(savedLayout).toEqual({ type: 'stack', content: [{ type: 'files' }, { type: 'table' }] });
  expect(errors).toEqual([]);
});
