// The epi curve (timeline view): choosing the date field, cumulation, brushing
// to filter nodes, colors and redraws.
const { test, expect } = require('@playwright/test');
const { watchErrors, loadNetwork, launchView, closeView } = require('./helpers');

test.describe.configure({ mode: 'serial' });

let page, errors;
test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  errors = watchErrors(page);
  await loadNetwork(page);
  await launchView(page, 'timeline');
});
test.afterAll(() => page.close());

const view = () => page.locator('.lm_content:has(.modal-title:has-text("Export Epi Curve"))').first();
const pane = () => view().locator('.left-pane');
// Each bar's count
const bars = () => view().locator('svg rect.bar').evaluateAll(els => els.map(el => +el.dataset.count));
const visible = () => page.evaluate(() => session.data.nodes.filter(d => d.visible).length);
const dated = () => page.evaluate(() => session.data.nodes.filter(d => MT.parseDate(d.date)).length);

test('opens on the first field of dates, shown but not yet saved', async () => {
  await expect.poll(async () => (await bars()).reduce((a, b) => a + b, 0)).toBe(await dated());
  await expect(pane().locator('select[data-setting="timeline-date-field"]')).toHaveValue('date');
  expect(await page.evaluate(() => MT.settings.get('timeline-date-field'))).toBe('None');
  await expect(pane()).toBeHidden();
  await view().locator('button[title="Epi Curve Settings"]').click();
  await expect(pane()).toBeVisible();
});

test('choosing the date field draws the nodes over time', async () => {
  await pane().locator('select[data-setting="timeline-date-field"]').selectOption('date');
  await expect.poll(async () => (await bars()).reduce((a, b) => a + b, 0)).toBe(await dated());
});

test('the curve can be cumulative', async () => {
  await pane().locator('label', { hasText: /^\s*Cumulative/ }).click();
  await expect.poll(async () => (await bars()).slice(-1)[0]).toBe(await dated());
  const b = await bars();
  expect(b.every((v, i) => i == 0 || v >= b[i - 1])).toBe(true);
  await pane().locator('label', { hasText: 'Noncumulative' }).click();
  await expect.poll(async () => (await bars()).reduce((a, b) => a + b, 0)).toBe(await dated());
});

test('brushing hides the nodes after the brushed range', async () => {
  await view().locator('button[title="Epi Curve Settings"]').click();
  await expect(pane()).toBeHidden();
  const box = await view().locator('svg .brush .overlay').boundingBox();
  await page.mouse.move(box.x + 5, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 5 });
  await page.mouse.up();
  await expect.poll(visible).toBeLessThan(310);
  const end = await page.evaluate(() => session.state.timeEnd);
  // The nodes with dates after the end are hidden; nodes without dates stay
  expect(await page.evaluate(end => session.data.nodes.filter(d => d.visible && d.date && new Date(d.date) > new Date(end)).length, end)).toBe(0);
  expect(await visible()).toBeGreaterThan(10);
});

test('clearing the brush shows them again', async () => {
  const box = await view().locator('svg .brush .overlay').boundingBox();
  // (Away from the link color table, which floats at the top right)
  await page.mouse.click(box.x + box.width * 0.75, box.y + box.height - 10);
  await expect.poll(visible).toBe(310);
});

test('follows the node color', async () => {
  await page.evaluate(() => { session.style.widgets['node-color'] = '#00ff00'; MT.events.emit('node-color-change'); });
  await expect(view().locator('svg rect.bar').first()).toHaveAttribute('fill', '#00ff00');
});

test('the chart follows the panel size', async () => {
  const width = () => view().locator('svg').first().evaluate(el => +el.getAttribute('width'));
  const before = await width();
  await page.setViewportSize({ width: 1000, height: 900 });
  await expect.poll(width).toBeLessThan(before - 200);
  await page.setViewportSize({ width: 1400, height: 900 });
  await expect.poll(width).toBe(before);
});

test('reopening the view restores the date field', async () => {
  await closeView(page, 'timeline');
  await launchView(page, 'timeline');
  await expect.poll(async () => (await bars()).reduce((a, b) => a + b, 0)).toBe(await dated());
  expect(errors).toEqual([]);
});
