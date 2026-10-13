// Dates and sequences that can be read: the epi curve's bars counting calendar
// periods, with counts up the side and on hover; the Gantt chart's rows tall
// enough for their labels, in order of date, scrolling under an axis that
// stays in view, with single dates as dots; and the sequences' ids beside
// them, letters only where they fit, and four colors with a key.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const { watchErrors, loadNetwork, launchView, openExport } = require('./helpers');

test.describe.configure({ mode: 'serial' });

let page, errors;
test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  errors = watchErrors(page);
  await loadNetwork(page);
});
test.afterAll(() => page.close());

const set = (key, value) => page.evaluate(([key, value]) => MT.settings.set(key, value), [key, value]);
const dated = () => page.evaluate(() => session.data.nodes.filter(d => MT.parseDate(d.date)).length);
// The view, launched if it isn't open
async function opened(view) {
  if (!(await page.evaluate(view => layout.contentItems.some(i => i.componentType == view), view))) await launchView(page, view);
}

// The epi curve
const curve = () => page.locator('.lm_content:has(button[title="Export Epi Curve"])').first();
const bars = () => curve().locator('svg rect.bar');
const barBoxes = () => bars().evaluateAll(els => els.map(el => ({ x: +el.getAttribute('x'), width: +el.getAttribute('width'), count: +el.dataset.count, title: el.textContent })));

test('the epi curve’s bars count calendar periods, each a week here', async () => {
  await opened('timeline');
  await set('timeline-bin', 'auto');
  await expect.poll(async () => (await barBoxes()).reduce((a, b) => a + b.count, 0)).toBe(await dated());
  const b = await barBoxes();
  // The year of dates makes about 53 weeks, each starting on a Monday
  expect(b.length).toBeGreaterThan(50);
  expect(b.length).toBeLessThan(55);
  for (const bar of b) expect(bar.title).toMatch(/^Week of \d{4}-\d{2}-\d{2}: \d+ nodes?$/);
  const mondays = b.map(bar => new Date(bar.title.match(/\d{4}-\d{2}-\d{2}/)[0] + 'T00:00').getDay());
  expect(mondays.every(day => day == 1)).toBe(true);
});

test('bars can count months instead, and say how many so far when cumulative', async () => {
  await opened('timeline');
  await set('timeline-bin', 'month');
  await expect.poll(async () => (await barBoxes()).length).toBe(12);
  const b = await barBoxes();
  expect(b[0].title).toMatch(/^January 2020: \d+ nodes$/);
  expect(b.reduce((a, bar) => a + bar.count, 0)).toBe(await dated());
  await set('timeline-noncumulative', false);
  await expect.poll(async () => (await barBoxes()).slice(-1)[0].title).toBe(`December 2020: ${await dated()} nodes so far`);
  await set('timeline-noncumulative', true);
  await expect(curve().locator('select[data-setting="timeline-bin"]')).toHaveValue('month');
});

test('a count axis runs up the side, and neighboring bars have a gap between them', async () => {
  await opened('timeline');
  await set('timeline-bin', 'month');
  await expect.poll(async () => (await barBoxes()).length).toBe(12);
  const ticks = await curve().locator('svg .axis--y .tick text').allTextContents();
  expect(ticks.length).toBeGreaterThan(2);
  expect(ticks.every(t => /^\d+$/.test(t))).toBe(true);
  const most = Math.max(...(await barBoxes()).map(b => b.count));
  expect(Math.max(...ticks.map(Number))).toBeGreaterThanOrEqual(most);
  const b = await barBoxes();
  for (let i = 1; i < b.length; i++) expect(b[i].x - (b[i - 1].x + b[i - 1].width)).toBeGreaterThanOrEqual(1);
  // Each month's tick sits at its bar's start
  const months = await curve().locator('svg .axis--x .tick text').allTextContents();
  expect(months.every(t => /^\d{4}-\d{2}$/.test(t))).toBe(true);
  await set('timeline-bin', 'auto');
});

// The Gantt chart
const gantt = () => page.locator('.lm_content:has(button[title="Export Gantt"])').first();
const ganttBars = () => gantt().locator('svg .gantt-chart rect');

