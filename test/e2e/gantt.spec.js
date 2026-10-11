// The Gantt view: adding, changing and removing dates, their colors, redraws,
// restoring and export.
const { test, expect } = require('@playwright/test');
const { watchErrors, loadNetwork, launchView, closeView, openExport } = require('./helpers');

test.describe.configure({ mode: 'serial' });

let page, errors;
test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  errors = watchErrors(page);
  await loadNetwork(page);
  await launchView(page, 'gantt');
});
test.afterAll(() => page.close());

const view = () => page.locator('.lm_content:has(button[title="Export Gantt"])').first();
const pane = () => view().locator('.left-pane');
const rows = () => pane().locator('.gantt-date');
const bars = () => view().locator('svg .gantt-chart rect');
const visibleDated = () => page.evaluate(() => session.data.nodes.filter(d => d.visible && d.date).length);

test('opens on the first field of dates, drawn', async () => {
  await expect(rows()).toHaveCount(1);
  await expect(bars()).toHaveCount(await visibleDated());
  await expect(pane()).toBeHidden();
  await expect(view().locator('.view-message')).toBeHidden();
});

test('without dates it says what to choose, and adding a date draws a bar per node that has it', async () => {
  await view().locator('.settings-toggle').click();
  await expect(pane()).toBeVisible();
  await rows().first().locator('a[title="Remove this date"]').click();
  await expect(rows()).toHaveCount(0);
  await expect(bars()).toHaveCount(0);
  await expect(view().locator('.view-message')).toBeVisible();
  await pane().locator('button', { hasText: 'Add Date' }).click();
  await expect(rows()).toHaveCount(1);
  await rows().first().locator('select').first().selectOption('date');
  await expect(bars()).toHaveCount(await visibleDated());
});

test('a date\'s color and transparency apply to its bars', async () => {
  await rows().first().locator('input[type=color]').evaluate(el => { el.value = '#ff0000'; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); });
  await expect(bars().first()).toHaveAttribute('fill', '#ff0000');
  await rows().first().locator('input[type=range]').fill('0.2');
  await expect.poll(() => bars().first().getAttribute('fill-opacity')).toBe('0.8');
});

test('redraws when nodes are hidden', async () => {
  await page.evaluate(() => {
    session.data.nodes.forEach((d, i) => { if (i < 50) d.visible = false; });
    MT.events.emit('node-visibility');
  });
  await expect(bars()).toHaveCount(await visibleDated());
  await page.evaluate(() => {
    session.data.nodes.forEach(d => { d.visible = true; });
    MT.events.emit('node-visibility');
  });
  await expect(bars()).toHaveCount(await visibleDated());
});

test('reopening the view restores the dates', async () => {
  await closeView(page, 'gantt');
  await launchView(page, 'gantt');
  await expect(rows()).toHaveCount(1);
  await expect(bars()).toHaveCount(await visibleDated());
  await expect(bars().first()).toHaveAttribute('fill', '#ff0000');
});

test('exports a PNG', async () => {
  const modal = await openExport(page, view(), 'Export Gantt');
  await modal.getByPlaceholder('Filename').fill('gantt-test');
  const [download] = await Promise.all([page.waitForEvent('download'), modal.locator('button', { hasText: 'Export' }).click()]);
  expect(download.suggestedFilename()).toBe('gantt-test.png');
});

test('removing a date removes its bars', async () => {
  // With dates to draw, the reopened view starts with its settings closed
  await expect(pane()).toBeHidden();
  await view().locator('.settings-toggle').click();
  await rows().first().locator('a[title="Remove this date"]').click();
  await expect(rows()).toHaveCount(0);
  await expect(bars()).toHaveCount(0);
  expect(errors).toEqual([]);
});
