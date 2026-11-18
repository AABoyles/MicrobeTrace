// What was only a right-click, double-click or drag, from the keyboard (#185),
// the views' names and summaries for assistive technology (#184), and the tips
// that say these exist (#273).
const { test, expect } = require('@playwright/test');
const { watchErrors, loadNetwork, launchView, waitForModal } = require('./helpers');

test.describe.configure({ mode: 'serial' });

let page, errors;
test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  errors = watchErrors(page);
  await loadNetwork(page);
  await page.waitForFunction(() => temp.network && temp.network.points.length > 0);
});
test.afterAll(() => page.close());

test('the charts, maps and tree are named and summarised', async () => {
  const views = {
    histogram: ['.histogram-plot', /^Histogram of link distances$/],
    scatterplot: ['.scatterplot-plot', /^Scatterplot/],
    heatmap: ['.heatmap-plot', /^Heatmap/],
    phylogenetic_tree: ['.tree', /^Phylogenetic tree$/],
    globe: ['canvas.globe', /^Globe/],
    geo_map: ['.map-canvas', /^Map of node locations$/]
  };
  for (const [name, [selector, label]] of Object.entries(views)) {
    await launchView(page, name);
    const graphic = page.locator(`.lm_content:has(${selector}) ${selector}`).first();
    await expect(graphic).toHaveAttribute('aria-label', label);
    const role = await graphic.getAttribute('role');
    expect(['region', 'img']).toContain(role);
    const id = await graphic.getAttribute('aria-describedby');
    await expect(page.locator('#' + id)).toContainText('The Table view lists the same data.');
    await expect(page.locator('#' + id)).toContainText(/\d+ nodes?/);
  }
});

test('a legend has an options button that opens its menu, and Escape returns', async () => {
  await page.evaluate(() => MT.settings.set('node-color-variable', 'cluster'));
  const wrapper = page.locator('#node-color-table-wrapper');
  await expect(wrapper.locator('td[data-value]').first()).toBeVisible();
  const button = wrapper.locator('.floater-menu-button');
  await expect(button).toHaveAttribute('aria-label', 'Table options');
  await button.focus();
  await page.keyboard.press('Enter');
  const menu = page.locator('#node-color-table-context');
  await expect(menu).toBeVisible();
  await expect(menu.locator('[data-action="drag"]')).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(menu.locator('[data-action="rename"]')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(button).toBeFocused();
  // The menu key on a value
  const cell = wrapper.locator('td[data-value]').first();
  await cell.focus();
  await page.keyboard.press('Shift+F10');
  await expect(menu).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(cell).toBeFocused();
});

test('F2, Enter and the menu rename a legend value; Escape cancels', async () => {
  const cell = page.locator('#node-color-table-wrapper td[data-value]').first();
  await cell.focus();
  await page.keyboard.press('F2');
  await expect(cell).toHaveAttribute('contenteditable', 'true');
  await page.keyboard.type('Renamed');
  await page.keyboard.press('Enter');
  await expect(cell).toHaveText('Renamed');
  await expect(cell).toHaveAttribute('contenteditable', 'false');
  await expect(cell).toBeFocused();
  // Escape puts the old name back
  await page.keyboard.press('Enter');
  await page.keyboard.type('Nope');
  await page.keyboard.press('Escape');
  await expect(cell).toHaveText('Renamed');
  // The menu's Rename a Value
  await page.locator('#node-color-table-wrapper .floater-menu-button').click();
  await page.locator('#node-color-table-context [data-action="rename"]').click();
  await expect(cell).toHaveAttribute('contenteditable', 'true');
  await page.keyboard.press('Escape');
});

test('C selects the focused node\'s cluster and A selects every node, from the keyboard', async () => {
  await launchView(page, 'network');
  await page.waitForFunction(() => temp.network && temp.network.points.length > 0);
  await page.locator('.network-view').focus();
  await page.keyboard.press('n');
  const cluster = await page.evaluate(() => temp.network.points[temp.network.focused].cluster);
  const inCluster = await page.evaluate(c => temp.network.points.filter(p => p.cluster === c).length, cluster);
  await page.keyboard.press('c');
  expect(await page.evaluate(() => session.data.nodes.filter(d => d.selected).length)).toBe(inCluster);
  await page.keyboard.press('a');
  expect(await page.evaluate(() => session.data.nodes.filter(d => d.selected).length)).toBe(await page.evaluate(() => temp.network.points.length));
  await page.keyboard.press('Escape');
});

test('the tree menu opens from its button and from a branch with the keyboard', async () => {
  await launchView(page, 'phylogenetic_tree');
  const view = page.locator('.lm_content:has(button[title="Export Phylogenetic Tree"])').first();
  await expect.poll(() => view.locator('g.tidytree-node-leaf circle').count(), { timeout: 60000 }).toBeGreaterThan(0);
  const menu = view.locator('.tree-context-menu');
  await view.locator('.tree-menu-button').click();
  await expect(menu).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  const circle = view.locator('svg circle[tabindex="0"]').first();
  await circle.focus();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Shift+F10');
  await expect(menu).toBeVisible();
  await expect(menu.locator('[data-action="rotate"]')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
});

test('files move up and down with buttons and Alt+Arrow', async ({ browser }) => {
  const p = await browser.newPage();
  const { open, fixtures } = require('./helpers');
  await open(p);
  await p.setInputFiles('#data-files', fixtures);
  const rows = p.locator('#file-table .file-table-row');
  await expect(rows).toHaveCount(3);
  const names = () => p.evaluate(() => session.files.map(f => f.name));
  const first = (await names())[0];
  await expect(rows.first().locator('.file-move-up')).toBeDisabled();
  await rows.first().locator('.file-move-down').click();
  expect((await names())[1]).toBe(first);
  await expect(rows.nth(1).locator('.file-title')).toHaveText(first);
  await rows.nth(1).locator('.file-move-down').focus();
  await p.keyboard.press('Alt+ArrowDown');
  expect((await names())[2]).toBe(first);
  await p.keyboard.press('Alt+ArrowUp');
  expect((await names())[1]).toBe(first);
  await expect(p.locator('.file-order-live')).toContainText('moved to position 2 of 3');
  await p.close();
});

test('the tips are in the Help menu and the network settings', async () => {
  await page.locator('.nav-link.dropdown-toggle', { hasText: 'Help' }).click();
  await page.locator('#ShortcutsTab').click();
  await waitForModal(page, '#shortcuts-modal');
  await expect(page.locator('#shortcuts-modal')).toContainText('Ctrl + drag');
  await expect(page.locator('#shortcuts-modal')).toContainText('Double-click a value');
  await page.locator('#shortcuts-modal [data-bs-dismiss="modal"]').first().click();
  expect(await page.locator('.network-gesture-hint').count()).toBeGreaterThan(0);
});

test('no errors', () => { expect(errors).toEqual([]); });