test('the Gantt chart’s rows are tall enough for their labels, in order of date, and scroll', async () => {
  await opened('gantt');
  await expect(ganttBars()).toHaveCount(await dated());
  const rows = await ganttBars().evaluateAll(els => els.map(el => ({ y: +el.getAttribute('y'), height: +el.getAttribute('height'), date: el.textContent })));
  expect(Math.min(...rows.map(r => r.height))).toBeGreaterThanOrEqual(10);
  // Later dates, lower rows
  const sorted = rows.slice().sort((a, b) => a.y - b.y).map(r => r.date.split(': ')[1]);
  expect(sorted).toEqual(sorted.slice().sort());
  const scroller = gantt().locator('.gantt');
  expect(await scroller.evaluate(el => el.scrollHeight > el.clientHeight + 100)).toBe(true);
});

test('its axis stays in view as the rows scroll, over them', async () => {
  await opened('gantt');
  await expect(ganttBars()).toHaveCount(await dated());
  const scroller = gantt().locator('.gantt');
  const axisInView = () => page.evaluate(() => {
    const scroller = document.querySelector('.lm_content:has(button[title="Export Gantt"]) .gantt');
    const axis = scroller.querySelector('.x-axis .domain').getBoundingClientRect(), view = scroller.getBoundingClientRect();
    return axis.top > view.top && axis.bottom <= view.bottom;
  });
  expect(await axisInView()).toBe(true);
  await scroller.evaluate(el => { el.scrollTop = el.scrollHeight / 2; });
  await expect.poll(axisInView).toBe(true);
  await scroller.evaluate(el => { el.scrollTop = el.scrollHeight; });
  await expect.poll(axisInView).toBe(true);
  // Drawn after the rows and their labels, on the background
  expect(await gantt().locator('svg').evaluate(svg => {
    const order = Array.from(svg.children, g => g.getAttribute('class'));
    return order.indexOf('x-axis') > order.indexOf('gantt-chart') && order.indexOf('x-axis') > order.indexOf('y-axis');
  })).toBe(true);
  await expect(gantt().locator('.x-axis rect.axis-background')).toHaveCount(1);
  await scroller.evaluate(el => { el.scrollTop = 0; });
});

test('a single date is a dot, and hovering a row says its dates', async () => {
  await opened('gantt');
  const dot = gantt().locator('svg .gantt-chart rect.dot').first();
  const [width, height, rx] = await dot.evaluate(el => ['width', 'height', 'rx'].map(a => +el.getAttribute(a)));
  expect(width).toBe(height);
  expect(rx).toBe(height / 2);
  expect(await dot.textContent()).toMatch(/^\S+: \d{4}-\d{2}-\d{2}$/);
  // Nothing covers the rows, so hovering one reaches it (and its title), and
  // the line still follows the pointer
  const box = await dot.boundingBox();
  const hit = await page.evaluate(([x, y]) => document.elementFromPoint(x, y).classList.contains('dot'), [box.x + box.width / 2, box.y + box.height / 2]);
  expect(hit).toBe(true);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await expect(gantt().locator('.mouse-over-effects')).toHaveCSS('opacity', '1');
  // Exported whole, the axis under the last row
  const modal = await openExport(page, gantt(), 'Export Gantt');
  await modal.locator('select[name="export-filetype"]').selectOption('svg');
  const [download] = await Promise.all([page.waitForEvent('download'), modal.locator('button', { hasText: 'Export' }).click()]);
  const svg = fs.readFileSync(await download.path(), 'utf8');
  const axisY = +svg.match(/class="x-axis"[^>]*transform="translate\([\d.]+,([\d.]+)\)"/)[1];
  const svgHeight = +svg.match(/<svg[^>]* height="([\d.]+)"/)[1];
  expect(svgHeight - axisY).toBeLessThan(40);
});

// The sequences
const sequences = () => page.locator('.lm_content:has(.modal-title:has-text("Export Sequences"))').first();
const alignment = () => sequences().locator('canvas').first();
// The alignment's colors, and how many of its pixels are a letter's black
const pixels = () => alignment().evaluate(canvas => {
  const data = canvas.getContext('2d').getImageData(0, 0, Math.min(canvas.width, 400), Math.min(canvas.height, 200)).data;
  const colors = new Set();
  let dark = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] < 80 && data[i + 1] < 80 && data[i + 2] < 80) dark++;
    else colors.add('#' + [data[i], data[i + 1], data[i + 2]].map(v => v.toString(16).padStart(2, '0')).join(''));
  }
  return { dark, colors: Array.from(colors) };
});

