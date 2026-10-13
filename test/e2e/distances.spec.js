// Several distance metrics for the same sequences: the Files view computes
// those chosen under Also Compute beside the distance metric, each kept on the
// links under its own name (the distance metric's as distance), with the same
// values computing it alone would give; the network filters on any of them,
// each with its own threshold; and they're saved with the session.
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { watchErrors, open, waitForModal } = require('./helpers');

test.describe.configure({ mode: 'serial' });

const fixtures = ['seqs.fasta', 'links.csv', 'nodes.csv'].map(f => path.join(__dirname, 'fixtures', f));
const saved = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mt-distances-')), 'distances.microbetrace');

let page, errors;
test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  errors = watchErrors(page);
  await open(page);
});
test.afterAll(() => page.close());

const get = key => page.evaluate(key => MT.settings.get(key), key);
const set = (key, value) => page.evaluate(([key, value]) => MT.settings.set(key, value), [key, value]);
const also = () => page.locator('.distance-metrics-also-row');
// Chooses a metric in Also Compute
async function choose(metric) {
  const option = page.locator(`#distance-metrics-also-ts-dropdown .option[data-value="${metric}"]`);
  await expect(async () => {
    if (!(await option.isVisible())) await also().locator('.ts-control input').click();
    await expect(option).toBeVisible({ timeout: 1000 });
  }).toPass();
  await option.click();
  await page.keyboard.press('Escape');
}
// Loads the fixtures, and waits for the network
async function launch(page) {
  await page.setInputFiles('#data-files', fixtures);
  await page.waitForFunction(() => document.querySelectorAll('#file-table .file-table-row').length >= 3);
  await page.click('#launch');
  await page.waitForFunction(() => session.data.clusters.length > 0 && document.getElementById('numberOfNodes').textContent != '', null, { timeout: 120000 });
  await page.waitForFunction(() => !layout.contentItems.some(i => i.componentType == 'files'));
}
// The sum and count of a link field's values
const total = (page, field) => page.evaluate(field => {
  let sum = 0, count = 0;
  session.data.graph.forEachValue(field, v => { sum += v; count++; });
  return { sum, count };
}, field);
const visibleLinks = () => page.evaluate(() => MT.getVisibleLinks().length);

test('Also Compute offers every metric but the distance metric, and none with GapMM', async () => {
  await page.locator('.lm_content:has(#file-table) .settings-toggle').click();
  await expect(also()).toBeVisible();
  await also().locator('.ts-control input').click();
  const offered = () => page.locator('#distance-metrics-also-ts-dropdown .option').evaluateAll(os => os.map(o => o.dataset.value));
  await expect.poll(offered).toEqual(expect.arrayContaining(['snps', 'k2p', 'tn92', 'jc69', 'hamming']));
  expect(await offered()).not.toContain('tn93');
  await page.keyboard.press('Escape');
  await choose('snps');
  await choose('k2p');
  expect(await get('distance-metrics-also')).toEqual(['snps', 'k2p']);
  // Choosing one as the distance metric takes it off the others
  await set('default-distance-metric', 'k2p');
  await expect.poll(() => also().locator('.ts-control .item').evaluateAll(is => is.map(i => i.dataset.value))).toEqual(['snps']);
  await set('default-distance-metric', 'tn93');
  await choose('k2p');
  expect(await get('distance-metrics-also')).toEqual(['snps', 'k2p']);
  // GapMM computes TN93 alone
  await set('ambiguity-resolution-strategy', 'GAPMM');
  await expect(also().locator('.ts-wrapper')).toHaveClass(/disabled/);
  expect(await page.evaluate(() => MT.computedMetrics())).toEqual(['tn93']);
  await set('ambiguity-resolution-strategy', 'AVERAGE');
  await expect(also().locator('.ts-wrapper')).not.toHaveClass(/disabled/);
  expect(await page.evaluate(() => MT.computedMetrics())).toEqual(['tn93', 'snps', 'k2p']);
});

test('launching computes each metric for every pair, under its own name', async () => {
  await launch(page);
  const pairs = await page.evaluate(() => session.data.graph.densePairs);
  expect(pairs).toBeGreaterThan(40000);
  for (const field of ['distance', 'snps', 'k2p']) expect((await total(page, field)).count).toBeGreaterThanOrEqual(pairs);
  expect(await page.evaluate(() => ['snps', 'k2p'].every(f => session.data.linkFields.includes(f)))).toBe(true);
  // SNPs count sites; the others are proportions
  const max = field => page.evaluate(field => {
    let max = -Infinity;
    session.data.graph.forEachValue(field, v => { if (v > max) max = v; });
    return max;
  }, field);
  expect(await max('snps')).toBeGreaterThan(10);
  expect(await max('k2p')).toBeLessThan(1);
  expect(await page.evaluate(() => session.messages.join('\n'))).toContain('Also computed SNPs, K2P');
  // The menus offer them by name
  const options = await page.locator('#link-sort-variable option').allTextContents();
  expect(options).toEqual(expect.arrayContaining(['Distance', 'SNPs', 'K2P']));
});

