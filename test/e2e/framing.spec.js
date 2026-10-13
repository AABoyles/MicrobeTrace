// Views framed to their data: the network fitted as its layout spreads, its
// labels readable at any zoom; the choropleth and globe opening on the data,
// with a titled legend and a Fit button; plots below the toolbar, clear of the
// docked tables, titled, with outlined points; the heatmap naming its metric
// and showing missing pairs; the flow diagram naming its columns in order; the
// map and the tree clear of the docked tables; the timeline starting where the
// network is; and the waterfall saying what to choose.
const { test, expect } = require('@playwright/test');
const { watchErrors, loadNetwork, launchView } = require('./helpers');

test.describe.configure({ mode: 'serial' });

let page, errors;
test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  errors = watchErrors(page);
  await loadNetwork(page);
});
test.afterAll(() => page.close());

const set = (key, value) => page.evaluate(([key, value]) => MT.settings.set(key, value), [key, value]);
// The view, launched if it isn't open, and in front
async function opened(view) {
  await page.evaluate(view => {
    const item = layout.contentItems.find(i => i.componentType == view);
    if (item) item.parent.setActiveComponentItem(item, true);
  }, view);
  if (!(await page.evaluate(view => layout.contentItems.some(i => i.componentType == view), view))) await launchView(page, view);
}
// The left edge of a view's docked tables (its right edge without any)
const dockLeft = content => page.locator(`.lm_content:has(${content})`).first().evaluate(root => {
  const dock = Array.from(root.children).find(c => c.classList.contains('panel-dock'));
  return dock && dock.children.length ? dock.getBoundingClientRect().left : root.getBoundingClientRect().right;
});
const plot = content => page.locator(`.lm_content:has(${content}) .js-plotly-plot`).first();

test('the network stays in view as its layout spreads, clear of the docked tables', async () => {
  await opened('network');
  // Every node inside the view and left of the docked tables, on most frames
  // while the layout is still running
  const framed = () => page.evaluate(() => {
    const { graph } = temp.network;
    const box = document.querySelector('.network-view').getBoundingClientRect();
    const dock = document.querySelector('.lm_content:has(.network-view) .panel-dock').getBoundingClientRect();
    const p = graph.getPointPositions();
    let inside = 0;
    for (let i = 0; i < p.length; i += 2) {
      const [x, y] = graph.spaceToScreenPosition([p[i], p[i + 1]]);
      if (x >= 0 && y >= 0 && box.left + x < dock.left && y <= box.height) inside++;
    }
    return inside / (p.length / 2);
  });
  // Once first fitted, it stays fitted as the layout keeps spreading
  await expect.poll(framed, { timeout: 5000 }).toBeGreaterThan(0.98);
  let least = 1;
  for (let i = 0; i < 16; i++) {
    await page.waitForTimeout(250);
    least = Math.min(least, await framed());
  }
  expect(least).toBeGreaterThan(0.95);
});

test('node labels keep their size as the view zooms out, and none run into another', async () => {
  await opened('network');
  // The labels the overlay draws, frame by frame (each frame starts by
  // clearing it)
  await page.evaluate(() => {
    const overlay = document.querySelector('canvas.network-overlay');
    const context = overlay.getContext('2d');
    window.labelLog = [];
    const clear = context.clearRect.bind(context), fill = context.fillText.bind(context);
    context.clearRect = (...args) => { window.labelLog.push('frame'); return clear(...args); };
    context.fillText = (text, x, y) => {
      window.labelLog.push({ text, x, y, font: context.font, align: context.textAlign, width: context.measureText(text).width });
      return fill(text, x, y);
    };
  });
  // The labels of the last whole frame
  const frame = () => page.evaluate(() => {
    const log = window.labelLog, last = log.lastIndexOf('frame'), before = log.lastIndexOf('frame', last - 1);
    return log.slice(before + 1, last).filter(e => e != 'frame' && typeof e.text == 'string' && /^[A-Z][a-z]+$/.test(e.text));
  });
  await set('node-label-variable', 'state');
  await expect.poll(async () => (await frame()).length).toBeGreaterThan(0);
  const overlaps = labels => labels.some((a, i) => labels.some((b, j) => {
    if (j <= i) return false;
    const size = parseFloat(a.font), box = l => {
      const left = l.align == 'center' ? l.x - l.width / 2 : l.align == 'right' ? l.x - l.width : l.x;
      return [left, l.y - size, left + l.width, l.y];
    };
    const [p, q] = [box(a), box(b)];
    return p[0] < q[2] && q[0] < p[2] && p[1] < q[3] && q[1] < p[3];
  }));
  const before = await frame();
  expect(overlaps(before)).toBe(false);
  const font = before[0].font;
  // Zoomed well out (by the wheel, as a user would), the same size, still apart
  const box = await page.locator('.network-view').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  const zoom = await page.evaluate(() => temp.network.graph.getZoomLevel());
  for (let i = 0; i < 6; i++) await page.mouse.wheel(0, 400);
  await expect.poll(() => page.evaluate(() => temp.network.graph.getZoomLevel())).toBeLessThan(zoom * 0.5);
  await expect.poll(async () => (await frame()).length).toBeGreaterThan(0);
  const after = await frame();
  expect(after.every(l => l.font == font)).toBe(true);
  expect(overlaps(after)).toBe(false);
  await set('node-label-variable', 'None');
});

