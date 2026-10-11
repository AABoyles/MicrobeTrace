// The network view: drawing the nodes and links, their sizes, shapes, colors,
// labels and tooltips, selection, pinning, polygons, the physics settings,
// restoring and export.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const { imageStats, watchErrors, loadNetwork, launchView, closeView, openExport, waitForModal } = require('./helpers');

test.describe.configure({ mode: 'serial' });

let page, errors;
test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  errors = watchErrors(page);
  await loadNetwork(page);
  await page.waitForFunction(() => temp.network && temp.network.points.length > 0);
});
test.afterAll(() => page.close());

const view = () => page.locator('.lm_content:has(button[title="Export Network"])').first();
const pane = () => view().locator('.left-pane');
const set = (key, value) => page.evaluate(([key, value]) => MT.settings.set(key, value), [key, value]);
const visible = () => page.evaluate(() => session.data.nodes.filter(d => d.visible).length);
// The graph's per-point sizes, and the distinct values among them
const sizes = () => page.evaluate(() => Array.from(temp.network.graph.getPointSizes()));
const distinct = values => new Set(values.map(v => Math.round(v * 1000))).size;
// Where point i is on the page
const at = i => page.evaluate(i => {
  const { graph } = temp.network;
  const p = graph.getPointPositions();
  const [x, y] = graph.spaceToScreenPosition([p[2 * i], p[2 * i + 1]]);
  const box = document.querySelector('.lm_content canvas').parentElement.getBoundingClientRect();
  return [box.left + x, box.top + y];
}, i);

async function openSettings(tab, section) {
  if (!await pane().isVisible()) await view().locator('button[title="Network Settings"]').click();
  await expect(pane()).toBeVisible();
  if (tab) await pane().locator('.nav-link', { hasText: tab }).click();
  // Each tab's settings are in sections, one open at a time
  if (section) {
    const body = pane().locator('#' + section);
    if (!await body.evaluate(el => el.classList.contains('show'))) await pane().locator(`button[data-bs-target="#${section}"]`).click();
    await expect(body).toHaveClass(/(^| )show( |$)/);
  }
}

test('draws the visible nodes and links', async () => {
  expect(await page.evaluate(() => temp.network.points.length)).toBe(await visible());
  expect(await page.evaluate(() => temp.network.links.length)).toBe(476);
});

test('the node size setting applies, and sizing by a variable spreads them', async () => {
  await openSettings('Nodes', 'node-controls-shapes');
  const before = await sizes();
  await set('node-radius', 1000);
  await expect.poll(async () => (await sizes())[0]).toBeGreaterThan(before[0]);
  expect(distinct(await sizes())).toBe(1);
  await pane().locator('select[data-setting="node-radius-variable"]').selectOption('degree');
  await expect.poll(async () => distinct(await sizes())).toBeGreaterThan(1);
  // The rows for one size give way to the rows for a range
  await expect(pane().locator('input[data-setting="node-radius-max"]')).toBeVisible();
  await expect(pane().locator('input[data-setting="node-radius"]')).toBeHidden();
  await set('node-radius-variable', 'None');
  await expect.poll(async () => distinct(await sizes())).toBe(1);
});

test('shaping by a variable lists its values, each with a shape', async () => {
  await pane().locator('select[data-setting="node-symbol-variable"]').selectOption('state');
  const table = view().locator('.node-symbol-table');
  await expect(table).toBeVisible();
  const states = await page.evaluate(() => new Set(session.data.nodes.filter(d => d.visible).map(d => d.state)).size);
  await expect(table.locator('tr:has(select)')).toHaveCount(states);
  await table.locator('tr:has(select)').first().locator('select').selectOption('symbolStar');
  await expect.poll(() => page.evaluate(() => temp.style.nodeSymbolMap(temp.style.nodeSymbolMap.domain()[0]))).toBe('symbolStar');
  await set('node-symbol-variable', 'None');
  await expect(table).toBeHidden();
});

test('follows the node colors', async () => {
  await page.evaluate(() => { session.style.widgets['node-color'] = '#ff0000'; MT.events.emit('node-color-change'); });
  await expect.poll(() => page.evaluate(() => Array.from(temp.network.graph.getPointColors().slice(0, 4)).map(v => Math.round(v * 255)))).toEqual([255, 0, 0, 255]);
});

test('labels show the label variable', async () => {
  await openSettings('Nodes', 'node-controls-labels');
  await pane().locator('select[data-setting="node-label-variable"]').selectOption('_id');
  await expect.poll(() => page.evaluate(() => temp.network.drawn.labels)).toBeGreaterThan(0);
  await expect(pane().locator('input[data-setting="node-label-size"]')).toBeVisible();
  await set('node-label-variable', 'None');
  await expect.poll(() => page.evaluate(() => temp.network.drawn.labels)).toBe(0);
  await expect(pane().locator('input[data-setting="node-label-size"]')).toBeHidden();
});

