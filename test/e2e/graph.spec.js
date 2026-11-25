// The Graph view (#366): its types of graph, datasets and variables, what they draw
// and leave out, how its settings are saved, and export. And sessions saved when the
// histogram, the scatterplot and the epi curve were views of their own.
const fs = require('fs');
const { test, expect } = require('@playwright/test');
const { imageStats, watchErrors, loadNetwork, launchView, closeView, openExport } = require('./helpers');

test.describe.configure({ mode: 'serial' });

let page, errors;
test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  errors = watchErrors(page);
  await loadNetwork(page);
  await launchView(page, 'graph');
});
test.afterAll(() => page.close());

const view = () => page.locator('.lm_content:has(.graph-plot)').first();
const pane = () => view().locator('.left-pane');
const widget = key => page.evaluate(key => session.style.widgets[key], key);
const set = settings => page.evaluate(settings => Object.entries(settings).forEach(([k, v]) => MT.settings.set(k, v)), settings);
const label = text => pane().locator('label.btn', { hasText: new RegExp(`^\\s*${text}\\s*$`) });
const options = name => pane().getByLabel(name).evaluate(el => Array.from(el.options).map(o => o.value));
const setThreshold = value => page.evaluate(value => (el => { el.value = value; el.dispatchEvent(new Event('change', { bubbles: true })); })(document.getElementById('link-threshold')), value);
const setColor = (kind, variable) => page.evaluate(([kind, variable]) => (el => { el.value = variable; el.dispatchEvent(new Event('change', { bubbles: true })); })(document.getElementById(kind + '-color-variable')), [kind, variable]);

// What's drawn: its titles, and its bars, petals or points
const graph = () => view().locator('.graph-svg').evaluate(el => {
  const all = selector => Array.from(el.querySelectorAll(selector));
  const bars = all('.bar').map(b => ({ count: +b.dataset.count, bin: +b.dataset.bin, group: b.dataset.group, title: b.textContent }));
  const text = selector => { const t = el.querySelector(selector); return t && t.textContent; };
  return {
    type: el.dataset.type,
    x: text('.x-title'), y: text('.y-title'), note: text('.graph-note'),
    bars, total: bars.reduce((sum, b) => sum + b.count, 0),
    groups: new Set(bars.map(b => b.group)).size,
    points: +((el.querySelector('.scatter') || { dataset: {} }).dataset.points || 0),
    width: +el.getAttribute('width')
  };
});

test('draws a histogram of the links’ distances by default, in the colors of the link legend', async () => {
  await expect.poll(async () => (await graph()).x).toBe('TN93');
  const g = await graph();
  expect([g.type, g.y]).toEqual(['histogram', 'Number of Links']);
  expect(g.total).toBe(299);
  // Colored by origin: by the file each link came from first
  expect(g.groups).toBe(2);
});

test('the settings pane opens and closes', async () => {
  const toggle = view().locator('.settings-toggle');
  await toggle.click();
  await expect.poll(() => pane().evaluate(el => getComputedStyle(el).left)).toBe('0px');
  await toggle.click();
  await expect(pane()).toBeHidden();
  await toggle.click();
  await expect(pane()).toBeVisible();
});

test('choosing a dataset and a variable redraws, and is saved', async () => {
  await label('Nodes').click();
  await expect.poll(() => options('X Variable')).toContain('degree');
  await pane().getByLabel('X Variable').selectOption('degree');
  await expect.poll(async () => (await graph()).x).toBe('Degree');
  const g = await graph();
  expect([g.y, g.total]).toEqual(['Number of Nodes', 310]);
  // A bar for each whole number
  const degrees = await page.evaluate(() => d3.rollup(session.data.nodes, v => v.length, d => d.degree).get(0));
  expect(g.bars.find(b => b.title === `0: ${degrees} nodes`)).toBeTruthy();
  expect([await widget('graph-data'), await widget('graph-x')]).toEqual(['nodes', 'degree']);
});

