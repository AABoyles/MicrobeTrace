// Speed budgets, on 2,000 generated sequences (about 2 million pairs): how
// long loading, a threshold change and opening a view take, how often the
// network redraws for one change, and how often it reads node positions back
// from the GPU (a WebGL readPixels, which waits for everything the GPU has
// queued, here its layout). The counts are exact. The times are budgets well
// above what this takes, to catch slowdowns of several times rather than
// noise; they're of the page's own work, as the GPU these tests run on is a
// software one (SwiftShader), far slower than any real one. Each result is
// logged, to compare runs.
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { watchErrors, open, launchView } = require('./helpers');

test.describe.configure({ mode: 'serial' });

// Sequences of 1,000 sites in clusters of 25: each a few changes from its
// cluster's centre, each centre a few dozen from a common ancestor
const N = 2000;
const fasta = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mt-bench-')), `bench${N}.fasta`);
(() => {
  let seed = 7;
  const random = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  const bases = 'ACGT', length = 1000;
  const base = Array.from({ length }, () => bases[Math.floor(random() * 4)]);
  const mutate = (s, k) => {
    s = s.slice();
    for (let i = 0; i < k; i++) s[Math.floor(random() * length)] = bases[Math.floor(random() * 4)];
    return s;
  };
  const centres = Array.from({ length: Math.ceil(N / 25) }, () => mutate(base, 60));
  fs.writeFileSync(fasta, Array.from({ length: N }, (_, i) => `>s${i}\n${mutate(centres[i % centres.length], 8).join('')}\n`).join(''));
})();

let page, errors, lastRender = 0;
const results = {};
test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  errors = watchErrors(page);
  // Counts every read back from a WebGL canvas
  await page.addInitScript(() => {
    window.readbacks = 0;
    [self.WebGLRenderingContext, self.WebGL2RenderingContext].forEach(type => {
      if (!type) return;
      const readPixels = type.prototype.readPixels;
      type.prototype.readPixels = function(...args) {
        window.readbacks++;
        return readPixels.apply(this, args);
      };
    });
  });
  // Counts the network's redraws, and when the last one was done
  page.on('console', m => {
    if (!m.text().startsWith('Network render time')) return;
    results.renders = (results.renders || 0) + 1;
    lastRender = Date.now();
  });
});
test.afterAll(async () => {
  console.log('Benchmark:', JSON.stringify(results));
  await page.close();
});

const readbacks = () => page.evaluate(() => window.readbacks);
// Readbacks over a while, the view left alone
async function readbacksOver(ms) {
  const before = await readbacks();
  await page.waitForTimeout(ms);
  return (await readbacks()) - before;
}
const front = view => page.evaluate(view => {
  const item = layout.contentItems.find(i => i.componentType == view);
  item.parent.setActiveComponentItem(item, true);
}, view);

test(`loading ${N} sequences takes under 20 seconds`, async () => {
  await open(page);
  await page.setInputFiles('#data-files', fasta);
  await page.waitForFunction(() => document.querySelectorAll('#file-table .file-table-row').length == 1);
  const start = Date.now();
  await page.click('#launch');
  await page.waitForFunction(() => session.data.clusters.length > 0 && document.getElementById('numberOfNodes').textContent != '', null, { timeout: 120000 });
  await page.waitForFunction(() => temp.network && temp.network.points.length > 0, null, { timeout: 60000 });
  results.loadMs = Date.now() - start;
  expect(await page.evaluate(() => session.data.graph.edgeCount)).toBe(N * (N - 1) / 2);
  expect(results.loadMs).toBeLessThan(20000);
});

test('a threshold change redraws the network once, in under 2 seconds', async () => {
  await page.waitForTimeout(1500);
  results.renders = 0;
  const start = Date.now();
  await page.evaluate(() => MT.settings.set('link-threshold', 0.02));
  await expect.poll(() => results.renders).toBe(1);
  results.thresholdMs = lastRender - start;
  // (no second one after it)
  await page.waitForTimeout(1000);
  results.rendersPerChange = results.renders;
  expect(results.rendersPerChange).toBe(1);
  expect(await page.evaluate(() => temp.network.links.length)).toBe(await page.evaluate(() => MT.getVisibleLinks().length));
  expect(results.thresholdMs).toBeLessThan(2000);
});

test('laying out, the network reads positions back only to keep the layout in view', async () => {
  // Zoomed (as a user would), it's no longer kept in view
  const box = await page.locator('.network-view').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, 200);
  await page.mouse.move(5, 5);
  await page.evaluate(() => temp.network.graph.start(0.5));
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => temp.network.graph.isSimulationRunning)).toBe(true);
  results.readbacksPer3s = await readbacksOver(3000);
  expect(results.readbacksPer3s).toBe(0);
});

test('behind another view, the network neither simulates nor reads positions back', async () => {
  await launchView(page, 'table');
  await front('table');
  await page.waitForTimeout(300);
  results.hiddenReadbacksPer3s = await readbacksOver(3000);
  expect(results.hiddenReadbacksPer3s).toBe(0);
  expect(await page.evaluate(() => temp.network.paused && !temp.network.graph.isSimulationRunning)).toBe(true);
  // ...and picks up where it was when it's shown again
  await front('network');
  await expect.poll(() => page.evaluate(() => !temp.network.paused)).toBe(true);
});

test('opening a view takes under 5 seconds', async () => {
  const start = Date.now();
  await launchView(page, 'histogram');
  await page.waitForFunction(() => document.querySelector('.histogram-plot .main-svg'), null, { timeout: 30000 });
  results.histogramMs = Date.now() - start;
  expect(results.histogramMs).toBeLessThan(5000);
  expect(errors).toEqual([]);
});
