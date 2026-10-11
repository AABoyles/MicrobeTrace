// The phylogenetic tree view: drawing the leaves, layout and branch settings,
// leaf colors, sizes, labels and tooltips, selection, the context menu,
// restoring and export.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const { watchErrors, loadNetwork, launchView, closeView, openExport } = require('./helpers');

test.describe.configure({ mode: 'serial' });

let page, errors;
test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  errors = watchErrors(page);
  await loadNetwork(page);
  await launchView(page, 'phylogenetic_tree');
});
test.afterAll(() => page.close());

const view = () => page.locator('.lm_content:has(button[title="Export Tree"])').first();
const pane = () => view().locator('.left-pane');
const leaves = () => view().locator('g.tidytree-node-leaf circle');
const set = (key, value) => page.evaluate(([key, value]) => MT.settings.set(key, value), [key, value]);
const tree = () => page.evaluate(() => {
  const t = temp.phylogeneticTree.tree;
  return { layout: t.layout, mode: t.mode, type: t.type, ruler: t.ruler, branchDistances: t.branchDistances, leafLabels: t.leafLabels };
});
const leafCount = () => page.evaluate(() => temp.tree.getLeaves().length);

test('draws a leaf per sequence, in the node color', async () => {
  await expect.poll(() => leaves().count(), { timeout: 60000 }).toBeGreaterThan(0);
  expect(await leaves().count()).toBe(await leafCount());
  const color = await page.evaluate(() => session.style.widgets['node-color']);
  expect(await leaves().first().evaluate(el => el.style.fill)).toBe(await page.evaluate(c => { const p = document.createElement('div'); p.style.color = c; return p.style.color; }, color));
});

test('the layout, type and branch mode can be changed', async () => {
  await view().locator('button[title="Tree Settings"]').click();
  await expect(pane()).toBeVisible();
  await pane().locator('label', { hasText: 'Circular' }).click();
  await expect.poll(async () => (await tree()).layout).toBe('circular');
  expect(await page.evaluate(() => session.style.widgets['tree-layout-circular'])).toBe(true);
  await pane().locator('select[data-setting="tree-type"]').selectOption('dendrogram');
  await expect.poll(async () => (await tree()).type).toBe('dendrogram');
  await pane().locator('a', { hasText: 'Branches' }).click();
  await pane().locator('label', { hasText: 'Smooth' }).click();
  await expect.poll(async () => (await tree()).mode).toBe('smooth');
  // Restyled after the redraw
  expect(await leaves().count()).toBe(await leafCount());
});

test('branch distances can be shown, rounded and sized', async () => {
  await set('tree-branch-distances-hide', false);
  await expect.poll(async () => (await tree()).branchDistances).toBe(true);
  await set('tree-round-true', true);
  const labels = () => view().locator('g.tidytree-link text').allTextContents();
  await expect.poll(async () => (await labels()).every(t => /^\d+$/.test(t))).toBe(true);
  await set('tree-branch-distance-size', 20);
  await expect.poll(() => view().locator('g.tidytree-link text').first().evaluate(el => el.style.fontSize)).toBe('20px');
  await set('tree-branch-distances-hide', true);
});

test('rounded distances stay rounded through an animated redraw', async () => {
  expect(await page.evaluate(() => session.style.widgets['tree-animation-on'])).toBe(true);
  await set('tree-branch-distances-hide', false);
  await set('tree-round-true', true);
  const labels = () => view().locator('g.tidytree-link text').allTextContents();
  await expect.poll(async () => (await labels()).every(t => /^\d+$/.test(t))).toBe(true);
  // The redraw fades the labels out, rewrites them and fades them back in
  await set('tree-mode', 'square');
  await page.waitForTimeout(2000);
  expect((await labels()).every(t => /^\d+$/.test(t))).toBe(true);
  await set('tree-mode', 'smooth');
  await set('tree-round-true', false);
  await set('tree-branch-distances-hide', true);
});

test('leaf sizes and colors follow the settings', async () => {
  await set('tree-leaf-node-size', 15);
  await expect.poll(() => leaves().first().getAttribute('r')).toBe('15');
  await page.evaluate(() => { session.style.widgets['node-color'] = '#00ff00'; MT.events.emit('node-color-change'); });
  await expect.poll(() => leaves().first().evaluate(el => el.style.fill)).toBe('rgb(0, 255, 0)');
});