test('bars run across, or up', async () => {
  await label('Bars').click();
  await expect.poll(async () => (await graph()).y).toBe('Degree');
  expect(await widget('graph-horizontal')).toBe(true);
  expect((await graph()).x).toBe('Number of Nodes');
  await label('Columns').click();
  await expect.poll(async () => (await graph()).x).toBe('Degree');
});

test('counts can be on a log scale, where a bar of one still shows', async () => {
  await label('Log').click();
  await expect.poll(() => view().locator('.axis--y .tick text').first().textContent()).toBe('1');
  expect(await view().locator('rect.bar').evaluateAll(els => Math.min(...els.map(el => +el.getAttribute('height'))))).toBeGreaterThan(1);
  await label('Linear').click();
  await expect.poll(() => view().locator('.axis--y .tick text').first().textContent()).toBe('0');
});

test('coloring nodes by a variable stacks the bars, the smaller groups at the bottom (#242)', async () => {
  await setColor('node', 'group');
  await expect.poll(async () => (await graph()).groups).toBe(5);
  const g = await graph();
  expect(g.total).toBe(310);
  // (The nodes with no group are the fewest)
  const fewest = g.bars.find(b => b.title.includes('(Empty)'));
  expect(g.bars.filter(b => b.bin === fewest.bin)[0]).toEqual(fewest);
  await setColor('node', 'None');
  await expect.poll(async () => (await graph()).groups).toBe(1);
});

test('dates are counted by calendar period, and undated nodes are said to be left out', async () => {
  await pane().getByLabel('X Variable').selectOption('date');
  const dated = await page.evaluate(() => session.data.nodes.filter(d => MT.parseDate(d.date)).length);
  await expect.poll(async () => (await graph()).total).toBe(dated);
  expect((await graph()).note).toBe(`${310 - dated} undated nodes not shown`);
  await pane().getByLabel('Dates By').selectOption('month');
  await expect.poll(async () => (await graph()).bars.length).toBe(12);
  await label('Cumulative').click();
  await expect.poll(async () => (await graph()).bars[11].count).toBe(dated);
  expect((await graph()).y).toBe('Cumulative Number of Nodes');
  await label('Separate').click();
  await expect.poll(async () => (await graph()).total).toBe(dated);
});

test('a bar chart counts each value of a variable', async () => {
  await pane().getByLabel('Type').selectOption('bar');
  await pane().getByLabel('X Variable').selectOption('state');
  await expect.poll(async () => (await graph()).bars.map(b => b.title)).toEqual(
    ['Georgia', 'Maine', 'Ohio', 'Texas', 'Utah'].map(s => s + ': 60 nodes').concat('(Empty): 10 nodes'));
  // Only the settings that apply are shown
  await expect(pane().getByLabel('Dates By')).toBeHidden();
  await expect(pane().getByLabel('Y Variable')).toBeHidden();
  await expect(pane().getByLabel('Stratify By')).toBeHidden();
});

test('a variable with very many values draws the most common, and says so', async () => {
  await pane().getByLabel('X Variable').selectOption('_id');
  await expect.poll(async () => (await graph()).bars.length).toBe(200);
  expect((await graph()).note).toBe('110 more values not shown');
  // Their labels don't overlap
  const tops = await view().locator('.axis--x .tick').count();
  expect(tops).toBeLessThan(100);
});

test('a line plot counts along a variable, a line for each color', async () => {
  await set({ 'graph-type': 'line', 'graph-x': 'date' });
  await expect(view().locator('path.line')).toHaveCount(1);
  await setColor('node', 'group');
  // (The nodes with no group are undated)
  await expect(view().locator('path.line')).toHaveCount(4);
  expect(await view().locator('.point').evaluateAll(els => els.reduce((sum, el) => sum + +el.dataset.count, 0))).toBe(300);
  await expect(view().locator('path.line').first()).not.toHaveAttribute('d', /NaN/);
});

