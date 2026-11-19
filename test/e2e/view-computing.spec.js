// The views that compute when opened or redrawn (#293): the tree, the heatmap's
// distance matrix and the sequences' alignment. Each shows that it is computing,
// with its progress, in a live region; its Cancel (by keyboard too) stops its own
// workers and no others; and Retry computes it normally. The workers here stall:
// they report half way and never reply, so a view stays computing until it is
// cancelled or closed.
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
test.afterEach(() => unstall());

const viewOf = title => page.locator(`.lm_content:has(button[title="${title}"])`).first();
const treeView = () => viewOf('Export Phylogenetic Tree');
const heatmapView = () => viewOf('Export Heatmap');
const sequencesView = () => viewOf('Export Sequences');
// Whether a view's computing card is up. (Views in one tab stack are hidden
// behind the active tab, so this reads the card's own flag, not its visibility.)
const shown = view => view.locator('.view-computing-card').evaluate(el => !el.hidden);
const card = view => view.locator('.view-computing-card');
const status = view => view.locator('.view-computing [role="status"]');
const cancel = view => view.locator('.view-computing-cancel');
const retry = view => view.locator('.view-computing-retry');
const leaves = () => treeView().locator('g.tidytree-node-leaf circle');

// Replaces Worker with one that reports half way and then never replies, and
// records each worker's script and whether it was terminated
async function stall() {
  await page.evaluate(() => {
    window.RealWorker = window.RealWorker || Worker;
    window.stalled = [];
    window.Worker = class {
      constructor(script) { this.record = { script, terminated: 0 }; stalled.push(this.record); }
      postMessage() { setTimeout(() => this.onmessage && this.onmessage({ data: { progress: 0.5 } })); }
      terminate() { this.record.terminated++; }
    };
  });
}
const unstall = () => page.evaluate(() => { if (window.RealWorker) window.Worker = RealWorker; });
// Whether each stalled worker has been terminated, in the order they started
const workers = () => page.evaluate(() => stalled.map(w => ({ script: w.script, terminated: w.terminated })));
// Forces the distance matrix to be computed again (its cache is keyed by the graph's version)
const forgetDM = () => page.evaluate(() => { session.data.graph.version++; });

test('the tree says it is computing, with progress, and Cancel stops its workers', async () => {
  await closeView(page, 'phylogenetic_tree');
  await page.evaluate(() => { temp.tree = null; });
  await forgetDM();
  await stall();
  await launchView(page, 'phylogenetic_tree');
  const view = treeView();
  await expect.poll(() => shown(view)).toBe(true);
  await expect(status(view)).toHaveAttribute('aria-live', 'polite');
  await expect(status(view)).toHaveText('Computing the tree (50%)...');
  await expect(view.locator('.view-computing-progress [role="progressbar"]')).toHaveAttribute('aria-valuenow', '50');
  // Over the view, but not over its controls
  await view.locator('button[title="Phylogenetic Tree Settings"]').click();
  await expect(view.locator('.left-pane')).toBeVisible();
  await view.locator('button[title="Phylogenetic Tree Settings"]').click();

  // By keyboard: Cancel takes focus, and Enter presses it
  await cancel(view).focus();
  await page.keyboard.press('Enter');
  await expect(status(view)).toHaveText('Computing the tree was cancelled.');
  await expect(retry(view)).toBeVisible();
  await expect(retry(view)).toBeFocused();
  const started = await workers();
  expect(started.length).toBeGreaterThan(0);
  expect(started.every(w => w.terminated == 1)).toBe(true);
  expect(await page.evaluate(() => temp.tree)).toBeNull();
  await expect(leaves()).toHaveCount(0);
});

test('Retry computes the tree normally', async () => {
  const view = treeView();
  await unstall();
  await retry(view).click();
  await expect.poll(() => shown(view)).toBe(false);
  await expect.poll(() => leaves().count(), { timeout: 60000 }).toBeGreaterThan(0);
  expect(await leaves().count()).toBe(await page.evaluate(() => temp.tree.getLeaves().length));
  await expect(status(view)).toHaveText('');
});

test("a view's Cancel stops only its own workers, and closing a view stops its own", async () => {
  await closeView(page, 'phylogenetic_tree');
  await closeView(page, 'heatmap');
  await page.evaluate(() => { temp.tree = null; });
  await forgetDM();
  await stall();
  await launchView(page, 'phylogenetic_tree');
  await launchView(page, 'heatmap');
  await expect.poll(() => shown(treeView())).toBe(true);
  await expect.poll(() => shown(heatmapView())).toBe(true);
  await expect.poll(async () => (await workers()).length).toBe(2);
  expect((await workers()).every(w => w.script == 'workers/expand-dm.js' && !w.terminated)).toBe(true);

  await cancel(heatmapView()).click();
  await expect(status(heatmapView())).toHaveText('Computing the distance matrix was cancelled.');
  // Only the heatmap's worker is stopped (the tree's started first, so it is first)
  expect((await workers()).map(w => w.terminated)).toEqual([0, 1]);
  await expect(status(treeView())).toHaveText(/^Computing the tree/);
  await expect.poll(() => shown(treeView())).toBe(true);

  // Closing the tree while it computes stops its worker
  await closeView(page, 'phylogenetic_tree');
  expect((await workers()).map(w => w.terminated)).toEqual([1, 1]);

  // The heatmap's Retry draws it
  await unstall();
  await retry(heatmapView()).click();
  await expect.poll(() => shown(heatmapView())).toBe(false);
  const plot = heatmapView().locator('.js-plotly-plot');
  await expect.poll(() => plot.evaluate(el => el.data && el.data[0].z.length)).toBe(await page.evaluate(() => session.data.nodes.length));
});

test('the alignment says it is computing, Cancel stops its worker, and Retry draws it', async () => {
  await closeView(page, 'sequences');
  await stall();
  await launchView(page, 'sequences');
  const view = sequencesView();
  await expect(status(view)).toHaveText('Computing the alignment (50%)...');
  await expect(view.locator('canvas.alignment')).toHaveCount(0);
  await cancel(view).click();
  await expect(status(view)).toHaveText('Computing the alignment was cancelled.');
  const started = await workers();
  expect(started.map(w => w.script)).toEqual(['workers/render-alignment.js']);
  expect(started[0].terminated).toBe(1);

  await unstall();
  await retry(view).click();
  await expect.poll(() => shown(view)).toBe(false);
  const sequences = await page.evaluate(() => session.data.nodes.filter(d => d.seq).length);
  const height = await page.evaluate(() => session.style.widgets['sequences-cell-height']);
  await expect.poll(() => view.locator('canvas.alignment').first().evaluate(c => c.height)).toBe(sequences * height);
  await expect(view.locator('canvas.alignment')).toHaveCount(1);
  expect(errors).toEqual([]);
});
