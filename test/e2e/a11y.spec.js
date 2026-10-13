// Accessibility: every control has a name (a color swatch from its row, as in
// "G0 color"; a menu from its label), and every dialog from its title; the
// settings panes' tabs are wired to their panels; draggable rows and tables
// have no roles they don't play; and the timeline's Play button and the
// warnings' links can be read. axe (https://github.com/dequelabs/axe-core)
// checks each view, with its settings pane open, against WCAG 2.1 A and AA.
const { test, expect } = require('@playwright/test');
const { watchErrors, open, loadNetwork, launchView, waitForModal } = require('./helpers');

test.describe.configure({ mode: 'serial' });

let page, errors;
test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  errors = watchErrors(page);
  await loadNetwork(page);
});
test.afterAll(() => page.close());

const AXE = require.resolve('axe-core/axe.min.js');
// What axe finds against WCAG 2.1 A and AA, as "rule: element" lines
async function axe(page, context = null, rules) {
  if (!(await page.evaluate(() => !!window.axe))) await page.addScriptTag({ path: AXE });
  return page.evaluate(async ([context, rules]) => {
    const options = rules ? { runOnly: { type: 'rule', values: rules } } : { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } };
    const { violations } = await window.axe.run(context || document, { ...options, resultTypes: ['violations'] });
    return violations.flatMap(v => v.nodes.map(n => `${v.id}: ${n.target.join(' ')}`));
  }, [context, rules]);
}
const set = (key, value) => page.evaluate(([key, value]) => MT.settings.set(key, value), [key, value]);
const views = ['table', 'aggregation', 'crosstab', 'histogram', 'scatterplot', 'heatmap', 'timeline', 'gantt', 'bubbles',
  'flow_diagram', 'geo_map', 'phylogenetic_tree', 'waterfall', 'choropleth', 'globe', 'sequences'];