test('each metric has the values computing it alone gives', async ({ browser }) => {
  const alone = await browser.newPage();
  await open(alone);
  await alone.evaluate(() => MT.settings.set('default-distance-metric', 'snps'));
  await launch(alone);
  // The computed triangles, over the same sequences in the same order
  const triangle = (page, field) => page.evaluate(field => {
    const g = session.data.graph;
    return { rows: Array.from(g.dense.rows, r => g.ids[r]).join(), values: Array.from(g.denseValues(field)) };
  }, field);
  const want = await triangle(alone, 'distance'), got = await triangle(page, 'snps');
  await alone.close();
  expect(got.rows).toBe(want.rows);
  expect(got.values).toEqual(want.values);
});

test('the network filters on any metric, each with its own threshold', async () => {
  const onDistance = await visibleLinks();
  expect(await get('link-threshold')).toBe(0.015);
  // SNPs starts at its own default, a count of sites
  await set('link-sort-variable', 'snps');
  await expect.poll(() => get('link-threshold')).toBe(16);
  await expect(page.locator('#link-threshold')).toHaveAttribute('step', '1');
  const onSnps = await visibleLinks();
  const within = await page.evaluate(() => {
    let n = 0;
    session.data.graph.forEachValue('snps', v => { if (v <= 16) n++; });
    return n;
  });
  expect(onSnps).toBe(within);
  expect(onSnps).not.toBe(onDistance);
  // A threshold set for one is kept for it
  await set('link-threshold', 8);
  await expect.poll(visibleLinks).toBeLessThan(onSnps);
  await set('link-sort-variable', 'distance');
  await expect.poll(() => get('link-threshold')).toBe(0.015);
  await expect.poll(visibleLinks).toBe(onDistance);
  await expect(page.locator('#link-threshold')).toHaveAttribute('step', '0.001');
  await set('link-sort-variable', 'snps');
  await expect.poll(() => get('link-threshold')).toBe(8);
  await set('link-sort-variable', 'distance');
  await expect.poll(() => get('link-threshold')).toBe(0.015);
});

test('the metrics are saved with the session, and filter on when it’s opened', async () => {
  await page.keyboard.press('Control+s');
  await waitForModal(page, '#session-save-modal');
  const modal = page.locator('#session-save-modal');
  await modal.locator('#save-file-name').fill('distances');
  await modal.locator('#save-file-compress').uncheck();
  const [download] = await Promise.all([page.waitForEvent('download'), modal.locator('#save-data').click()]);
  fs.copyFileSync(await download.path(), saved);
  await expect(modal).toBeHidden();
  const before = await total(page, 'k2p');

  await page.setInputFiles('#OpenTab', saved);
  await page.waitForFunction(() => document.getElementById('numberOfNodes').textContent != '' && session.data.graph.edgeCount > 0, null, { timeout: 60000 });
  const after = await total(page, 'k2p');
  expect(after.count).toBe(before.count);
  expect(after.sum).toBeCloseTo(before.sum, 3);
  await set('link-sort-variable', 'k2p');
  await expect.poll(() => get('link-threshold')).toBe(0.015);
  await set('link-threshold', 0.03);
  const within = await page.evaluate(() => {
    let n = 0;
    session.data.graph.forEachValue('k2p', v => { if (v <= 0.03) n++; });
    return n;
  });
  await expect.poll(visibleLinks).toBe(within);
  expect(errors).toEqual([]);
});

test('with only the links within the threshold kept, each metric keeps those within its own', async ({ browser }) => {
  const sparse = await browser.newPage();
  await open(sparse);
  await sparse.evaluate(() => {
    MT.settings.set('link-storage', 'threshold');
    MT.settings.set('distance-metrics-also', ['snps']);
  });
  await launch(sparse);
  const result = await sparse.evaluate(() => {
    let distance = 0, snps = 0, over = 0;
    session.data.graph.forEachValue('distance', v => { distance++; if (v > 0.015) over++; });
    session.data.graph.forEachValue('snps', v => { snps++; if (v > 16) over++; });
    return { distance, snps, over, dense: !!session.data.graph.dense };
  });
  await sparse.close();
  expect(result.dense).toBe(false);
  expect(result.distance).toBeGreaterThan(0);
  expect(result.snps).toBeGreaterThan(0);
  expect(result.over).toBe(0);
});