test('leaf labels show the label variable', async () => {
  await set('tree-leaf-label-show', true);
  await expect.poll(async () => (await tree()).leafLabels).toBe(true);
  await set('tree-leaf-label-variable', 'state');
  const states = new Set(await page.evaluate(() => session.data.nodes.map(d => d.state == null ? '' : '' + d.state)));
  await expect.poll(async () => {
    const texts = await view().locator('g.tidytree-node-leaf text').allTextContents();
    return texts.length > 0 && texts.every(t => states.has(t));
  }).toBe(true);
  await set('tree-leaf-label-show', false);
});

test('clicking a leaf selects its node, and selections made elsewhere show', async () => {
  const color = await page.evaluate(() => session.style.widgets['selected-color']);
  const css = await page.evaluate(c => { const p = document.createElement('div'); p.style.color = c; return p.style.color; }, color);
  await leaves().first().dispatchEvent('click');
  await expect.poll(() => page.evaluate(() => session.data.nodes.filter(d => d.selected).length)).toBe(1);
  await expect.poll(() => leaves().first().evaluate(el => el.style.stroke)).toBe(css);
  await page.evaluate(() => { session.data.nodes.forEach(d => d.selected = false); MT.events.emit('node-selected'); });
  await expect.poll(() => leaves().first().evaluate(el => el.style.stroke)).not.toBe(css);
});

test('a leaf tooltip shows the tooltip variable', async () => {
  await set('tree-leaf-tooltip-variable', 'state');
  const state = await leaves().first().evaluate(el => {
    const id = d3.select(el).datum().data.id;
    return session.data.nodes.find(d => d._id == id).state;
  });
  // (TidyTree listens for mouseenter)
  const leaf = leaves().first();
  await leaf.dispatchEvent('mouseenter');
  await expect(page.locator('#tooltip')).toHaveText(state == null ? '' : '' + state);
  await leaf.dispatchEvent('mouseout');
});

test('the context menu rotates the tree', async () => {
  // Where each leaf is
  const order = () => view().locator('g.tidytree-node-leaf').evaluateAll(els => els.map(el => d3.select(el).datum().data.id + '@' + el.getAttribute('transform')).sort().join());
  await page.evaluate(() => { temp.phylogeneticTree.tree.setAnimation(0); });
  const before = await order();
  const branch = view().locator('g.tidytree-node-internal circle').first();
  await branch.dispatchEvent('contextmenu');
  const menu = view().locator('.tree-context-menu');
  await expect(menu).toBeVisible();
  await menu.locator('a', { hasText: 'Flip' }).click();
  await expect(menu).toBeHidden();
  await expect.poll(order).not.toBe(before);
});

test('reopening the view restores its settings', async () => {
  await closeView(page, 'phylogenetic_tree');
  expect(await page.evaluate(() => temp.phylogeneticTree)).toBeUndefined();
  await launchView(page, 'phylogenetic_tree');
  await expect.poll(() => leaves().count(), { timeout: 60000 }).toBe(await leafCount());
  const t = await tree();
  expect([t.layout, t.type, t.mode]).toEqual(['circular', 'dendrogram', 'smooth']);
  expect(await leaves().first().getAttribute('r')).toBe('15');
});

test('the tree follows the panel size', async () => {
  const width = () => view().locator('svg').first().evaluate(el => el.getBoundingClientRect().width);
  const before = await width();
  await page.setViewportSize({ width: 1000, height: 900 });
  await expect.poll(width).toBeLessThan(before - 200);
  await page.setViewportSize({ width: 1400, height: 900 });
  await expect.poll(width).toBe(before);
});

for (const [filetype, filename] of [['nwk', 'tree-test.nwk'], ['svg', 'tree-test.svg'], ['png', 'tree-test.png']]) {
  test(`exports ${filetype}`, async () => {
    const modal = await openExport(page, view(), 'Export Tree');
    await modal.getByPlaceholder('Filename').fill('tree-test');
    await modal.locator('select').selectOption(filetype);
    const [download] = await Promise.all([page.waitForEvent('download'), modal.locator('button', { hasText: 'Export' }).click()]);
    expect(download.suggestedFilename()).toBe(filename);
    if (filetype == 'nwk') {
      const newick = fs.readFileSync(await download.path(), 'utf8');
      expect(newick.trim().endsWith(';')).toBe(true);
      expect(await page.evaluate(newick => patristic.parseNewick(newick).getLeaves().length, newick)).toBe(await leafCount());
    }
    expect(errors).toEqual([]);
  });
}