test('the sequences have their ids beside them, staying put as the alignment pans', async () => {
  await opened('sequences');
  const ids = sequences().locator('canvas.sequence-ids');
  await expect(ids).toHaveCount(1);
  const [idBox, seqBox] = [await ids.boundingBox(), await sequences().locator('canvas.alignment').boundingBox()];
  expect(idBox.height).toBe(seqBox.height);
  expect(idBox.x + idBox.width).toBeLessThanOrEqual(seqBox.x + 1);
  const panel = await sequences().locator('.sequences-panel').boundingBox();
  await page.mouse.move(panel.x + 600, panel.y + 300);
  await page.mouse.down();
  await page.mouse.move(panel.x + 300, panel.y + 300, { steps: 5 });
  await page.mouse.up();
  const [after, moved] = [await ids.boundingBox(), await sequences().locator('canvas.alignment').boundingBox()];
  expect(after.x).toBe(idBox.x);
  expect(moved.x).toBeLessThan(seqBox.x - 200);
});

test('letters are drawn only in cells wide enough for them', async () => {
  await opened('sequences');
  await set('sequences-show-chars', true);
  await set('sequences-cell-width', 2);
  await set('sequences-cell-height', 12);
  await expect.poll(async () => (await alignment().evaluate(c => c.width)) > 0).toBe(true);
  await page.waitForTimeout(300);
  expect((await pixels()).dark).toBe(0);
  await sequences().locator('button[title="Sequences Settings"]').click();
  await expect(sequences().locator('.sequences-letters-note')).toBeVisible();
  await set('sequences-cell-width', 10);
  await expect.poll(async () => (await pixels()).dark).toBeGreaterThan(0);
  await expect(sequences().locator('.sequences-letters-note')).toBeHidden();
  await sequences().locator('button[title="Sequences Settings"]').click();
  await set('sequences-cell-width', 2);
});

test('bases have four distinct colors, with a key', async () => {
  await opened('sequences');
  await set('sequences-cell-width', 2);
  await expect.poll(async () => (await pixels()).dark).toBe(0);
  const key = sequences().locator('.sequences-key');
  await expect(key).toBeVisible();
  expect(await key.locator('span').allInnerTexts()).toEqual(['A', 'C', 'G', 'T', 'Other']);
  const swatches = await key.locator('i').evaluateAll(is => is.map(i => getComputedStyle(i).backgroundColor));
  const hex = rgb => '#' + rgb.match(/\d+/g).slice(0, 3).map(v => (+v).toString(16).padStart(2, '0')).join('');
  const { colors } = await pixels();
  // Each base's color is in the alignment, and none is close to another
  for (const swatch of swatches.slice(0, 4)) expect(colors).toContain(hex(swatch));
  const rgb = swatches.slice(0, 4).map(s => s.match(/\d+/g).slice(0, 3).map(Number));
  for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
    expect(Math.hypot(...rgb[i].map((v, k) => v - rgb[j][k]))).toBeGreaterThan(80);
  }
});

test('the PNG export has the ids beside the alignment', async () => {
  await opened('sequences');
  await expect(sequences().locator('canvas.sequence-ids')).toHaveCount(1);
  const widths = await page.evaluate(() => {
    const view = document.querySelector('.lm_content:has(.sequences-panel)');
    return [view.querySelector('canvas.sequence-ids').width, view.querySelector('canvas.alignment').width];
  });
  const modal = await openExport(page, sequences(), 'Export Sequences');
  await modal.locator('select').selectOption('png');
  const [download] = await Promise.all([page.waitForEvent('download'), modal.locator('button', { hasText: 'Export' }).click()]);
  // A PNG's width is in its header
  const png = fs.readFileSync(await download.path());
  expect(png.readUInt32BE(16)).toBe(widths[0] + widths[1]);
  expect(errors).toEqual([]);
});