test('hovering a node shows its tooltip', async () => {
  // Stop the layout so nothing moves under the mouse
  await page.evaluate(() => temp.network.graph.pause());
  // A node that nothing (the settings, the color tables) floats over
  const i = await page.evaluate(() => {
    const { graph, points } = temp.network;
    const p = graph.getPointPositions();
    const canvas = document.querySelector('.network-cosmos canvas');
    const box = canvas.getBoundingClientRect();
    return points.findIndex((d, i) => {
      const [x, y] = graph.spaceToScreenPosition([p[2 * i], p[2 * i + 1]]);
      return document.elementFromPoint(box.left + x, box.top + y) === canvas;
    });
  });
  expect(i).toBeGreaterThanOrEqual(0);
  const [x, y] = await at(i);
  await page.mouse.move(x, y);
  const id = await page.evaluate(i => temp.network.points[i]._id, i);
  await expect(page.locator('#tooltip')).toContainText(id);
  await page.mouse.move(5, 5);
});

test('the link settings apply', async () => {
  await openSettings('Links', 'link-controls-shapes');
  await set('link-width', 9);
  await expect.poll(() => page.evaluate(() => temp.network.graph.getLinkWidths()[0])).toBe(9);
  await set('link-width-variable', 'distance');
  await expect.poll(() => page.evaluate(() => new Set(temp.network.graph.getLinkWidths()).size)).toBeGreaterThan(1);
  await set('link-width-variable', 'None');
  await set('link-opacity', 0.5);
  await expect.poll(() => page.evaluate(() => temp.network.graph.config.linkOpacity)).toBe(0.5);
  await pane().locator('label', { has: page.locator('input[data-setting="link-directed"][value="true"]') }).click();
  await expect.poll(() => page.evaluate(() => session.style.widgets['link-directed'])).toBe(true);
  await set('link-directed', false);
});

test('the physics settings apply', async () => {
  await set('node-charge', 300);
  await expect.poll(() => page.evaluate(() => temp.network.graph.config.simulationRepulsion)).toBeCloseTo(24);
  await set('network-gravity', 0.2);
  await expect.poll(() => page.evaluate(() => temp.network.graph.config.simulationGravity)).toBeCloseTo(0.2);
});

test('polygons group the nodes, and can be colored by group', async () => {
  await openSettings('Polygons', 'polygons-controls-labels');
  await pane().locator('label', { has: page.locator('input[data-setting="polygons-show"][value="true"]') }).click();
  await expect.poll(() => page.evaluate(() => temp.network.drawn.polygons)).toBeGreaterThan(0);
  await pane().locator('label', { has: page.locator('input[data-setting="polygons-color-show"][value="true"]') }).click();
  // Coloring them doesn't hide them (the two toggles once shared a radio group)
  expect(await page.evaluate(() => session.style.widgets['polygons-show'])).toBe(true);
  const table = view().locator('.polygon-color-table');
  await expect(table).toBeVisible();
  await expect.poll(() => table.locator('input[type=color]').count()).toBeGreaterThan(0);
  await set('polygons-color-show', false);
  await expect(table).toBeHidden();
  await set('polygons-show', false);
  await expect.poll(() => page.evaluate(() => temp.network.drawn.polygons)).toBe(0);
});

test('Ctrl+dragging selects the nodes inside', async () => {
  await view().locator('button[title="Network Settings"]').click();
  await expect(pane()).toBeHidden();
  const box = await view().locator('canvas').first().boundingBox();
  await page.keyboard.down('Control');
  await page.mouse.move(box.x + 2, box.y + 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 2, box.y + box.height - 2, { steps: 5 });
  await page.mouse.up();
  await page.keyboard.up('Control');
  await expect.poll(() => page.evaluate(() => session.data.nodes.filter(d => d.selected).length)).toBeGreaterThan(0);
  const selected = await page.evaluate(() => session.data.nodes.filter(d => d.selected).length);
  expect(await page.evaluate(() => (temp.network.graph.config.outlinedPointIndices || []).length)).toBe(selected);
  await page.evaluate(() => { session.data.nodes.forEach(d => d.selected = false); MT.events.emit('node-selected'); });
  await expect.poll(() => page.evaluate(() => temp.network.graph.config.outlinedPointIndices)).toBeUndefined();
});

test('the pin button pins every node, and unpins them', async () => {
  await view().locator('button[title="Pin all Nodes"]').click();
  await expect.poll(() => page.evaluate(() => temp.network.points.every(d => d.fixed))).toBe(true);
  await view().locator('button[title="Pin all Nodes"]').click();
  await expect.poll(() => page.evaluate(() => temp.network.points.some(d => d.fixed))).toBe(false);
});

