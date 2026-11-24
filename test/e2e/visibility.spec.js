/* global kept, updates, drawn, offRedraw -- set on window by the specs' page.evaluate calls */
// What a threshold change or a step of the timeline recomputes: the visible
// links are built once for all the views and kept while they don't change, a
// run of changes is applied once, and the dates are read once.
const { test, expect } = require('@playwright/test');
const { watchErrors, loadNetwork, launchView } = require('./helpers');

test.describe.configure({ mode: 'serial' });

let page, errors;
test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  errors = watchErrors(page);
  await loadNetwork(page);
  await launchView(page, 'table');
});
test.afterAll(() => page.close());

// The threshold changed and the network followed
const settled = () => page.evaluate(() => new Promise(resolve => {
  const off = MT.events.on('node-visibility', () => { off(); resolve(); });
}));
const setThreshold = value => Promise.all([settled(), page.evaluate(value => MT.settings.set('link-threshold', value), value)]);

test('the visible links are built once, and shared by whoever asks', async () => {
  const [same, copies] = await page.evaluate(() => {
    const a = MT.getVisibleLinks(), b = MT.getVisibleLinks();
    const copy = MT.getVisibleLinks(true);
    return [a.length > 0 && a.every((l, i) => l === b[i]), copy.length === a.length && copy.every((l, i) => l !== a[i] && l.origin !== a[i].origin && JSON.stringify(l) === JSON.stringify(a[i]))];
  });
  expect(same).toBe(true);
  expect(copies).toBe(true);
});

test('a change that leaves the visible links alone keeps their objects', async () => {
  const before = await page.evaluate(() => { window.kept = MT.getVisibleLinks(); return kept.length; });
  // (a threshold between the same two distances)
  await page.evaluate(() => {
    const g = session.data.graph, t = session.style.widgets['link-threshold'];
    let next = Infinity;
    g.forEachValue(session.style.widgets['link-sort-variable'], v => { if (v > t && v < next) next = v; });
    window.nextDistance = next;
  });
  const gap = await page.evaluate(() => {
    const t = session.style.widgets['link-threshold'];
    return (window.nextDistance + t) / 2;
  });
  await setThreshold(gap);
  const result = await page.evaluate(() => { const now = MT.getVisibleLinks(); return { length: now.length, same: now.every((l, i) => l === kept[i]) }; });
  expect(result).toEqual({ length: before, same: true });
});

test('links that stay visible and in their cluster keep their objects, and the list follows the graph', async () => {
  await page.evaluate(() => { window.kept = MT.getVisibleLinks(); });
  await setThreshold(0.005);
  const result = await page.evaluate(() => {
    const g = session.data.graph, now = MT.getVisibleLinks(), was = new Map(kept.map(l => [l.index, l]));
    const edges = Array.from(g.visible.subarray(0, g.visibleCount));
    return {
      listed: now.length === g.visibleCount && now.every((l, i) => l.index === edges[i]),
      // (but a link whose cluster has another number is a new object)
      reused: now.every(l => !was.has(l.index) || (was.get(l.index).cluster === l.cluster) === (was.get(l.index) === l)),
      some: now.some(l => was.get(l.index) === l),
      shrank: now.length < kept.length,
      fresh: now.every(l => JSON.stringify(l) === JSON.stringify(MT.linkObject(l.index, true))),
      statistics: document.getElementById('numberOfVisibleLinks').textContent === now.length.toLocaleString()
    };
  });
  expect(result).toEqual({ listed: true, reused: true, some: true, shrank: true, fresh: true, statistics: true });
});

test('a run of changes is applied once, with the last value', async () => {
  const events = await page.evaluate(() => {
    window.updates = 0;
    MT.events.on('link-visibility', () => updates++);
    [0.01, 0.02, 0.012, 0.03, 0.015].forEach(v => MT.settings.set('link-threshold', v));
    return updates;
  });
  expect(events).toBe(0);
  await expect.poll(() => page.evaluate(() => updates)).toBeGreaterThan(0);
  // Waits to see that no second update follows the first
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => updates)).toBe(1);
  expect(await page.evaluate(() => MT.getVisibleLinks().length === session.data.graph.visibleCount && session.style.widgets['link-threshold'])).toBe(0.015);
});

test('a view that listens to node and link visibility redraws once for a change', async () => {
  await page.evaluate(() => {
    window.drawn = 0;
    const redraw = () => drawn++;
    const offs = ['node-visibility', 'link-visibility'].map(type => MT.events.on(type, redraw));
    window.offRedraw = () => offs.forEach(off => off());
  });
  await setThreshold(0.01);
  // Waits to see that no second redraw follows the first
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => { offRedraw(); return drawn; })).toBe(1);
  await setThreshold(0.015);
});

test('the timeline reads the dates once, and shows the nodes dated up to its date', async () => {
  await page.evaluate(() => MT.settings.set('node-timeline-variable', 'date'));
  await page.waitForFunction(() => MT.scrubTimeline);
  const result = await page.evaluate(() => {
    const first = MT.nodeTimes('date');
    const read = MT.nodeTimes('date') === first;
    const dates = session.data.nodes.map(d => MT.parseDate(d.date));
    const sorted = dates.filter(Boolean).sort((a, b) => a - b);
    const middle = sorted[Math.floor(sorted.length / 2)];
    window.scrubbed = middle;
    MT.scrubTimeline(middle);
    const shown = session.data.nodes.every((d, i) => d.visible === (!dates[i] || dates[i] <= middle));
    const linksKept = MT.getVisibleLinks().length === session.data.graph.visibleCount;
    // A node's date changed: the next step reads it
    const node = session.data.nodes.find((d, i) => dates[i] && dates[i] > middle);
    node.date = '1900-01-01';
    MT.scrubTimeline(middle);
    const changed = node.visible === true && MT.nodeTimes('date') !== first;
    return { read, shown, linksKept, changed, dated: sorted.length > 10 };
  });
  expect(result).toEqual({ read: true, shown: true, linksKept: true, changed: true, dated: true });
  await page.evaluate(() => MT.settings.set('node-timeline-variable', 'None'));
  expect(errors).toEqual([]);
});
