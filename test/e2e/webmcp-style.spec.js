// The WebMCP tools for settings, filtering, selection, styling and the timeline
const { test, expect } = require('@playwright/test');
const { watchErrors, loadNetwork } = require('./helpers');

test.describe.configure({ mode: 'serial' });

let page, errors;
test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  errors = watchErrors(page);
  await loadNetwork(page);
});
test.afterAll(() => page.close());

const call = (name, args = {}) => page.evaluate(([name, args]) => MTWebMCP.call(name, args), [name, args]);
const fails = (name, args = {}) => page.evaluate(async ([name, args]) => {
  try { await MTWebMCP.call(name, args); return null; } catch (e) { return e.message; }
}, [name, args]);
const visibleNodes = () => page.evaluate(() => session.data.nodes.filter(d => d.visible).length);
const setting = key => page.evaluate(key => MT.settings.get(key), key);

test('the tools are defined', async () => {
  const names = await page.evaluate(() => MTWebMCP.list().map(t => t.name));
  ['list_settings', 'set_settings', 'set_link_filter', 'select_nodes', 'color_nodes', 'set_timeline', 'reset_style'].forEach(n => expect(names).toContain(n));
});

test('settings can be listed, read and set', async () => {
  const list = await call('list_settings', { prefix: 'node-color' });
  const entry = list.items.find(i => i.key == 'node-color-variable');
  expect(entry.control).toBe('select');
  expect(entry.options.map(o => o.value)).toContain('None');
  expect(entry.default).toBe('None');
  const got = await call('get_settings', { keys: ['link-threshold', 'nope'] });
  expect(got.unknown).toEqual(['nope']);
  expect(await fails('set_settings', { values: { 'link-width': 'wide' } })).toMatch(/expected a number/);
  const r = await call('set_settings', { values: { 'node-color': 'red', bogus: 1 } });
  expect(r.applied['node-color'].new).toBe('#ff0000');
  expect(r.warnings.join()).toMatch(/bogus/);
  expect(await setting('node-color')).toBe('#ff0000');
});

test('the link filter changes the visible links and waits for the network', async () => {
  const before = await call('get_filter_state');
  expect(before.counts.links.visible).toBeGreaterThan(0);
  expect(before.linkValueRange.histogram.length).toBe(20);
  const r = await call('set_link_filter', { threshold: 0 });
  expect(r.state.linkThreshold).toBe(0);
  expect(r.state.counts.links.visible).toBeLessThan(before.counts.links.visible);
  const back = await call('set_link_filter', { threshold: before.linkThreshold });
  expect(back.state.counts.links.visible).toBe(before.counts.links.visible);
  expect(await fails('set_link_filter', { variable: 'contact' })).toMatch(/not numeric/);
});

test('the minimum cluster size hides nodes', async () => {
  const all = await visibleNodes();
  const r = await call('set_cluster_minimum_size', { size: 3 });
  expect(r.counts.nodes.visible).toBeLessThan(all);
  expect(await visibleNodes()).toBe(r.counts.nodes.visible);
  await call('reveal_all');
  expect(await visibleNodes()).toBe(all);
  expect(await setting('cluster-minimum-size')).toBe(1);
});

test('nodes can be selected, searched and expanded', async () => {
  let r = await call('select_nodes', { ids: ['S0', 'S1'] });
  expect(r.selectedCount).toBe(2);
  r = await call('select_nodes', { filter: [{ field: 'state', op: 'eq', value: 'Texas' }], mode: 'add' });
  expect(r.selectedCount).toBeGreaterThan(2);
  r = await call('select_nodes', { ids: ['S0'], mode: 'remove' });
  expect((await call('get_selection')).items).not.toContain('S0');
  r = await call('clear_selection');
  expect(r.selectedCount).toBe(0);
  r = await call('search_nodes', { query: 'g1', field: 'group', wholeWord: true });
  expect(r.matched).toBeGreaterThan(0);
  expect(await page.evaluate(() => session.data.nodes.filter(d => d.selected).every(d => d.group == 'g1'))).toBe(true);
  const seeds = r.selectedCount;
  r = await call('select_nodes', { ids: ['S0'] });
  const n1 = await call('select_neighbors', { depth: 1 });
  const n2 = await call('select_neighbors', { depth: 3 });
  expect(n1.selectedCount).toBeGreaterThan(1);
  expect(n2.selectedCount).toBeGreaterThanOrEqual(n1.selectedCount);
  r = await call('select_cluster', { nodeIds: ['S0'] });
  expect(r.selectedCount).toBeGreaterThanOrEqual(n2.selectedCount);
  expect(await page.locator('#numberOfSelectedNodes').textContent()).toBe(String(r.selectedCount));
  await call('search_nodes', { query: 'S1', mirrorSearchBox: true });
  expect(await page.inputValue('#search')).toBe('S1');
  await call('clear_selection');
  expect(await page.inputValue('#search')).toBe('');
});

