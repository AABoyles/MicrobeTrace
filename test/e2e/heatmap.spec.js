// The heatmap view: its settings, what they draw, restoring them, and export.
const { test, expect } = require('@playwright/test');
const { watchErrors, loadNetwork, launchView, closeView, openExport } = require('./helpers');

test.describe.configure({ mode: 'serial' });

let page, errors;
test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  errors = watchErrors(page);
  await loadNetwork(page);
  await launchView(page, 'heatmap');
});
test.afterAll(() => page.close());

const view = () => page.locator('.lm_content:has(.heatmap-plot)').first();
const pane = () => view().locator('.left-pane');
const widget = key => page.evaluate(key => session.style.widgets[key], key);
const labels = () => page.evaluate(() => session.data.nodes.map(d => String(d._id)));

const plot = () => view().locator('.heatmap-svg').evaluate(async el => {
  const image = el.querySelector('.cells'), img = new Image();
  img.src = image.getAttribute('href');
  await img.decode();
  const m = image.transform.baseVal.consolidate().matrix;
  const rect = el.querySelectorAll('.color-scale rect');
  return {
    size: [img.naturalWidth, img.naturalHeight],
    // Turned from its first row at the bottom, and first column at the left
    inverted: [m.a < 0, m.d > 0],
    colors: [rect[0], rect[255]].map(r => d3.color(r.getAttribute('fill')).formatHex()),
    xLabels: Array.from(el.querySelectorAll('.axis--x .tick text'), t => t.textContent),
    width: +el.getAttribute('width'),
    background: getComputedStyle(el.parentElement).backgroundColor
  };
});
// The color of a cell, in the picture
const cell = (row, column) => view().locator('.heatmap-svg .cells').evaluate(async (image, [row, column]) => {
  const img = new Image();
  img.src = image.getAttribute('href');
  await img.decode();
  const c = new OffscreenCanvas(img.naturalWidth, img.naturalHeight).getContext('2d');
  c.drawImage(img, 0, 0);
  const [r, g, b, a] = c.getImageData(column, row, 1, 1).data;
  return a ? d3.rgb(r, g, b).formatHex() : null;
}, [row, column]);

test('draws the distance matrix', async () => {
  await expect.poll(async () => (await plot()).size).toEqual([310, 310]);
  const p = await plot();
  expect(p.inverted).toEqual([false, false]);
  expect(p.colors).toEqual(['#313695', '#a50026']);
  expect(p.xLabels).toEqual([]);
  // A node is at no distance from itself; a pair with no distance is clear, over the grey
  expect(await cell(5, 5)).toBe('#313695');
  expect(await cell(0, 309)).toBe(null);
});

test('pointing at a cell gives its pair and distance', async () => {
  const names = await labels();
  const box = await view().locator('.heatmap-svg .cells').boundingBox();
  // The middle of the bottom left cell
  await page.mouse.move(box.x + box.width / 620, box.y + box.height - box.height / 620);
  await expect(page.locator('#tooltip')).toHaveText(`${names[0]} and ${names[0]}: 0`);
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height - 2);
  await expect(page.locator('#tooltip')).toContainText(new RegExp(`^${names[0]} and `));
});

test('the settings pane opens and closes', async () => {
  const toggle = view().locator('.view-controls button').first();
  await toggle.click();
  await expect.poll(() => pane().evaluate(el => getComputedStyle(el).left)).toBe('0px');
  await toggle.click();
  await expect(pane()).toBeHidden();
  await toggle.click();
  await expect(pane()).toBeVisible();
});

test('inverting an axis reverses it', async () => {
  await pane().locator('label', { hasText: 'X-Axis' }).click();
  await expect.poll(async () => (await plot()).inverted).toEqual([true, false]);
  expect(await widget('heatmap-invertX')).toBe(true);
  await expect(pane().locator('label', { hasText: 'X-Axis' }).locator('input')).toBeChecked();
  await pane().locator('label', { hasText: 'Y-Axis' }).click();
  await expect.poll(async () => (await plot()).inverted).toEqual([true, true]);
  await pane().locator('label', { hasText: 'Y-Axis' }).click();
  await expect.poll(async () => (await plot()).inverted).toEqual([true, false]);
  expect(await widget('heatmap-invertY')).toBe(false);
});

test('axis labels can be shown', async () => {
  await pane().locator('label', { hasText: 'Show' }).click();
  const names = await labels();
  // (The X axis is inverted: its labels are written in order, and placed from the right)
  await expect.poll(async () => (await plot()).xLabels[0]).toBe(names[0]);
  expect(await widget('heatmap-axislabels-show')).toBe(true);
});

test('the color scheme applies', async () => {
  await pane().locator('input[data-setting="heatmap-color-high"]').evaluate(el => {
    el.value = '#00ff00';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await expect.poll(async () => (await plot()).colors[1]).toBe('#00ff00');
  expect(await widget('heatmap-color-high')).toBe('#00ff00');
});

test('the background color applies', async () => {
  await page.evaluate(() => (el => { el.value = '#000000'; el.dispatchEvent(new Event('change', { bubbles: true })); })(document.getElementById('background-color')));
  await expect.poll(async () => (await plot()).background).toBe('rgb(0, 0, 0)');
  await page.evaluate(() => (el => { el.value = '#ffffff'; el.dispatchEvent(new Event('change', { bubbles: true })); })(document.getElementById('background-color')));
});

test('reopening the view restores its settings', async () => {
  await closeView(page, 'heatmap');
  await launchView(page, 'heatmap');
  await expect.poll(async () => (await plot()).inverted).toEqual([true, false]);
  const p = await plot();
  expect(p.xLabels.length).toBeGreaterThan(10);
  expect(p.colors[1]).toBe('#00ff00');
  await expect(pane().locator('label', { hasText: 'X-Axis' }).locator('input')).toBeChecked();
  await expect(pane().locator('label', { hasText: 'Y-Axis' }).locator('input')).not.toBeChecked();
  await expect(pane().locator('label', { hasText: 'Show' }).locator('input')).toBeChecked();
  await expect(pane().locator('input[data-setting="heatmap-color-high"]')).toHaveValue('#00ff00');
});

test('the plot follows the panel size', async () => {
  const before = (await plot()).width;
  await page.setViewportSize({ width: 1000, height: 900 });
  await expect.poll(async () => (await plot()).width).toBeLessThan(before - 200);
  await page.setViewportSize({ width: 1400, height: 900 });
  await expect.poll(async () => (await plot()).width).toBe(before);
});

for (const filetype of ['png', 'csv']) {
  test(`exports ${filetype.toUpperCase()}`, async () => {
    const modal = await openExport(page, view(), 'Export Heatmap');
    await modal.getByPlaceholder('Filename').fill('heatmap-test');
    await modal.locator('select').selectOption(filetype);
    const [download] = await Promise.all([page.waitForEvent('download'), modal.locator('button', { hasText: 'Export' }).click()]);
    expect(download.suggestedFilename()).toBe('heatmap-test.' + filetype);
    await expect(modal).toBeHidden();
    expect(errors).toEqual([]);
  });
}
