// WebMCP tools for views (src/webmcp/views.js)
const { test, expect } = require('@playwright/test');
const { watchErrors, loadNetwork, webmcp } = require('./helpers');

test.describe.configure({ mode: 'serial' });

let page, errors, tools;
test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  errors = watchErrors(page);
  await loadNetwork(page, { webmcp: true });
  tools = webmcp(page);
});
test.afterAll(() => page.close());

// Tools that ask the user are allowed, as the user would
const call = (name, args) => tools.call(name, args);
const agent = (name, args) => tools.agent(name, args);

test('list_views and open_view', async () => {
  const list = await call('list_views');
  expect(list.views.map(v => v.id)).toContain('phylogenetic_tree');
  expect(list.views.find(v => v.id == 'network').open).toBe(true);
  const r = await call('open_view', { view: 'histogram' });
  expect(r.openViews).toContain('histogram');
  expect(r.activeViews).toContain('histogram');
});

test('placement splits the layout', async () => {
  const r = await call('open_view', { view: 'table', placement: 'right', relativeTo: 'network' });
  expect(r.layout.type).toBe('row');
  const views = await call('list_views');
  expect(views.views.find(v => v.id == 'table').visible).toBe(true);
  expect(views.views.find(v => v.id == 'histogram').visible).toBe(true);
  const set = await call('set_layout', { layout: { type: 'column', content: [{ type: 'stack', content: [{ type: 'network' }] }, { type: 'stack', content: [{ type: 'histogram' }, { type: 'table' }], active: 'histogram' }] } });
  expect(set.layout.type).toBe('column');
  expect(set.activeViews).toContain('histogram');
  await call('close_view', { view: 'table' });
  expect((await call('get_layout')).openViews).not.toContain('table');
});

test('view settings are discoverable and settable', async () => {
  await call('focus_view', { view: 'histogram' });
  const s = await call('get_view_settings', { view: 'histogram' });
  const v = s.settings.find(x => x.key == 'histogram-variable');
  expect(v.type).toBe('choice');
  expect(v.options.length).toBeGreaterThan(2);
  const log = s.settings.find(x => x.key == 'histogram-scale-log');
  expect(log.type).toBe('boolean');
  const r = await call('set_view_settings', { view: 'histogram', settings: { 'histogram-scale-log': true } });
  expect(r.changes[0].to).toBe(true);
  expect(await page.evaluate(() => document.querySelector('.js-plotly-plot').layout.yaxis.type)).toBe('log');
  await call('set_view_settings', { view: 'histogram', settings: { 'histogram-scale-log': false } });
  await expect(call('set_view_settings', { view: 'histogram', settings: { 'histogram-variable': 'nonsense' } })).rejects.toThrow(/must be one of/);
  const n = await call('get_view_settings', { view: 'network', open: true });
  expect(n.count).toBeGreaterThan(30);
  const range = n.settings.find(x => x.type == 'number' && x.control == 'slider');
  expect(range.max).toBeGreaterThan(range.min);
});

test('view actions', async () => {
  const a = await call('list_view_actions', { view: 'network' });
  expect(a.actions.map(x => x.title)).toContain('Pin all Nodes');
  const r = await call('invoke_view_action', { view: 'network', action: 'Pin all' });
  expect(r.state.pressed).toBe(true);
  expect(await page.evaluate(() => session.network.allPinned)).toBe(true);
  await call('invoke_view_action', { view: 'network', action: 'pin-all-nodes' });
  expect(await page.evaluate(() => session.network.allPinned)).toBe(false);
});

test('network control and layout', async () => {
  const s = await call('network_control', { action: 'fit' });
  expect(s.nodes).toBe(310);
  const l = await call('get_network_layout', { limit: 5 });
  expect(l.nodes).toHaveLength(5);
  expect(typeof l.nodes[0].x).toBe('number');
  const p = await call('network_control', { action: 'pin_all' });
  expect(p.allPinned).toBe(true);
  await call('network_control', { action: 'unpin_all' });
});

test('images of every view', async () => {
  const views = ['network', 'histogram', 'scatterplot', 'heatmap', 'table', 'phylogenetic_tree', 'bubbles', 'timeline', 'waterfall', 'sequences', 'crosstab', 'geo_map', 'globe'];
  for (const view of views) {
    await call('open_view', { view });
    const r = await agent('get_view_image', { view, maxWidth: 600 });
    expect(r.isError, view + ': ' + JSON.stringify(r.content[0].text)).toBeFalsy();
    const img = r.content.find(c => c.type == 'image');
    expect(img, view).toBeTruthy();
    expect(img.mimeType).toBe('image/png');
    const meta = JSON.parse(r.content.find(c => c.type == 'text').text);
    expect(meta.width, view).toBeLessThanOrEqual(600);
    const colors = await page.evaluate(async data => {
      const i = new Image(); i.src = 'data:image/png;base64,' + data; await i.decode();
      const c = document.createElement('canvas'); c.width = i.width; c.height = i.height;
      const x = c.getContext('2d'); x.drawImage(i, 0, 0);
      const d = x.getImageData(0, 0, c.width, c.height).data; const s = new Set();
      for (let k = 0; k < d.length; k += 16) s.add(d[k] << 16 | d[k + 1] << 8 | d[k + 2]);
      return s.size;
    }, img.data);
    console.log(view, meta.method, meta.width + 'x' + meta.height, colors + ' colors');
    expect(colors, view + ' looks blank').toBeGreaterThan(1);
  }
});

test('export_view returns content or downloads', async () => {
  await call('open_view', { view: 'phylogenetic_tree' });
  const nwk = await call('export_view', { view: 'phylogenetic_tree', format: 'nwk', download: false });
  expect(nwk.content).toMatch(/\(.*\);/);
  await call('open_view', { view: 'table' });
  const csv = await call('export_view', { view: 'table', format: 'csv', download: false });
  expect(csv.content.split('\n').length).toBeGreaterThan(100);
  const svg = await call('export_view', { view: 'network', format: 'svg', download: false });
  expect(svg.content).toMatch(/<svg/);
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    call('export_view', { view: 'histogram', format: 'png', filename: 'hist' })
  ]);
  expect(download.suggestedFilename()).toBe('hist.png');
  await expect(call('export_view', { view: 'histogram', format: 'csv', download: false })).rejects.toThrow(/exports:/);
});

test('set_view_control', async () => {
  await call('open_view', { view: 'crosstab' });
  const s = await call('get_view_settings', { view: 'crosstab' });
  const menu = s.other_controls.find(c => c.type == 'choice' && c.options.length > 2);
  expect(menu).toBeTruthy();
  const r = await call('set_view_control', { view: 'crosstab', control: menu.control, value: menu.options[2].value });
  expect(r.value).toBe(menu.options[2].value);
});

test('no new errors', () => expect(errors).toEqual([]));
