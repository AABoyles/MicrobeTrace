// Colors and labels that match the data: the colors drawn for numbers and
// empty values are their legend rows', with and without the timeline; links
// on the map and globe and bars in the histogram follow the link legend, which
// those views dock; legends show values as the data has them; and the
// crosstab and aggregation name empty values, axes and order as the legends do.
const fs = require('fs');
const { test, expect } = require('@playwright/test');
const { watchErrors, loadNetwork, launchView, closeView, openExport } = require('./helpers');

test.describe.configure({ mode: 'serial' });

let page, errors;
test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  errors = watchErrors(page);
  await loadNetwork(page);
});
test.afterAll(() => page.close());

// A color table's rows: each value (as the row keeps it), label and color
const legend = kind => page.evaluate(kind => Array.from(document.querySelectorAll(`#${kind}-color-table td[data-value]`), td => ({
  value: td.dataset.value,
  label: td.textContent,
  color: td.closest('tr').querySelector('input[type="color"]').value
})), kind);
const colorBy = async (kind, variable) => {
  await page.evaluate(([kind, variable]) => MT.settings.set(kind + '-color-variable', variable), [kind, variable]);
  await expect.poll(async () => (await legend(kind)).length).toBeGreaterThan(1);
};
// Whether the view's dock holds a color table
const docked = (view, kind) => page.evaluate(([view, kind]) => {
  const item = layout.contentItems.find(i => i.componentType == view);
  return !!item && item.container.element.contains(document.getElementById(kind + '-color-table-wrapper'));
}, [view, kind]);

test('coloring by a number gives each node its legend row’s color', async () => {
  await colorBy('node', 'cluster');
  const rows = await legend('node');
  // The color each visible node is drawn with, by its cluster
  const drawn = await page.evaluate(() => MT.getVisibleNodes().map(d => [String(d.cluster), temp.style.nodeColorMap(d.cluster)]));
  const byValue = new Map(rows.map(r => [r.value, r.color]));
  expect(drawn.length).toBeGreaterThan(100);
  for (const [value, color] of drawn) expect([value, color]).toEqual([value, byValue.get(value)]);
});

test('empty values are drawn in their legend row’s color, with the timeline on too', async () => {
  await colorBy('node', 'group');
  const empty = (await legend('node')).find(r => r.label == '(Empty)');
  expect(empty).toBeTruthy();
  expect(await page.evaluate(() => temp.style.nodeColorMap(null))).toBe(empty.color);
  // The bubbles draw them so
  await launchView(page, 'bubbles');
  await expect.poll(() => page.evaluate(() => document.querySelectorAll('.bubbles-view circle, svg circle').length)).toBeGreaterThan(300);
  const fills = await page.evaluate(() => {
    const empty = new Set(session.data.nodes.filter(d => d.group == null).map(d => d._id));
    return Array.from(document.querySelectorAll('svg circle'), c => c.__data__ && c.__data__.node && empty.has(c.__data__.node._id) ? c.getAttribute('fill') : null).filter(Boolean);
  });
  expect(fills.length).toBe(10);
  expect(new Set(fills)).toEqual(new Set([empty.color]));
  await closeView(page, 'bubbles');
  // With the timeline on, the colors are kept for each value, empty included
  const g0 = (await legend('node')).find(r => r.label == 'g0');
  await page.evaluate(() => MT.settings.set('node-timeline-variable', 'date'));
  await expect.poll(() => page.evaluate(() => temp.style.nodeColorMap(null))).toBe(empty.color);
  expect(empty.color).not.toBe(g0.color);
  await page.evaluate(() => MT.settings.set('node-timeline-variable', 'None'));
});

test('legends show values as the data has them', async () => {
  await colorBy('node', 'group');
  expect((await legend('node')).map(r => r.label)).toEqual(['g0', 'g1', 'g2', 'g3', '(Empty)']);
  expect((await legend('link')).map(r => r.label).sort()).toEqual(['Genetic Distance', 'links.csv']);
});

test('the map colors links by their first file, as the legend does', async () => {
  const byValue = new Map((await legend('link')).map(r => [r.value, r.color]));
  await launchView(page, 'geo_map');
  // Each link drawn: its first file, and its color
  const strokes = () => page.evaluate(() => temp.geoMap && temp.geoMap.layers.links ? temp.geoMap.layers.links.getLayers().map(l => [l.options.data.origin[0], l.options.color]) : []);
  await expect.poll(async () => (await strokes()).length).toBeGreaterThan(100);
  for (const [origin, color] of await strokes()) expect([origin, color]).toEqual([origin, byValue.get(origin)]);
  expect(await docked('geo_map', 'link')).toBe(true);
  await closeView(page, 'geo_map');
});