test('nodes are colored and their value colors edited', async () => {
  const r = await call('color_nodes', { variable: 'state' });
  expect(r.legend.variable).toBe('state');
  expect(r.legend.values.length).toBeGreaterThan(1);
  expect(await page.locator('#node-color-table tr').count()).toBe(r.legend.values.length + 1);
  const value = r.legend.values[0].value;
  const e = await call('set_node_value_colors', { values: [{ value, color: 'rgb(255, 0, 0)', opacity: 0.5 }] });
  const row = e.legend.values.find(v => v.value == value);
  expect(row.color).toBe('#ff0000');
  expect(row.opacity).toBe(0.5);
  expect(await page.evaluate(v => temp.style.nodeColorMap(v), value)).toBe('#ff0000');
  expect(await page.locator('#node-color-table input[type=color]').first().inputValue()).toMatch(/^#/);
  expect(await fails('set_node_value_colors', { values: [{ value: 'Atlantis', color: '#000000' }] })).toMatch(/No row/);
  await call('rename_legend_value', { kind: 'node', value, name: 'Renamed' });
  expect((await call('get_color_legend', { kind: 'node' })).values.find(v => v.value == value).name).toBe('Renamed');
  await expect(page.locator('#node-color-table td', { hasText: 'Renamed' })).toHaveCount(1);
  const p = await call('set_palette', { kind: 'node', scheme: 'schemeSet1' });
  expect(p.palette[0]).toBe('#e41a1c');
  expect(p.legend.values[0].color).toBe('#e41a1c');
  await call('show_panels', { nodeColorTable: false });
  await expect(page.locator('#node-color-table-wrapper')).toBeHidden();
  await call('show_panels', { nodeColorTable: true });
  await expect(page.locator('#node-color-table-wrapper')).toBeVisible();
});

test('links are colored by origin', async () => {
  const r = await call('color_links', { variable: 'origin' });
  expect(r.legend.values.length).toBeGreaterThan(0);
  const w = await call('set_link_width', { width: 5, variable: 'None' });
  expect(w.width.width).toBe(5);
  await call('set_link_directed', { directed: true });
  expect(await setting('link-directed')).toBe(true);
  expect(await fails('label_links', { variable: 'nonsense' })).toMatch(/Unknown link field/);
});

test('node size, shape, labels, tooltips and colors are set', async () => {
  await call('size_nodes', { radius: 500 });
  expect(await setting('node-radius')).toBe(500);
  expect(await fails('size_nodes', { min: 900, max: 100 })).toMatch(/cannot exceed/);
  await call('set_node_shape', { shape: 'square' });
  expect(await setting('node-symbol')).toBe('symbolSquare');
  await call('label_nodes', { variable: 'group', size: 20, orientation: 'Top' });
  expect(await setting('node-label-variable')).toBe('group');
  await call('set_node_tooltip', { variables: ['_id', 'state'] });
  expect(await setting('node-tooltip-variable')).toEqual(['_id', 'state']);
  await call('set_node_border', { color: '#112233', width: 1 });
  await call('set_selected_color', { color: '#00ff00' });
  const b = await call('set_background_color', { color: '#000000' });
  expect(b.contrast).toBe('#ffffff');
  const style = await call('get_style');
  expect(style.settings['node-radius']).toBe(500);
});

test('the timeline scrubs and clears', async () => {
  const all = await visibleNodes();
  let t = await call('set_timeline', { variable: 'date' });
  expect(t.active).toBe(true);
  await expect(page.locator('#global-timeline-wrapper')).toBeVisible();
  t = await call('set_timeline', { position: 0.3 });
  expect(t.counts.nodes.visible).toBeLessThan(all);
  t = await call('set_timeline', { date: '2020-01-01' });
  expect(t.counts.nodes.visible).toBeLessThan(all);
  expect(await fails('set_timeline', { variable: 'state' })).toMatch(/fewer than two dates/);
  t = await call('clear_timeline');
  expect(t.active).toBe(false);
  await expect(page.locator('#global-timeline-wrapper')).toBeHidden();
  expect(await visibleNodes()).toBe(all);
});

test('reset_style restores the defaults', async () => {
  const r = await call('reset_style', {});
  expect(r.changes['node-radius'].new).toBe(250);
  expect(await setting('node-color-variable')).toBe('None');
  expect(await setting('background-color')).toBe('#ffffff');
  expect(await setting('background-color-contrast')).toBe('#000000');
  expect(errors).toEqual([]);
});
