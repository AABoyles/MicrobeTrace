// What views open on: variables chosen from the data (crosstab, flow diagram,
// scatterplot), the first field of dates (epi curve, Gantt) or a note saying
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

test('the flow diagram opens on two categorical variables', async () => {
  await launchView(page, 'flow_diagram');
  const flow = view('.flow-plot');
  await expect.poll(() => flow.locator('.js-plotly-plot').evaluate(el => el.data && Array.from(new Set(el.data[0].node.customdata)))).toEqual(['State', 'Group']);
  // A dozen labels, not a hundred clusters
  expect(await flow.locator('.js-plotly-plot').evaluate(el => el.data[0].node.label.length)).toBeLessThan(15);
  await closeView(page, 'flow_diagram');
});

test('the scatterplot opens on a measurement, with faint gridlines', async () => {
  await launchView(page, 'scatterplot');
  const plot = view('.scatterplot-plot').locator('.js-plotly-plot');
  await expect.poll(() => plot.evaluate(el => el.layout && [el.layout.xaxis.title.text, el.layout.yaxis.title.text])).toEqual(['Cluster', 'TN93']);
  const grid = await plot.evaluate(el => el.layout.xaxis.gridcolor);
  const alpha = +grid.match(/rgba\(.*,\s*([\d.]+)\)/)[1];
  expect(alpha).toBeLessThan(0.3);
  await closeView(page, 'scatterplot');
});

test('the epi curve opens on the first field of dates, saving it only once it filters', async () => {
  await launchView(page, 'timeline');
  const curve = view('#timeline-export-modal');
  const dated = await page.evaluate(() => session.data.nodes.filter(d => MT.parseDate(d.date)).length);
  await expect.poll(() => curve.locator('svg rect.bar').evaluateAll(els => els.reduce((s, el) => s + +el.dataset.count, 0))).toBe(dated);
  await expect(curve.locator('[data-setting="timeline-date-field"]')).toHaveValue('date');
  await expect(curve.locator('.view-message')).toBeHidden();
  // Shown, not saved: the network and statistics don't start watching dates
  expect(await page.evaluate(() => MT.settings.get('timeline-date-field'))).toBe('None');
  // Brushing filters by it, so saves it
  const box = await curve.locator('svg .brush .overlay').boundingBox();
  await page.mouse.move(box.x + 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 5 });
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() => MT.settings.get('timeline-date-field'))).toBe('date');
  await expect.poll(() => page.evaluate(() => session.data.nodes.filter(d => d.visible).length)).toBeLessThan(310);
  // The brushed range stays drawn
  expect(await curve.locator('svg .brush .selection').evaluate(el => +el.getAttribute('width') || 0)).toBeGreaterThan(box.width / 3);
  // Clearing the brush shows every node again
  await curve.locator('svg .brush .overlay').click({ position: { x: box.width - 5, y: box.height / 2 } });
  await expect.poll(() => page.evaluate(() => session.data.nodes.filter(d => d.visible).length)).toBe(310);
  await closeView(page, 'timeline');
});

test('the network keeps its layout while the epi curve has a date field', async () => {
  await page.evaluate(() => MT.launchView('network'));
  await page.evaluate(() => MT.settings.set('timeline-date-field', 'date'));
  // (Read from the GPU, as saving and the timeline do)
  const placed = () => page.evaluate(() => { MT.syncLayout(); return temp.network.points.filter(p => Number.isFinite(p.x) && Number.isFinite(p.y)).length; });
  await expect.poll(placed).toBe(310);
  // A redraw, as when links are shown or hidden
  await page.evaluate(() => { MT.setLinkVisibility(true); return MT.tagClusters().then(() => { MT.events.emit('link-visibility'); MT.events.emit('node-visibility'); }); });
  await page.waitForTimeout(500);
  expect(await placed()).toBe(310);
  await page.evaluate(() => MT.settings.set('timeline-date-field', 'None'));
});

test('without a field of dates, the date views say what to choose', async () => {
  // As if the data had no dates
  await page.evaluate(() => { MT._dateFields = MT.dateFields; MT.dateFields = () => []; });
  await launchView(page, 'timeline');
  const curve = view('#timeline-export-modal');
  await expect(curve.locator('.view-message')).toBeVisible();
  await expect(curve.locator('.view-message')).toContainText('Date Field');
  await expect(curve.locator('.left-pane')).toBeVisible();
  await closeView(page, 'timeline');
  await page.evaluate(() => MT.settings.set('gantt-dates', []));
  await launchView(page, 'gantt');
  const gantt = view('#gantt-export-modal');
  await expect(gantt.locator('.view-message')).toBeVisible();
  await expect(gantt.locator('.view-message')).toContainText('Add Date');
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