test("a node's context menu pins it and shows its attributes", async () => {
  await page.evaluate(() => temp.network.contextMenu(0, new MouseEvent('contextmenu', { clientX: 300, clientY: 300 })));
  const menu = view().locator('.network-context-menu');
  await expect(menu).toBeVisible();
  await menu.locator('a', { hasText: 'Pin Node' }).click();
  expect(await page.evaluate(() => temp.network.points[0].fixed)).toBe(true);
  await page.evaluate(() => temp.network.contextMenu(0, new MouseEvent('contextmenu', { clientX: 300, clientY: 300 })));
  await expect(menu.locator('a', { hasText: 'Unpin Node' })).toBeVisible();
  await menu.locator('a', { hasText: 'View Attributes' }).click();
  await waitForModal(page, '.modal.show');
  const id = await page.evaluate(() => temp.network.points[0]._id);
  await expect(page.locator('.modal.show tbody')).toContainText(id);
  await page.locator('.modal.show button', { hasText: 'OK' }).click();
});

test("a node's context menu copies its ID and sequence", async () => {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  const menu = view().locator('.network-context-menu');
  const clipboard = () => page.evaluate(() => navigator.clipboard.readText());
  const [id, seq] = await page.evaluate(() => [temp.network.points[0]._id, temp.network.points[0].seq]);
  await page.evaluate(() => temp.network.contextMenu(0, new MouseEvent('contextmenu', { clientX: 300, clientY: 300 })));
  await menu.locator('a', { hasText: 'Copy ID' }).click();
  await expect(menu).toBeHidden();
  expect(await clipboard()).toBe(id);
  await page.evaluate(() => temp.network.contextMenu(0, new MouseEvent('contextmenu', { clientX: 300, clientY: 300 })));
  await menu.locator('a', { hasText: 'Copy Sequence' }).click();
  await expect(menu).toBeHidden();
  expect(await clipboard()).toBe(seq);
});

test('the tooltip variables menu takes up to three', async () => {
  await openSettings('Nodes', 'node-controls-labels');
  const menu = pane().locator('.ts-wrapper');
  const choose = async title => {
    await menu.locator('input').fill(title);
    await expect(menu.locator('.ts-dropdown .option.active').first()).toHaveText(title);
    await page.keyboard.press('Enter');
    await page.keyboard.press('Escape');
  };
  const setting = () => page.evaluate(() => [].concat(session.style.widgets['node-tooltip-variable']));
  expect(await setting()).toEqual(['_id']);
  await choose('Group');
  await choose('State');
  await expect.poll(setting).toEqual(['_id', 'group', 'state']);
  await menu.locator('input').fill('Degree');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  expect(await setting()).toEqual(['_id', 'group', 'state']);
  await menu.locator('.item[data-value="group"] .remove').click();
  await expect.poll(setting).toEqual(['_id', 'state']);
});

test('the search toggles flip once per click, however often the view opens', async () => {
  await closeView(page, 'network');
  await launchView(page, 'network');
  await page.waitForFunction(() => temp.network && temp.network.points.length > 0);
  const before = await page.evaluate(() => !!session.style.widgets['search-case-sensitive']);
  await page.locator('#casesensitivebutton').click();
  expect(await page.evaluate(() => !!session.style.widgets['search-case-sensitive'])).toBe(!before);
  await page.locator('#casesensitivebutton').click();
});

test('reopening the view restores its settings', async () => {
  expect(distinct(await sizes())).toBe(1);
  expect((await sizes())[0]).toBeGreaterThan(30);
  await expect.poll(() => page.evaluate(() => temp.network.graph.getLinkWidths()[0])).toBe(9);
  expect(await page.evaluate(() => temp.network.graph.config.simulationRepulsion)).toBeCloseTo(24);
});

test('the network follows the panel size', async () => {
  const width = () => view().locator('canvas').first().evaluate(c => c.getBoundingClientRect().width);
  const before = await width();
  await page.setViewportSize({ width: 1000, height: 900 });
  await expect.poll(width).toBeLessThan(before - 200);
  await page.setViewportSize({ width: 1400, height: 900 });
  await expect.poll(width).toBe(before);
});

for (const [filetype, filename] of [['svg', 'network-test.svg'], ['png', 'network-test.png']]) {
  test(`exports ${filetype}`, async () => {
    const modal = await openExport(page, view(), 'Export Network');
    await modal.getByPlaceholder('Filename').fill('network-test');
    await modal.locator('select').selectOption(filetype);
    const [download] = await Promise.all([page.waitForEvent('download'), modal.locator('button', { hasText: 'Export' }).click()]);
    expect(download.suggestedFilename()).toBe(filename);
    if (filetype == 'svg') {
      const svg = fs.readFileSync(await download.path(), 'utf8');
      expect((svg.match(/<line /g) || []).length).toBe(476);
    } else {
      // The network, at the view's size, with more than its background
      const stats = await imageStats(page, download);
      const size = await view().locator('.network-view').evaluate(el => [el.clientWidth, el.clientHeight]);
      expect([stats.width, stats.height]).toEqual(size);
      expect(stats.colors).toBeGreaterThan(10);
    }
    expect(errors).toEqual([]);
  });
}