async function opened(view) {
  if (!(await page.evaluate(view => layout.contentItems.some(i => i.componentType == view), view))) await launchView(page, view);
  await page.evaluate(view => { const item = layout.contentItems.find(i => i.componentType == view); item.parent.setActiveComponentItem(item, true); }, view);
}
// A control's name, as far as these controls go: its own, or its label's
const unnamed = () => page.evaluate(() => Array.from(document.querySelectorAll('input:not([type=hidden]), select, textarea'))
  .filter(el => !el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby') && !Array.from(el.labels || []).some(l => l.textContent.trim()))
  .map(el => (el.closest('[id]') || {}).id + ' ' + el.outerHTML.slice(0, 120)));

test('every control has a name, the color swatches from their rows', async () => {
  await set('node-color-variable', 'cluster');
  await set('node-color-table-show', true);
  await set('link-color-variable', 'origin');
  await set('link-color-table-show', true);
  for (const view of views) await opened(view);
  await opened('network');
  await set('polygons-show', true);
  await set('polygons-color-show', true);
  await expect(page.locator('.polygon-color-table input[type=color]').first()).toBeAttached();
  expect(await unnamed()).toEqual([]);
  // A swatch and its transparency are named for their row's value
  const row = page.locator('#node-color-table tr:has(input[type=color])').first();
  const value = (await row.locator('td').first().textContent()).trim();
  await expect(row.locator('input[type=color]')).toHaveAttribute('aria-label', value + ' color');
  await expect(row.locator('.table-control')).toHaveAttribute('aria-label', value + ' transparency');
  // ...and follow it when it's renamed
  await row.locator('td').first().dblclick();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('Renamed');
  await row.locator('td').first().evaluate(td => td.blur());
  await expect(row.locator('input[type=color]')).toHaveAttribute('aria-label', 'Renamed color');
  // The searchable menus (Tom Select) are named for what they choose
  await expect(page.locator('#node-tooltip-variable-ts-control')).toHaveAttribute('aria-labelledby', /.+/);
  await expect(page.locator('.lm_content:has(.table-grid) .ts-control input')).toHaveAttribute('aria-label', 'Columns');
  await set('polygons-show', false);
});

test('each dialog is named by its title', async () => {
  const dialogs = await page.evaluate(() => Array.from(document.querySelectorAll('.modal'), modal => {
    const title = document.getElementById(modal.getAttribute('aria-labelledby'));
    return [modal.id || modal.className, title && modal.contains(title) && title.classList.contains('modal-title') && title.textContent.trim() != ''];
  }));
  expect(dialogs.length).toBeGreaterThan(20);
  expect(dialogs.filter(([, named]) => !named)).toEqual([]);
});

test('the settings panes’ tabs are wired to their panels', async () => {
  const tabs = await page.evaluate(() => Array.from(document.querySelectorAll('[role="tab"]'), tab => {
    const panel = document.getElementById(tab.getAttribute('aria-controls'));
    return {
      tab: tab.id,
      panel: !!panel && panel.getAttribute('role') == 'tabpanel' && tab.getAttribute('href') == '#' + panel.id && panel.getAttribute('aria-labelledby') == tab.id,
      inList: tab.parentElement.closest('[role="tablist"]') != null && (tab.parentElement.getAttribute('role') == 'presentation' || tab.parentElement.getAttribute('role') == 'tablist'),
      selected: tab.getAttribute('aria-selected') == String(tab.classList.contains('active'))
    };
  }));
  expect(tabs.length).toBeGreaterThan(30);
  expect(tabs.filter(t => !t.panel || !t.inList || !t.selected)).toEqual([]);
  expect(new Set(tabs.map(t => t.tab)).size).toBe(tabs.length);
  // Switching tabs moves the selection
  await opened('phylogenetic_tree');
  const view = page.locator('.lm_content:has(.tree)');
  if (!(await view.locator('.left-pane').isVisible())) await view.locator('.settings-toggle').click();
  await view.locator('#tree-leaf-tab').click();
  await expect(view.locator('#tree-leaf-tab')).toHaveAttribute('aria-selected', 'true');
  await expect(view.locator('#tree-tab')).toHaveAttribute('aria-selected', 'false');
  await expect(view.locator('#tree-leaf-configurations')).toBeVisible();
});

test('draggable rows and tables have only the roles they play', async () => {
  await opened('aggregation');
  await opened('flow_diagram');
  const roles = await page.evaluate(() => ({
    options: document.querySelectorAll('[role="option"][draggable], [aria-grabbed]').length,
    groups: document.querySelectorAll('[role="columngroup"], [aria-title]').length,
    owns: document.querySelectorAll('.tabulator[aria-owns]').length,
    holders: Array.from(document.querySelectorAll('.tabulator > .tabulator-tableholder'), h => h.getAttribute('role'))
  }));
  expect(roles.options).toBe(0);
  expect(roles.groups).toBe(0);
  expect(roles.owns).toBe(0);
  expect(roles.holders.length).toBeGreaterThan(0);
  expect(roles.holders.every(r => r == 'rowgroup')).toBe(true);
});

test('axe finds nothing in each view, with its settings pane open', async () => {
  const found = [];
  for (const view of ['network', ...views]) {
    await opened(view);
    // The whole page once, then each view on its own
    await page.evaluate(view => {
      document.querySelectorAll('[data-audit]').forEach(el => el.removeAttribute('data-audit'));
      layout.contentItems.find(i => i.componentType == view).element.setAttribute('data-audit', '');
    }, view);
    const root = page.locator('[data-audit]'), toggle = root.locator('.settings-toggle').first();
    const pane = await toggle.count() > 0;
    if (pane && !(await toggle.evaluate(b => b.classList.contains('active')))) await toggle.click();
    if (pane) await root.locator('.left-pane').evaluate(el => Promise.all(el.getAnimations().map(a => a.finished)));
    found.push(...(await axe(page, view == 'network' ? null : '[data-audit]')).map(v => `${view} › ${v}`));
    if (pane) await toggle.click();
  }
  expect(found).toEqual([]);
});

test('axe finds nothing in an export dialog', async () => {
  await opened('histogram');
  const view = page.locator('.lm_content:has(.histogram-plot)');
  await view.locator('button[title="Export Histogram"]').click();
  await waitForModal(page, '#histogram-export-modal');
  expect(await axe(page, '#histogram-export-modal')).toEqual([]);
  await page.locator('#histogram-export-modal .btn-close').click();
  await expect(page.locator('#histogram-export-modal')).toBeHidden();
});

test('the timeline’s Play button can be read', async () => {
  await set('node-timeline-variable', 'date');
  await expect(page.locator('#timeline-play-button')).toBeVisible();
  expect(await axe(page, '#timeline-play-button', ['color-contrast'])).toEqual([]);
  await set('node-timeline-variable', 'None');
  expect(errors).toEqual([]);
});

test('the links in the alignment warning can be read', async ({ browser }) => {
  const fresh = await browser.newPage();
  await open(fresh);
  await fresh.locator('button', { hasText: 'Sequence Settings' }).click();
  await waitForModal(fresh, '#sequence-controls-modal');
  const alert = '#sequence-controls-modal .alert-warning';
  await expect(fresh.locator(alert)).toBeVisible();
  expect(await axe(fresh, alert, ['color-contrast'])).toEqual([]);
  await fresh.close();
});