test('the choropleth opens on the regions with data, with a titled legend', async () => {
  await opened('choropleth');
  await expect.poll(() => page.evaluate(() => temp.choropleth && temp.choropleth.layers.aggregates ? temp.choropleth.layers.aggregates.getLayers().length : 0)).toBeGreaterThan(0);
  const legend = page.locator('.choropleth-legend');
  await expect(legend.locator('.legend-title')).toHaveText('Nodes by State');
  expect(await legend.locator('.legend-ends span').allTextContents()).toEqual(['0', '60']);
  // Each state with nodes is wholly in view
  await expect.poll(() => page.evaluate(() => {
    const { map, layers } = temp.choropleth;
    const view = map.getBounds();
    return layers.aggregates.getLayers().filter(l => l.feature.properties.density > 0).every(l => view.contains(l.getBounds()));
  })).toBe(true);
});

test('the globe zooms to the nodes, has a Fit button, and calls its countries Borders', async () => {
  await opened('globe');
  await expect.poll(() => page.evaluate(() => temp.globe && temp.globe.positions.size)).toBeGreaterThan(0);
  const scale = () => page.evaluate(() => temp.globe.projection.scale());
  const globeRoot = page.locator('.lm_content:has(canvas.globe)').first();
  const whole = await globeRoot.evaluate(el => Math.min(el.clientWidth, el.clientHeight) / 2 - 50);
  await expect.poll(scale).toBeGreaterThan(whole * 1.5);
  await expect(globeRoot.locator('button[title="Fit to the Nodes"]')).toBeVisible();
  await expect(globeRoot.locator('.left-pane .form-group', { hasText: 'Borders' })).toHaveCount(1);
});

test('plots start below the toolbar, clear of the docked tables, with outlined points', async () => {
  await opened('histogram');
  await expect(plot('.histogram-plot')).toBeVisible();
  const histogram = await plot('.histogram-plot').evaluate(el => el._fullLayout.margin);
  expect(histogram.t).toBeLessThanOrEqual(60);
  const room = await page.locator('.lm_content:has(.histogram-plot)').first().evaluate(root => root.getBoundingClientRect().right) - await dockLeft('.histogram-plot');
  expect(room).toBeGreaterThan(100);
  expect(histogram.r).toBeGreaterThanOrEqual(room);
  await opened('scatterplot');
  await expect.poll(() => plot('.scatterplot-plot').evaluate(el => el.data && el.data[0].marker.line && el.data[0].marker.line.width)).toBe(1);
  expect(await plot('.scatterplot-plot').evaluate(el => el._fullLayout.margin.t)).toBeLessThanOrEqual(60);
});

test('the heatmap names its metric, greys missing pairs, and labels cells with ids', async () => {
  await opened('heatmap');
  await expect.poll(() => plot('.heatmap-plot').evaluate(el => el.data && el.data[0].z.length)).toBe(310);
  const p = await plot('.heatmap-plot').evaluate(el => ({
    title: el.data[0].colorbar.title.text,
    background: el.layout.plot_bgcolor,
    notes: (el.layout.annotations || []).map(a => a.text),
    x0: el.data[0].x[0]
  }));
  expect(p.title).toBe('Distance');
  expect(p.background).toBe('#d0d0d0');
  expect(p.notes.join(' ')).toContain('No distance');
  expect(p.x0).toBe(await page.evaluate(() => String(session.data.nodes[0]._id)));
});

