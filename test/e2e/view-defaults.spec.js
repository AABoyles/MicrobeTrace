// What views open on: variables chosen from the data (crosstab, Sankey diagram,
// graph), the first field of dates (graph, Gantt) or a note saying
// what to choose, and sizes that fit the view (bubbles, tree leaves).
const { test, expect } = require('@playwright/test');
const { watchErrors, loadNetwork, launchView, closeView } = require('./helpers');

test.describe.configure({ mode: 'serial' });

let page, errors;
test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  errors = watchErrors(page);
  await loadNetwork(page);
});
test.afterAll(() => page.close());

const view = selector => page.locator(`.lm_content:has(${selector})`).first();

test("the data's categorical, numeric and date fields are found", async () => {
  const fields = await page.evaluate(() => ({
    categorical: MT.categoricalFields(session.data.nodes, session.data.nodeFields),
    numeric: MT.numericFields(MT.getVisibleLinks(), session.data.linkFields),
    dates: MT.dateFields(session.data.nodes, session.data.nodeFields)
  }));
  expect(fields).toEqual({ categorical: ['state', 'group'], numeric: ['tn93'], dates: ['date'] });
});

test('the crosstab opens on two categorical variables, drawn', async () => {
  await launchView(page, 'crosstab');
  const crosstab = view('.crosstab-grid');
  await expect(crosstab.locator('.crosstab-x')).toHaveValue('state');
  await expect(crosstab.locator('.crosstab-y')).toHaveValue('group');
  await expect.poll(() => crosstab.locator('.tabulator').evaluate(el => {
    const t = Tabulator.findTable(el).pop();
    return t.getColumns().map(c => c.getDefinition().title).slice(1).length;
  })).toBe(6); // five states and (Empty)
  await expect(crosstab.locator('.left-pane')).toBeHidden();
  await closeView(page, 'crosstab');
});

test('the Sankey diagram opens on two categorical variables', async () => {
  await launchView(page, 'sankey_diagram');
  const sankey = view('.sankey-plot');
  await expect.poll(() => sankey.locator('.sankey-headings text').allTextContents()).toEqual(['State', 'Group']);
  // A dozen labels, not a hundred clusters
  expect(await sankey.locator('.sankey-nodes rect').count()).toBeLessThan(15);
  await closeView(page, 'sankey_diagram');
});

test('the graph opens on the links’ distances, and the nodes’ first field of dates, with faint gridlines', async () => {
  await launchView(page, 'graph');
  const graph = view('.graph-plot');
  await expect(graph.locator('.x-title')).toHaveText('TN93');
  const alpha = +(await graph.locator('.grid').first().evaluate(el => el.style.stroke)).match(/rgba\(.*,\s*([\d.]+)\)/)[1];
  expect(alpha).toBeLessThan(0.3);
  await page.evaluate(() => MT.settings.set('graph-data', 'nodes'));
  await expect(graph.locator('.x-title')).toHaveText('Date');
  const dated = await page.evaluate(() => session.data.nodes.filter(d => MT.parseDate(d.date)).length);
  await expect.poll(() => graph.locator('rect.bar').evaluateAll(els => els.reduce((s, el) => s + +el.dataset.count, 0))).toBe(dated);
  // A scatterplot starts on a measurement other than its X
  await page.evaluate(() => { MT.settings.set('graph-data', 'links'); MT.settings.set('graph-type', 'scatter'); });
  await expect(graph.locator('.x-title')).toHaveText('TN93');
  await expect(graph.locator('.y-title')).toHaveText('Cluster');
  await page.evaluate(() => MT.settings.set('graph-type', 'histogram'));
  await closeView(page, 'graph');
});

test('the network keeps its layout while the timeline has a date field', async () => {
  await page.evaluate(() => MT.launchView('network'));
  await page.evaluate(() => MT.settings.set('timeline-date-field', 'date'));
  // (Read from the GPU, as saving and the timeline do)
  const placed = () => page.evaluate(() => { MT.syncLayout(); return temp.network.points.filter(p => Number.isFinite(p.x) && Number.isFinite(p.y)).length; });
  await expect.poll(placed).toBe(310);
  // A redraw, as when links are shown or hidden
  await page.evaluate(() => { MT.setLinkVisibility(true); return MT.tagClusters().then(() => { MT.events.emit('link-visibility'); MT.events.emit('node-visibility'); }); });
  // Gives the redraw time to run before the layout is read; nothing marks its end
  await page.waitForTimeout(500);
  expect(await placed()).toBe(310);
  await page.evaluate(() => MT.settings.set('timeline-date-field', 'None'));
});