test('a wind rose wraps columns around a center, one for each value it’s stratified by', async () => {
  await set({ 'graph-type': 'rose', 'graph-x': 'state', 'graph-stratify': 'None' });
  await expect(view().locator('.rose')).toHaveCount(1);
  expect((await graph()).total).toBe(310);
  await pane().getByLabel('Stratify By').selectOption('group');
  await expect(view().locator('.rose')).toHaveCount(5);
  expect((await graph()).total).toBe(310);
  expect(await view().locator('.rose').evaluateAll(els => els.map(el => el.dataset.stratum))).toEqual(['g0', 'g1', 'g2', 'g3', '(Empty)']);
  // All to one scale
  expect(new Set(await view().locator('.rose').evaluateAll(els => els.map(el => Math.max(...[...el.querySelectorAll('.ring')].map(r => +r.getAttribute('r')))))).size).toBe(1);
  expect(await view().locator('.rose path.bar').evaluateAll(els => els.filter(el => /NaN/.test(el.getAttribute('d'))).length)).toBe(0);
  await setColor('node', 'None');
});

test('a scatterplot places each item by two variables, which can be dates or text', async () => {
  await set({ 'graph-type': 'scatter', 'graph-x': 'degree', 'graph-y': 'cluster' });
  await expect.poll(async () => (await graph()).points).toBe(310);
  expect([(await graph()).x, (await graph()).y]).toEqual(['Degree', 'Cluster']);
  await set({ 'graph-x': 'date', 'graph-y': 'state' });
  await expect.poll(async () => (await graph()).points).toBe(300);
  expect(await view().locator('.axis--y .tick text').allTextContents()).toEqual(['Georgia', 'Maine', 'Ohio', 'Texas', 'Utah']);
  expect((await graph()).note).toBe('10 undated nodes not shown');
});

test('pointing at a point says what it is', async () => {
  await set({ 'graph-y': 'degree' });
  await expect.poll(async () => (await graph()).points).toBe(300);
  const point = view().locator('circle.point').last();
  // (Clear of the settings pane)
  await point.hover({ force: true });
  await expect(page.locator('#tooltip')).toContainText(/Date: \d{4}-\d{2}-\d{2}/);
  await expect(page.locator('#tooltip')).toContainText(/Degree: \d+/);
});

test('a distance that isn’t a number is left out, and said to be', async () => {
  await set({ 'graph-data': 'links', 'graph-x': 'cluster', 'graph-y': 'distance' });
  // (Only the 10 links of the link list have the field)
  await expect.poll(async () => (await graph()).points).toBe(10);
  expect((await graph()).note).toBe('289 links with no Distance not shown');
  await set({ 'graph-log': true, 'graph-y': 'tn93' });
  await expect.poll(async () => (await graph()).points).toBe(299);
  await set({ 'graph-log': false });
});