test('the flow diagram names its columns and lists their values in order, empty last', async () => {
  await opened('flow_diagram');
  await expect.poll(() => plot('.flow-plot').evaluate(el => el.data && el.data[0].node.label.length)).toBeGreaterThan(0);
  const p = await plot('.flow-plot').evaluate(el => ({
    titles: el.layout.annotations.map(a => a.text.replace(/<[^>]+>/g, '')),
    labels: el.data[0].node.label,
    columns: el.data[0].node.customdata,
    y: el.data[0].node.y
  }));
  expect(p.titles.length).toBe(new Set(p.columns).size);
  for (const column of new Set(p.columns)) {
    expect(p.titles).toContain(column);
    const values = p.labels.map((label, i) => ({ label, y: p.y[i] })).filter((v, i) => p.columns[i] == column)
      .sort((a, b) => a.y - b.y).map(v => v.label);
    const named = values.filter(v => v != '(Empty)');
    expect(named).toEqual(named.slice().sort((a, b) => a.localeCompare(b, undefined, { numeric: true })));
    if (values.includes('(Empty)')) expect(values[values.length - 1]).toBe('(Empty)');
  }
});

test('the map and the tree leave the docked tables their room', async () => {
  await opened('geo_map');
  await expect.poll(() => page.evaluate(() => temp.geoMap && temp.geoMap.layers.nodes ? 1 : 0)).toBe(1);
  // (The map's own view: the choropleth is a map too)
  await page.evaluate(() => temp.geoMap.map.getContainer().closest('.lm_content').querySelector('button[title="Fit to the Nodes"]').click());
  await expect.poll(() => page.evaluate(() => {
    const { map, layers } = temp.geoMap;
    const root = map.getContainer().closest('.lm_content');
    const dock = Array.from(root.children).find(c => c.classList.contains('panel-dock'));
    const left = dock && dock.children.length ? dock.getBoundingClientRect().left : root.getBoundingClientRect().right;
    const box = map.getContainer().getBoundingClientRect();
    const points = layers.nodes.getLayers().map(l => map.latLngToContainerPoint(l.getLatLng()).x + box.left);
    return points.length > 0 && points.every(x => x < left);
  }), { timeout: 10000 }).toBe(true);

  await set('node-color-variable', 'group');
  await opened('phylogenetic_tree');
  const tree = page.locator('.lm_content:has(.tree)').first();
  await expect(tree.locator('.panel-dock #node-color-table-wrapper')).toBeVisible();
  await expect.poll(async () => {
    const leaves = await tree.locator('svg g.tidytree-node-leaf').evaluateAll(els => els.map(el => el.getBoundingClientRect().right));
    return leaves.length > 0 && Math.max(...leaves) < await dockLeft('.tree');
  }, { timeout: 10000 }).toBe(true);
  await set('node-color-variable', 'None');
});

test('the timeline starts where the network is, names its years, and sits centered', async () => {
  await opened('network');
  await set('node-timeline-variable', 'date');
  const bar = page.locator('#global-timeline');
  await expect(bar.locator('.handle')).toBeVisible();
  const [handle, track] = [await bar.locator('.handle').boundingBox(), await bar.locator('.track').boundingBox()];
  expect(Math.abs((handle.x + handle.width / 2) - (track.x + track.width - 5))).toBeLessThan(8);
  expect(await page.evaluate(() => session.data.nodes.filter(d => d.visible).length)).toBe(310);
  expect(await bar.locator('.label').textContent()).toBe('Dec 30');
  const ticks = await bar.locator('.ticks text').allTextContents();
  expect(ticks[0]).toMatch(/\d{4}/);
  // As much room either side of the track
  const svg = await bar.locator('svg').boundingBox();
  expect(Math.abs((track.x - svg.x) - (svg.x + svg.width - track.x - track.width))).toBeLessThan(12);
  await set('node-timeline-variable', 'None');
});

test('the waterfall says what to choose, and notes the clusters it doesn’t list', async () => {
  await opened('waterfall');
  const view = page.locator('.lm_content:has(.waterfall)').first();
  await expect(view.locator('.waterfall-nodes-hint')).toBeVisible();
  await expect(view.locator('.waterfall-links-hint')).toBeVisible();
  const singles = await page.evaluate(() => session.data.clusters.filter(c => c.visible && c.nodes == 1).length);
  await expect(view.locator('.waterfall-skipped')).toHaveText(`${singles} clusters of a single node aren’t listed.`);
  await view.locator('.waterfall-clusters a').first().click();
  await expect(view.locator('.waterfall-nodes-hint')).toBeHidden();
  await view.locator('.waterfall-nodes a').first().click();
  await expect(view.locator('.waterfall-links-hint')).toBeHidden();
  expect(errors).toEqual([]);
});
