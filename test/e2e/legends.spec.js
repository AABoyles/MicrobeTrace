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
  const item = layout.contentItems.find(i => i.componentType === view);
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
  const empty = (await legend('node')).find(r => r.label === '(Empty)');
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
  const g0 = (await legend('node')).find(r => r.label === 'g0');
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

test('the map colors links by their first file, as the legend does, and docks it', async () => {
  const byValue = new Map((await legend('link')).map(r => [r.value, r.color]));
  await launchView(page, 'geo_map');
  // Each link drawn: its first file, and its color
  const strokes = () => page.evaluate(() => temp.geoMap ? temp.geoMap.drawn.links.map(l => [l.d.origin[0], l.stroke]) : []);
  await expect.poll(async () => (await strokes()).length).toBeGreaterThan(100);
  for (const [origin, color] of await strokes()) expect([origin, color]).toEqual([origin, byValue.get(origin)]);
  expect(await docked('geo_map', 'link')).toBe(true);
  // On the globe too
  await page.evaluate(() => MT.settings.set('map-projection', 'globe'));
  await expect.poll(() => page.evaluate(() => temp.geoMap.drawn.globe && temp.geoMap.drawn.links.length)).toBeGreaterThan(0);
  for (const [origin, color] of await strokes()) expect([origin, color]).toEqual([origin, byValue.get(origin)]);
  // Without a color variable, the link color
  await page.evaluate(() => MT.settings.set('link-color-variable', 'None'));
  const color = await page.evaluate(() => MT.settings.get('link-color'));
  await expect.poll(async () => [...new Set((await strokes()).map(s => s[1]))]).toEqual([color]);
  await page.evaluate(() => { MT.settings.set('link-color-variable', 'origin'); MT.settings.set('map-projection', 'mercator'); });
  await closeView(page, 'geo_map');
});

test('the histogram colors bars by the legend of its dataset, the only one it docks', async () => {
  // The node legend needs a color variable (an earlier test may have set one, but not on its own)
  await colorBy('node', 'group');
  const colors = (await legend('link')).map(r => r.color);
  await launchView(page, 'histogram');
  // (The view mounts once Plotly has loaded, so the plot may not be there at first)
  const bars = () => page.evaluate(() => (document.querySelector('.histogram-plot')?.data || []).map(t => t.marker.color));
  await expect.poll(async () => (await bars()).length).toBe(2);
  expect((await bars()).every(c => colors.includes(c))).toBe(true);
  await expect.poll(() => docked('histogram', 'link')).toBe(true);
  expect(await docked('histogram', 'node')).toBe(false);
  // Charting a node variable docks the node legend instead
  const nodeColors = (await legend('node')).map(r => r.color);
  await page.evaluate(() => MT.settings.set('histogram-variable', 'nodes-degree'));
  await expect.poll(() => docked('histogram', 'node')).toBe(true);
  expect(await docked('histogram', 'link')).toBe(false);
  // (The bars are redrawn after the legend docks, so they're polled for)
  await expect.poll(async () => (await bars()).every(c => nodeColors.includes(c))).toBe(true);
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

test('the link color table counts the links between visible nodes, finding nodes by _id or id (#244)', async () => {
  const result = await page.evaluate(() => {
    const variable = 'origin';
    session.style.widgets['link-color-variable'] = variable;
    const hidden = session.data.nodes[0];
    const wasVisible = hidden.visible;
    const actual = () => {
      MT.createLinkColorMap();
      return session.style.linkColorsTableKeys[variable].slice().sort().join('|');
    };
    // What a search over all the nodes finds
    const expected = () => {
      const seen = new Set();
      const find = id => session.data.nodes.find(d => d._id === id || d.id === id);
      MT.getVisibleLinks().forEach(l => {
        const s = find(l.source), t = find(l.target);
        if (!l.visible || !s || s.visible === false || !t || t.visible === false) return;
        l.origin.forEach(v => seen.add(String(v)));
      });
      return Array.from(seen).sort().join('|');
    };
    const out = { all: [actual(), expected()] };
    hidden.visible = false;
    out.hidden = [actual(), expected()];
    hidden.visible = wasVisible;
    actual();
    return out;
  });
  expect(result.all[0]).toBe(result.all[1]);
  expect(result.hidden[0]).toBe(result.hidden[1]);
  expect(result.all[0]).not.toBe('');
  expect(errors).toEqual([]);
});

// Select These Nodes (#295): a row's menu selects the visible nodes with its
// value, from the keyboard too
test('the node color table’s menu selects the nodes with a row’s value, from the keyboard', async () => {
  await colorBy('node', 'state');
  const rows = await legend('node');
  const target = rows[1];
  const expected = await page.evaluate(value => session.data.nodes.filter(d => d.visible && String(d.state) === value).map(d => d._id).sort(), target.value);
  // Start from some other selection, which the menu replaces
  await page.evaluate(() => session.data.nodes.forEach((d, i) => { d.selected = i === 0; }));
  const cell = page.locator(`#node-color-table-wrapper td[data-value="${target.value}"]`);
  await cell.focus();
  await page.keyboard.press('Shift+F10');
  const menu = page.locator('#node-color-table-context');
  await expect(menu).toBeVisible();
  await menu.locator('[data-action="select"]').focus();
  await page.keyboard.press('Enter');
  await expect(menu).toBeHidden();
  expect(await page.evaluate(() => session.data.nodes.filter(d => d.selected).map(d => d._id).sort())).toEqual(expected);
  await expect(page.locator('#mt-status')).toHaveText(new RegExp(`^${expected.length} nodes? selected$`));
  // The focus goes back to the row it was opened on
  await expect(cell).toBeFocused();
  expect(errors).toEqual([]);
  await page.evaluate(() => session.data.nodes.forEach(d => { d.selected = false; }));
});