test('the globe colors links from the link legend, and docks it', async () => {
  const colors = (await legend('link')).map(r => r.color);
  await launchView(page, 'globe');
  await expect.poll(() => page.evaluate(() => temp.globe && temp.globe.drawn && temp.globe.drawn.links)).toBeGreaterThan(0);
  const drawn = await page.evaluate(() => temp.globe.drawn.linkColors);
  expect(drawn.length).toBeGreaterThan(0);
  expect(drawn.every(c => colors.includes(c))).toBe(true);
  expect(await docked('globe', 'link')).toBe(true);
  // Without a color variable, the link color
  await page.evaluate(() => MT.settings.set('link-color-variable', 'None'));
  await expect.poll(() => page.evaluate(() => temp.globe.drawn.linkColors)).toEqual([await page.evaluate(() => MT.settings.get('link-color'))]);
  await page.evaluate(() => MT.settings.set('link-color-variable', 'origin'));
  await closeView(page, 'globe');
});

test('the histogram colors bars by the legend of its dataset, the only one it docks', async () => {
  const colors = (await legend('link')).map(r => r.color);
  await launchView(page, 'histogram');
  const bars = () => page.evaluate(() => document.querySelector('.histogram-plot').data.map(t => t.marker.color));
  await expect.poll(async () => (await bars()).length).toBe(2);
  expect((await bars()).every(c => colors.includes(c))).toBe(true);
  await expect.poll(() => docked('histogram', 'link')).toBe(true);
  expect(await docked('histogram', 'node')).toBe(false);
  // Charting a node variable docks the node legend instead
  const nodeColors = (await legend('node')).map(r => r.color);
  await page.evaluate(() => MT.settings.set('histogram-variable', 'nodes-degree'));
  await expect.poll(() => docked('histogram', 'node')).toBe(true);
  expect(await docked('histogram', 'link')).toBe(false);
  expect((await bars()).every(c => nodeColors.includes(c))).toBe(true);
  await closeView(page, 'histogram');
});

test('the crosstab labels empty values, names its axes and sorts both', async () => {
  await launchView(page, 'crosstab');
  const view = page.locator('.lm_content:has(button[title="Export crosstab data"])');
  const shown = () => view.locator('.tabulator').evaluate(el => {
    const t = Tabulator.findTable(el).pop();
    return {
      group: t.getColumns(true).map(c => c.getDefinition().title),
      columns: t.getColumns().map(c => c.getDefinition().title),
      rows: t.getData().map(r => r.col)
    };
  });
  await expect.poll(async () => (await shown()).rows.length).toBe(5);
  // Rows are groups, columns states, as the corner and the heading say
  const t = await shown();
  expect(t.group).toEqual(['Group', 'State']);
  expect(t.columns).toEqual(['Group', 'Georgia', 'Maine', 'Ohio', 'Texas', 'Utah', '(Empty)']);
  expect(t.rows).toEqual(['g0', 'g1', 'g2', 'g3', '(Empty)']);
  // The export says the same
  const modal = await openExport(page, view, 'Export crosstab data');
  const [download] = await Promise.all([page.waitForEvent('download'), modal.locator('button', { hasText: 'Export' }).click()]);
  const csv = fs.readFileSync(await download.path(), 'utf8').trim().split(/\r?\n/);
  expect(csv[0]).toBe('Group,Georgia,Maine,Ohio,Texas,Utah,(Empty)');
  expect(csv[5].split(',')[0]).toBe('(Empty)');
  expect(csv[5].split(',').slice(1).map(Number).reduce((a, b) => a + b)).toBe(10);
  await closeView(page, 'crosstab');
});

test('aggregation calls empty values (Empty) too', async () => {
  await launchView(page, 'aggregation');
  const values = () => page.locator('.aggregation-tables').first().evaluate(el => Tabulator.findTable(el).pop().getData().map(r => r[Object.keys(r)[0]] + ''));
  await page.locator('.lm_content:has(.aggregation-tables) .settings-toggle').click();
  await page.locator('.aggregation-variable').first().selectOption('node group');
  await expect.poll(values).toContain('(Empty)');
  expect(await values()).not.toContain('_Unknown');
  await closeView(page, 'aggregation');
  expect(errors).toEqual([]);
});