test('without a field of dates, the Gantt says what to choose', async () => {
  // As if the data had no dates
  await page.evaluate(() => { MT._dateFields = MT.dateFields; MT.dateFields = () => []; });
  await page.evaluate(() => MT.settings.set('gantt-dates', []));
  await launchView(page, 'gantt');
  const gantt = view('#gantt-export-modal');
  await expect(gantt.locator('.view-needs')).toContainText('no column holds dates');
  await closeView(page, 'gantt');
  await page.evaluate(() => { MT.dateFields = MT._dateFields; delete MT._dateFields; });
});

test('the Gantt chart opens on the first field of dates', async () => {
  await launchView(page, 'gantt');
  const gantt = view('#gantt-export-modal');
  await expect.poll(() => page.evaluate(() => MT.settings.get('gantt-dates').map(d => d.start))).toEqual(['date']);
  const dated = await page.evaluate(() => session.data.nodes.filter(d => d.visible && d.date).length);
  await expect(gantt.locator('svg .gantt-chart rect')).toHaveCount(dated);
  await expect(gantt.locator('.view-message')).toBeHidden();
  await closeView(page, 'gantt');
});

test("bubbles fit the view, without overlapping, and the size slider shows their size", async () => {
  await launchView(page, 'bubbles');
  const bubbles = view('svg.bubbles');
  // Once they settle: their spread, their radius, and how close any two come
  const measure = () => bubbles.evaluate(root => {
    const circles = Array.from(root.querySelectorAll('svg.bubbles circle'));
    const r = +circles[0].getAttribute('r');
    const pts = circles.map(c => [+c.getAttribute('cx'), +c.getAttribute('cy')]);
    let closest = Infinity;
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) closest = Math.min(closest, Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]));
    const ys = pts.map(p => p[1]);
    return { r, spread: (Math.max(...ys) - Math.min(...ys)) / root.querySelector('svg.bubbles').clientHeight, closest, slider: +root.querySelector('[data-setting="bubble-size"]').value };
  });
  // Settled, no two overlap by more than a tenth of their width
  await expect.poll(async () => {
    const m = await measure();
    return m.closest / (2 * m.r);
  }, { timeout: 20000 }).toBeGreaterThan(0.9);
  const m = await measure();
  expect(m.r).toBeGreaterThan(5);
  expect(m.spread).toBeGreaterThan(0.35);
  expect(m.slider).toBe(m.r);
  expect(await page.evaluate(() => MT.settings.get('bubble-size'))).toBeNull();
  await closeView(page, 'bubbles');
});

test("tree leaves fit between their neighbors, and the size slider shows their size", async () => {
  await launchView(page, 'phylogenetic_tree');
  const leaves = page.locator('g.tidytree-node-leaf circle');
  await expect.poll(() => leaves.count(), { timeout: 60000 }).toBeGreaterThan(100);
  const fit = await page.evaluate(() => {
    const t = temp.phylogeneticTree.tree, ds = [];
    let r;
    t.eachLeafNode((circle, d) => { ds.push(d.x); r = +circle.getAttribute('r'); });
    ds.sort((a, b) => a - b);
    const gaps = ds.slice(1).map((x, i) => x - ds[i]).filter(g => g > 0).sort((a, b) => a - b);
    return { r, gap: gaps[Math.floor(gaps.length / 2)], slider: +document.querySelector('[data-setting="tree-leaf-node-size"]').value };
  });
  expect(2 * fit.r).toBeLessThanOrEqual(Math.max(fit.gap, 3));
  expect(fit.slider).toBe(fit.r);
  expect(await page.evaluate(() => MT.settings.get('tree-leaf-node-size'))).toBeNull();
  await closeView(page, 'phylogenetic_tree');
  expect(errors).toEqual([]);
});
