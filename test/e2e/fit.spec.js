// Controls that fit: sliders filling their column, in one style; labels on
// one line in dialogs and cards; toggle buttons inside their groups, each
// divided from the next; settings rows held together (heatmap colors, flow
// variables, Gantt dates); padded color tables; pane sections that show
// whether they're open, and Colors as the button it is; a search bar that
// stays put; small alignments; sort arrows beside their own titles; and one
// meaning per icon.
const { test, expect } = require('@playwright/test');
const { watchErrors, open, fixtures, launchView, closeView, waitForModal, openExport } = require('./helpers');

test.describe.configure({ mode: 'serial' });

let page, errors, searchWidth;
test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  errors = watchErrors(page);
  await open(page);
  searchWidth = await page.locator('#search-field').evaluate(el => el.getBoundingClientRect().width);
  await page.setInputFiles('#data-files', fixtures);
  await page.waitForFunction(() => document.querySelectorAll('#file-table .file-table-row').length >= 3);
});
test.afterAll(() => page.close());

const box = locator => locator.evaluate(el => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }; });
// A view's root, and its settings pane opened
const view = name => page.locator(`.lm_content:has(.left-pane)`).filter({ visible: true }).last();
// Once the pane (or whatever else is moving) has finished sliding
const settled = locator => locator.evaluate(el => Promise.all(el.getAnimations({ subtree: true }).map(a => a.finished)));
// The files launched, for the tests that need a network
async function launched() {
  if (await page.evaluate(() => session.data.clusters.length > 0)) return;
  await page.click('#launch');
  await page.waitForFunction(() => session.data.clusters.length > 0 && document.getElementById('numberOfNodes').textContent != '', null, { timeout: 120000 });
  await page.waitForFunction(() => !layout.contentItems.some(i => i.componentType == 'files'));
}
async function openPane(name) {
  await launched();
  await launchView(page, name);
  const root = view(name);
  await root.locator('.settings-toggle').first().click();
  await expect(root.locator('.left-pane')).toBeVisible();
  await settled(root.locator('.left-pane'));
  return root;
}
// Whether every button of a toggle group is inside the group, the group inside
// its column, and no button's text is cut off
const togglesFit = group => group.evaluate(el => {
  const g = el.getBoundingClientRect(), column = el.parentElement.getBoundingClientRect();
  const buttons = Array.from(el.querySelectorAll('.btn'));
  return g.right <= column.right + 1 && buttons.every(b => b.getBoundingClientRect().right <= g.right + 1 && b.scrollWidth <= b.clientWidth + 1);
});

test('Files Settings pushes the buttons under the files aside too', async () => {
  const root = page.locator('.lm_content:has(.file-panel)');
  await root.locator('button[title="Files Settings"]').click();
  const pane = root.locator('.left-pane');
  await expect(pane).toBeVisible();
  await settled(pane);
  expect((await box(root.locator('.file-footer label[for="data-files"]'))).left).toBeGreaterThan((await box(pane)).right);
  await root.locator('button[title="Files Settings"]').click();
});

test('the search bar stays put when the fields arrive', async () => {
  await launched();
  expect(await page.locator('#search-field').evaluate(el => el.getBoundingClientRect().width)).toBe(searchWidth);
});

test('in the tree’s pane, sliders fill their column, labels sit on one line, and toggles fit', async () => {
  const root = await openPane('phylogenetic_tree');
  const pane = root.locator('.left-pane');
  const slider = await box(pane.locator('#tree-vertical-stretch'));
  const select = await box(pane.locator('select').first());
  expect(Math.abs(slider.right - select.right)).toBeLessThan(2);
  for (const label of ['Height', 'Width', 'Layout']) {
    const l = pane.locator('label, div', { hasText: new RegExp(`^${label}$`) }).first();
    const lineHeight = await l.evaluate(el => parseFloat(getComputedStyle(el).lineHeight) || 24);
    expect([label, (await box(l)).height < lineHeight * 1.5]).toEqual([label, true]);
  }
  for (const group of await pane.locator('.btn-group-toggle').filter({ visible: true }).all()) expect(await togglesFit(group)).toBe(true);
  // The second branch tab's three types, each divided from the next
  await pane.locator('.nav-link', { hasText: 'Branches' }).click();
  const three = pane.locator('.btn-group-toggle').filter({ visible: true }).first();
  expect(await togglesFit(three)).toBe(true);
  const borders = await three.locator('.btn').evaluateAll(buttons => buttons.slice(1).map(b => getComputedStyle(b).borderLeftWidth));
  expect(borders.every(w => w == '1px')).toBe(true);
  await closeView(page, 'phylogenetic_tree');
});