test('more than 2,000 points are drawn as a picture, and still export under the CSP (#252)', async () => {
  // (Nearly every pair of the 300 sequences is within 1)
  await setThreshold(1);
  await expect.poll(async () => (await graph()).points).toBeGreaterThan(40000);
  await expect(view().locator('circle.point')).toHaveCount(0);
  for (const [filetype, check] of [
    ['png', bytes => bytes.subarray(1, 4).toString() === 'PNG'],
    ['svg', bytes => /<svg[\s\S]*<image[^>]*href="data:image\/png/.test(bytes.toString())]
  ]) {
    const modal = await openExport(page, view(), 'Export Graph');
    await modal.getByPlaceholder('Filename').fill('scatter-big');
    await modal.locator('[name="export-filetype"]').selectOption(filetype);
    const [download] = await Promise.all([page.waitForEvent('download'), modal.locator('button', { hasText: 'Export' }).click()]);
    expect(download.suggestedFilename()).toBe('scatter-big.' + filetype);
    const bytes = fs.readFileSync(await download.path());
    expect(bytes.length).toBeGreaterThan(10000);
    expect(check(bytes)).toBe(true);
    if (filetype === 'png') expect((await imageStats(page, download)).colors).toBeGreaterThan(10);
    await expect(modal).toBeHidden();
  }
  // (A blob: image the Content Security Policy refused would be logged as an error)
  expect(errors).toEqual([]);
  await setThreshold(0.015);
  await expect.poll(async () => (await graph()).points).toBe(299);
});

test('clusters can be drawn, lone nodes not among them', async () => {
  await label('Clusters').click();
  await pane().getByLabel('Type').selectOption('histogram');
  await pane().getByLabel('X Variable').selectOption('nodes');
  await expect.poll(async () => (await graph()).y).toBe('Number of Clusters');
  expect((await graph()).total).toBe(+(await page.locator('#numberOfDisjointComponents').textContent()));
});

test('reopening the view restores its settings', async () => {
  await set({ 'graph-data': 'nodes', 'graph-x': 'degree', 'graph-horizontal': true });
  await closeView(page, 'graph');
  await launchView(page, 'graph');
  await expect.poll(async () => (await graph()).y).toBe('Degree');
  await expect(pane().getByLabel('X Variable')).toHaveValue('degree');
  await expect(label('Nodes').locator('input')).toBeChecked();
  await expect(label('Bars').locator('input')).toBeChecked();
  await set({ 'graph-horizontal': false });
  await expect.poll(async () => (await graph()).x).toBe('Degree');
  await expect(label('Columns').locator('input')).toBeChecked();
});

test('redraws when the background color or the visible links change', async () => {
  const background = value => page.evaluate(value => (el => { el.value = value; el.dispatchEvent(new Event('change', { bubbles: true })); })(document.getElementById('background-color')), value);
  await background('#000000');
  await expect.poll(() => view().locator('.graph-svg').evaluate(el => el.style.color)).toBe('rgb(255, 255, 255)');
  await background('#ffffff');
  await set({ 'graph-data': 'links', 'graph-x': 'tn93' });
  await expect.poll(async () => (await graph()).total).toBe(299);
  await setThreshold(0.005);
  await expect.poll(async () => (await graph()).total).toBeLessThan(299);
  await setThreshold(0.015);
  await expect.poll(async () => (await graph()).total).toBe(299);
});

test('with nothing to draw, it says so', async () => {
  await setThreshold(0);
  await expect(view().locator('.view-message')).toHaveText('There are no links to draw.');
  await setThreshold(0.015);
  await expect(view().locator('.view-message')).toBeHidden();
});

test('the graph follows the panel size', async () => {
  const before = (await graph()).width;
  await page.setViewportSize({ width: 1000, height: 900 });
  await expect.poll(async () => (await graph()).width).toBeLessThan(before - 200);
  await page.setViewportSize({ width: 1400, height: 900 });
  await expect.poll(async () => (await graph()).width).toBe(before);
});

test('exports a PNG', async () => {
  const modal = await openExport(page, view(), 'Export Graph');
  await modal.getByPlaceholder('Filename').fill('graph-test');
  const [download] = await Promise.all([page.waitForEvent('download'), modal.locator('button', { hasText: 'Export' }).click()]);
  expect(download.suggestedFilename()).toBe('graph-test.png');
  // The graph, with its styles: more than its background
  const stats = await imageStats(page, download);
  expect(stats.width).toBe((await graph()).width);
  expect(stats.colors).toBeGreaterThan(10);
  expect(errors).toEqual([]);
});

test('closing the view stops its subscriptions', async () => {
  const subscribers = () => page.evaluate(() => ['graph-type', 'graph-x', 'graph-log'].map(k => (MT.settings.subscribers.get(k) || new Set()).size));
  expect(await subscribers()).toEqual([2, 2, 2]);
  await closeView(page, 'graph');
  expect(await subscribers()).toEqual([0, 0, 0]);
  expect(errors).toEqual([]);
});

// A session as saved before: the data here, with the old views' settings and layout
const oldSession = changes => page.evaluate(changes => {
  MT.syncLayout();
  const old = JSON.parse(JSON.stringify(session));
  const w = old.style.widgets;
  Object.keys(w).filter(k => /^(graph|sankey)-/.test(k)).forEach(k => delete w[k]);
  Object.assign(w, {
    'histogram-axis-x': true, 'histogram-scale-log': false, 'histogram-variable': 'nodes-degree',
    'scatterplot-xVar': 'cluster', 'scatterplot-yVar': 'tn93', 'scatterplot-logScale': true, 'scatterplot-showNodes': false,
    'timeline-bin': 'month', 'timeline-date-field': 'None', 'timeline-noncumulative': false, 'flow-showNodes': false
  }, changes.widgets);
  old.layout = changes.layout;
  Object.assign(old.state, changes.state);
  return MT.applySession(old);
}, changes);
const ids = () => page.evaluate(() => layout.contentItems.map(MT.viewId));
const stack = (...types) => ({ type: 'stack', content: types.map(type => ({ type })) });

test('a session with the old views opens a graph for each, with its settings', async () => {
  expect(await oldSession({ layout: stack('network', 'scatterplot', 'histogram', 'timeline', 'flow_diagram') })).toBe(true);
  await expect.poll(ids).toEqual(['network', 'graph', 'graph@2', 'graph@3', 'sankey_diagram']);
  expect(await page.evaluate(() => ['graph-type', 'graph-x', 'graph-y', 'graph-log'].map(k => MT.settings.get(k)))).toEqual(['scatter', 'cluster', 'tn93', true]);
  expect(await page.evaluate(() => ['graph-type@2', 'graph-data@2', 'graph-x@2'].map(k => MT.settings.get(k)))).toEqual(['histogram', 'nodes', 'degree']);
  await page.evaluate(() => MT.launchView('graph@3'));
  const curve = page.locator('.lm_content:has(.graph-plot):visible');
  await expect(curve.locator('.x-title')).toHaveText('Date');
  await expect(curve.locator('.y-title')).toHaveText('Cumulative Number of Nodes');
  expect(await page.evaluate(() => Object.keys(session.style.widgets).filter(k => /^(histogram|scatterplot|flow)-/.test(k)))).toEqual([]);
  expect(await widget('sankey-showNodes')).toBe(false);
});

test('nodes the epi curve’s brush hid stay hidden, by the timeline, where they can be shown again', async () => {
  await oldSession({ layout: stack('network', 'timeline'), widgets: { 'timeline-date-field': 'date' }, state: { timeEnd: new Date(2020, 5, 1).getTime() } });
  await expect.poll(ids).toEqual(['network', 'graph']);
  await expect(page.locator('#global-timeline-wrapper')).toBeVisible();
  const visible = () => page.evaluate(() => session.data.nodes.filter(d => d.visible).length);
  await expect.poll(visible).toBeLessThan(250);
  expect(await visible()).toBeGreaterThan(50);
  await page.evaluate(() => MT.settings.set('node-timeline-variable', 'None'));
  await expect.poll(visible).toBe(310);
  // With nothing hidden, the timeline stays off
  await oldSession({ layout: stack('network', 'timeline'), widgets: { 'timeline-date-field': 'date', 'node-timeline-variable': 'None' }, state: { timeEnd: new Date(2030, 1, 1).getTime() } });
  await expect.poll(ids).toEqual(['network', 'graph']);
  expect([await widget('timeline-date-field'), await widget('node-timeline-variable'), await widget('graph-x')]).toEqual(['None', 'None', 'date']);
  expect(errors).toEqual([]);
});
