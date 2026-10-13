// Settings panes beside what they change: in the table and chart views, a pane
// opening moves the content aside, redrawn at its new width, when the view is
// wide enough to keep a good width beside it; in a narrower view the pane
// covers it, as in the other views, until the view widens. The Table view has
// no settings pane: its text size is in a menu on its toolbar.
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

// Each view, and the content its pane moves aside
const views = {
  aggregation: '.aggregation-grid',
  crosstab: '.crosstab-grid',
  histogram: '.histogram-plot',
  scatterplot: '.scatterplot-plot',
  heatmap: '.heatmap-plot',
  timeline: '.timeline-chart',
  gantt: '.gantt',
  bubbles: 'svg.bubbles',
  flow_diagram: '.flow-plot'
};
const root = content => page.locator(`.lm_content:has(${content})`).first();
const box = locator => locator.evaluate(el => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, width: r.width }; });
// Opens or closes a view's pane, once it has finished sliding
async function pane(content, open) {
  const view = root(content), toggle = view.locator('.settings-toggle').first();
  if ((await toggle.evaluate(b => b.classList.contains('active'))) != open) await toggle.click();
  const left = view.locator('.left-pane');
  await (open ? expect(left).toBeVisible() : expect(left).toBeHidden());
  await left.evaluate(el => Promise.all(el.getAnimations().map(a => a.finished))).catch(() => {});
  return left;
}
async function opened(view) {
  if (!(await page.evaluate(view => layout.contentItems.some(i => i.componentType == view), view))) await launchView(page, view);
  await page.evaluate(view => layout.contentItems.find(i => i.componentType == view).parent.setActiveComponentItem(layout.contentItems.find(i => i.componentType == view), true), view);
  await expect(root(views[view] || '.table-grid')).toBeVisible();
}

test('in a wide view, each table and chart moves aside for its pane, and back', async () => {
  await page.setViewportSize({ width: 1400, height: 900 });
  for (const [view, content] of Object.entries(views)) {
    await opened(view);
    const left = await pane(content, true);
    await expect.poll(async () => (await box(root(content).locator(content))).left >= (await box(left)).right, { message: view }).toBe(true);
    await pane(content, false);
    await expect.poll(async () => (await box(root(content).locator(content))).left < 50, { message: view }).toBe(true);
  }
});

test('the chart is redrawn to the width beside the pane', async () => {
  await opened('histogram');
  const plotWidth = () => root('.histogram-plot').locator('.main-svg').first().evaluate(el => +el.getAttribute('width'));
  const full = await plotWidth();
  await pane('.histogram-plot', true);
  await expect.poll(plotWidth).toBeLessThan(full - 300);
  const room = await root('.histogram-plot').evaluate(el => el.clientWidth - 410);
  expect(Math.abs((await plotWidth()) - room)).toBeLessThan(5);
  await pane('.histogram-plot', false);
  await expect.poll(plotWidth).toBe(full);
});

test('in a narrow view the pane covers the chart, which moves aside once the view widens', async () => {
  await opened('timeline');
  await page.setViewportSize({ width: 900, height: 800 });
  const left = await pane('.timeline-chart', true);
  const chart = root('.timeline-chart').locator('.timeline-chart');
  await expect.poll(async () => (await box(chart)).left).toBeLessThan(50);
  expect((await box(chart)).left).toBeLessThan((await box(left)).right);
  // The chart keeps its whole width
  const svgWidth = () => chart.locator('svg').first().evaluate(el => +el.getAttribute('width'));
  expect(Math.abs((await svgWidth()) - (await box(chart)).width)).toBeLessThan(5);
  await page.setViewportSize({ width: 1400, height: 900 });
  await expect.poll(async () => (await box(chart)).left >= (await box(left)).right).toBe(true);
  await pane('.timeline-chart', false);
});

test('the Table view has no settings pane; its text size is in its toolbar', async () => {
  await opened('table');
  const view = root('.table-grid');
  await expect(view.locator('.settings-toggle')).toHaveCount(0);
  await expect(view.locator('.left-pane')).toHaveCount(0);
  await view.locator('button[title="Text Size"]').click();
  const slider = view.locator('.table-text-size input[type=range]');
  await expect(slider).toBeVisible();
  await slider.fill('18');
  await expect.poll(() => view.locator('.table-grid').evaluate(el => el.style.fontSize)).toBe('18px');
  await page.keyboard.press('Escape');
  await expect(slider).toBeHidden();
  expect(errors).toEqual([]);
});