test('pane sections show whether they’re open, and Colors is a button', async () => {
  const root = await openPane('network');
  const pane = root.locator('.left-pane');
  const arrow = button => button.evaluate(el => {
    const after = getComputedStyle(el, '::after');
    return { content: after.content, transform: after.transform };
  });
  const open = await arrow(pane.locator('button[data-bs-target="#node-controls-labels"]'));
  const closed = await arrow(pane.locator('button[data-bs-toggle="collapse"].collapsed').filter({ visible: true }).first());
  expect(open.content).not.toBe('none');
  expect(closed.transform).not.toBe(open.transform);
  const colors = pane.locator('.launch-color-options').filter({ visible: true }).first();
  await expect(colors).toHaveText('Colors…');
  expect(await colors.getAttribute('data-bs-toggle')).toBe(null);
  await root.locator('.settings-toggle').first().click();
});

test('the Epi Curve’s toggle fits its column', async () => {
  const root = await openPane('timeline');
  for (const group of await root.locator('.left-pane .btn-group-toggle').filter({ visible: true }).all()) expect(await togglesFit(group)).toBe(true);
  await closeView(page, 'timeline');
});

test('the heatmap’s colors, flow variables and Gantt dates hold their rows together', async () => {
  let root = await openPane('heatmap');
  const swatches = await root.locator('.left-pane input[type="color"]').evaluateAll(inputs => inputs.map(i => i.getBoundingClientRect().top));
  expect(swatches.length).toBe(3);
  expect(Math.max(...swatches) - Math.min(...swatches)).toBeLessThan(2);
  const label = await box(root.locator('.left-pane .row', { hasText: 'Color Scheme' }).locator('> div').first());
  const first = await box(root.locator('.left-pane input[type="color"]').first());
  expect(first.left).toBeGreaterThan(label.right - 1);
  expect(await root.locator('.heatmap-colors label').allInnerTexts()).toEqual(['Low', 'Middle', 'High']);
  await closeView(page, 'heatmap');

  root = await openPane('flow_diagram');
  const parts = await root.locator('.flow-items').first().evaluate(li => Array.from(li.children, c => { const r = c.getBoundingClientRect(); return r.top + r.height / 2; }));
  expect(Math.max(...parts) - Math.min(...parts)).toBeLessThan(4);
  await expect(root.locator('.flow-items .bi-grip-vertical').first()).toBeVisible();
  await closeView(page, 'flow_diagram');

  root = await openPane('gantt');
  await expect(root.locator('.gantt-date').first()).toBeVisible();
  const start = root.locator('.gantt-date .row').first();
  const [name, control] = [await box(start.locator('> div').first()), await box(start.locator('select'))];
  expect(control.left).toBeGreaterThan(name.right - 1);
  expect(Math.abs((name.top + name.bottom) / 2 - (control.top + control.bottom) / 2)).toBeLessThan(8);
  await expect(root.locator('.gantt-date').first()).toContainText('Date 1');
  await closeView(page, 'gantt');
});

test('export dialogs’ watermark slider fills its column, in the panes’ style, its label on one line', async () => {
  await launched();
  await launchView(page, 'histogram');
  const modal = await openExport(page, page.locator('.lm_content:has(button[title="Export Histogram"])'), 'Export Histogram');
  const slider = modal.locator('[name="export-opacity"]');
  await expect(slider).toHaveClass(/form-range/);
  expect(Math.abs((await box(slider)).right - (await box(modal.locator('[name="export-filetype"]'))).right)).toBeLessThan(2);
  const label = modal.locator('label', { hasText: 'Watermark Opacity' });
  const lineHeight = await label.evaluate(el => parseFloat(getComputedStyle(el).lineHeight));
  expect((await box(label)).height).toBeLessThan(lineHeight * 1.5);
  await modal.locator('.btn-close').click();
  await expect(modal).toBeHidden();
  await closeView(page, 'histogram');
});

