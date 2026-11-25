// Opening more than one of a view (#365): numbered copies with their own
// settings, IDs and radio groups, saved and reopened with the session.
const { test, expect } = require('@playwright/test');
const { watchErrors, loadNetwork, waitForModal, webmcp } = require('./helpers');

test.describe.configure({ mode: 'serial' });

let page, errors, call, fails;
test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  errors = watchErrors(page);
  await loadNetwork(page, { webmcp: true });
  ({ call, fails } = webmcp(page));
});
test.afterAll(() => page.close());

const ids = () => page.evaluate(() => layout.contentItems.map(MT.viewId));
const titles = () => page.evaluate(() => [...document.querySelectorAll('.lm_tab .lm_title')].map(t => t.textContent));
const menu = async name => {
  await page.getByRole('button', { name: 'View', exact: true }).click();
  await page.locator('.viewbutton', { hasText: new RegExp(`^\\s*${name}\\s*$`) }).click();
};
// What a copy of a view holds, in its own element
const root = id => page.evaluateHandle(id => layout.contentItems.find(i => MT.viewId(i) === id).container.element, id);
const widget = key => page.evaluate(key => session.style.widgets[key], key);

test('the View menu opens another copy of a view that is open', async () => {
  await menu('Map');
  await expect.poll(ids).toEqual(['network', 'geo_map']);
  await menu('Map');
  await expect.poll(ids).toEqual(['network', 'geo_map', 'geo_map@2']);
  expect(await titles()).toEqual(['Network', 'Map', 'Map 2']);
  await expect.poll(async () => (await root('geo_map@2')).evaluate(el => el.querySelectorAll('canvas.map-canvas').length)).toBe(1);
});

test('the network, files and conflicts open once: the menu brings them to the front', async () => {
  await menu('Network');
  await expect.poll(() => page.evaluate(() => document.querySelector('.lm_tab.lm_active .lm_title').textContent)).toBe('Network');
  expect(await ids()).toEqual(['network', 'geo_map', 'geo_map@2']);
});

test('each copy has its own settings, and shares the rest', async () => {
  await page.evaluate(() => MT.loadLayout({ type: 'row', content: [
    { type: 'stack', content: [{ type: 'geo_map' }] },
    { type: 'stack', content: [{ type: 'geo_map', instance: 2 }] }
  ] }));
  await expect.poll(ids).toEqual(['geo_map', 'geo_map@2']);
  await (await root('geo_map@2')).evaluate(el => {
    const select = el.querySelector('[data-setting="map-projection"]');
    select.value = 'globe';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    // A group of radio buttons, too
    const radio = [...el.querySelectorAll('[data-setting="map-node-show"]')].find(r => r.value === 'false');
    radio.checked = true;
    radio.dispatchEvent(new Event('change', { bubbles: true }));
  });
  expect(await widget('map-node-show@2')).toBe(false);
  expect(await widget('map-node-show')).toBe(true);
  const nodesShown = async id => (await root(id)).evaluate(el => el.querySelector('[data-setting="map-node-show"]:checked').value);
  expect([await nodesShown('geo_map'), await nodesShown('geo_map@2')]).toEqual(['true', 'false']);
  expect(await widget('map-projection@2')).toBe('globe');
  expect(await widget('map-projection')).toBe('mercator');
  const chosen = async id => (await root(id)).evaluate(el => el.querySelector('[data-setting="map-projection"]').value);
  expect(await chosen('geo_map')).toBe('mercator');
  expect(await chosen('geo_map@2')).toBe('globe');
  const label = async id => (await root(id)).evaluate(el => el.querySelector('canvas.map-canvas').getAttribute('aria-describedby'));
  expect(await label('geo_map')).not.toBe(await label('geo_map@2'));
});