test('the node color table is padded like the link table, its drops beside their swatches', async () => {
  await launched();
  await page.evaluate(() => MT.settings.set('node-color-variable', 'group'));
  const cell = page.locator('#node-color-table td').first();
  await expect(cell).toBeVisible();
  expect(await cell.evaluate(el => getComputedStyle(el).paddingLeft)).toBe(await page.locator('#link-color-table td').first().evaluate(el => getComputedStyle(el).paddingLeft));
  const [swatch, drop] = [await box(page.locator('#node-color-table input[type="color"]').first()), await box(page.locator('#node-color-table td:has(input[type="color"]) .table-control').first())];
  expect(Math.abs((swatch.top + swatch.bottom) / 2 - (drop.top + drop.bottom) / 2)).toBeLessThan(3);
});

test('the style file button lines up, and a disabled toolbar button stays solid', async () => {
  await launched();
  await page.click('#SettingsTab');
  await waitForModal(page, '#global-settings-modal');
  const dialog = page.locator('#global-settings-modal');
  await dialog.locator('.nav-link', { hasText: 'Styling' }).click();
  const button = await box(dialog.locator('label[for="apply-style"]'));
  const other = await box(dialog.locator('select[data-setting="node-color-variable"]'));
  expect([Math.round(button.left), Math.round(button.right)]).toEqual([Math.round(other.left), Math.round(other.right)]);
  await dialog.locator('.btn-close').click();
  await expect(dialog).toBeHidden();
  await page.evaluate(() => MT.settings.set('node-timeline-variable', 'date'));
  const pin = page.locator('.lm_content:has(.network-view) .view-controls .btn:disabled').first();
  await expect(pin).toBeVisible();
  expect(await pin.evaluate(el => getComputedStyle(el).opacity)).toBe('1');
  await page.evaluate(() => MT.settings.set('node-timeline-variable', 'None'));
});

test('a table’s sort arrow sits beside its own title, and shows on unsorted columns only on hover', async () => {
  await launched();
  await launchView(page, 'aggregation');
  const header = page.locator('.lm_content:has(.aggregation-tables) .tabulator-col').filter({ hasText: 'Number of Nodes' });
  await page.mouse.move(5, 500);
  const [title, sorter] = [await box(header.locator('.tabulator-col-title')), await box(header.locator('.tabulator-col-sorter'))];
  expect(sorter.left - title.right).toBeLessThan(12);
  // Sorting by one column leaves the other unsorted
  await header.locator('.tabulator-col-title').click();
  const unsorted = page.locator('.lm_content:has(.aggregation-tables) .tabulator-sortable[aria-sort="none"]').first();
  await page.mouse.move(5, 500);
  expect(await unsorted.locator('.tabulator-col-sorter').evaluate(el => getComputedStyle(el).visibility)).toBe('hidden');
  await unsorted.hover();
  expect(await unsorted.locator('.tabulator-col-sorter').evaluate(el => getComputedStyle(el).visibility)).toBe('visible');
  // Its drag handles are grips, as the Files view's are
  await page.locator('.lm_content:has(.aggregation-tables) .settings-toggle').click();
  await expect(page.locator('.aggregation-items .bi-grip-vertical').first()).toBeVisible();
  await closeView(page, 'aggregation');
});

test('Pivot and autorotate have icons of their own', async () => {
  await launched();
  await launchView(page, 'crosstab');
  await expect(page.locator('button[title="Pivot Crosstab"] .bi-arrow-left-right')).toBeVisible();
  await closeView(page, 'crosstab');
  await launchView(page, 'globe');
  const toggle = page.locator('button[title="Toggle Autorotation"]');
  await expect(toggle.locator('.bi-play-fill')).toBeVisible();
  await toggle.click();
  await expect(toggle.locator('.bi-pause-fill')).toBeVisible();
  await toggle.click();
  await expect(toggle.locator('.bi-play-fill')).toBeVisible();
  await closeView(page, 'globe');
  expect(errors).toEqual([]);
});