test('no two elements on the page share an ID, and labels and dialogs find their own', async () => {
  await page.evaluate(() => MT.loadLayout({ type: 'stack', content: ['geo_map', 'table', 'crosstab', 'aggregation', 'bubbles', 'gantt', 'phylogenetic_tree', 'heatmap']
    .flatMap(type => [{ type }, { type }]) }));
  await expect.poll(async () => (await ids()).length).toBe(16);
  const twice = await page.evaluate(() => {
    const seen = new Set(), out = [];
    layout.contentItems.forEach(i => i.container.element.querySelectorAll('[id]').forEach(el => (seen.has(el.id) ? out.push(el.id) : seen.add(el.id))));
    return out;
  });
  expect(twice).toEqual([]);
  const astray = await page.evaluate(() => layout.contentItems.flatMap(i => {
    const el = i.container.element;
    return [...el.querySelectorAll('label[for], [data-bs-target^="#"], [aria-controls]')]
      .map(e => e.getAttribute('for') || (e.dataset.bsTarget || '').slice(1) || e.getAttribute('aria-controls'))
      // (Tom Select's menus are the page's, with IDs of their own)
      .filter(id => id && !id.startsWith('tomselect') && document.getElementById(id) && !el.contains(document.getElementById(id)));
  }));
  expect(astray).toEqual([]);
});

test('the export dialog of a second copy is its own', async () => {
  await page.evaluate(() => MT.launchView('heatmap@2'));
  const id = await (await root('heatmap@2')).evaluate(el => el.querySelector('.view-controls [data-bs-toggle="modal"]').dataset.bsTarget);
  await (await root('heatmap@2')).evaluate(el => el.querySelector('.view-controls [data-bs-toggle="modal"]').click());
  await waitForModal(page, id);
  await expect(page.locator(id + ' [name="export-filename"]')).toHaveValue(/^microbetrace-heatmap-2-/);
  await page.locator(id + ' .btn-close').click();
  await expect(page.locator(id)).toBeHidden();
});

test('the layout and each copy’s settings are saved and reopened', async () => {
  await page.evaluate(() => MT.loadLayout({ type: 'stack', content: [{ type: 'geo_map' }, { type: 'geo_map', instance: 2 }, { type: 'network' }, { type: 'network' }] }));
  // (The network opens once)
  await expect.poll(ids).toEqual(['geo_map', 'geo_map@2', 'network']);
  const saved = { type: 'stack', content: [{ type: 'geo_map' }, { type: 'geo_map', instance: 2 }, { type: 'network' }] };
  await expect.poll(() => page.evaluate(() => session.layout)).toEqual(saved);
  // The first closes, and the second keeps its number and settings
  await page.evaluate(() => layout.contentItems.find(i => MT.viewId(i) === 'geo_map').remove());
  await expect.poll(() => page.evaluate(() => session.layout)).toEqual({ type: 'stack', content: saved.content.slice(1) });
  await page.evaluate(() => MT.loadLayout(session.layout));
  await expect.poll(ids).toEqual(['geo_map@2', 'network']);
  await expect.poll(async () => (await root('geo_map@2')).evaluate(el => (el.querySelector('[data-setting="map-projection"]') || {}).value)).toBe('globe');
  // The menu then opens the first again
  await menu('Map');
  await expect.poll(ids).toEqual(['geo_map@2', 'network', 'geo_map']);
});

test('a layout from a file can’t give a view a number that isn’t one', async () => {
  await page.evaluate(() => MT.loadLayout({ type: 'stack', content: [{ type: 'table', instance: '"><img src=x>' }, { type: 'table', instance: 1 }, { type: 'table', instance: -3 }] }));
  await expect.poll(ids).toEqual(['table', 'table@2', 'table@3']);
});

test('agents open, set and lay out copies by their numbers', async () => {
  let out = await call('set_layout', { layout: { type: 'stack', content: [{ type: 'geo_map' }] } });
  expect(out.openViews).toEqual(['geo_map']);
  out = await call('open_view', { view: 'geo_map', another: true, placement: 'right', relativeTo: 'geo_map' });
  expect(out.opened).toBe('geo_map@2');
  expect(out.openViews).toEqual(['geo_map', 'geo_map@2']);
  await call('set_view_settings', { view: 'geo_map@2', settings: { 'map-graticule-show': true } });
  expect(await widget('map-graticule-show@2')).toBe(true);
  expect(await widget('map-graticule-show')).toBe(false);
  const listed = (await call('list_views')).views.find(v => v.id === 'geo_map');
  expect(listed.copies).toEqual(['geo_map', 'geo_map@2']);
  expect((await call('close_view', { view: 'geo_map@2' })).openViews).toEqual(['geo_map']);
  expect(await fails('open_view', { view: 'network', another: true })).toMatch(/only once/);
  expect(errors).toEqual([]);
});
