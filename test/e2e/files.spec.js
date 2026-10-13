// The files view: adding files and choosing how each is read, the loading
// settings, generating sequences, the sequence controls (alignment and audit)
// and launching.
const { test, expect } = require('@playwright/test');
const { fixtures, watchErrors, open, waitForModal } = require('./helpers');

test.describe.configure({ mode: 'serial' });

let page, errors;
test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  errors = watchErrors(page);
  await open(page);
});
test.afterAll(() => page.close());

const view = () => page.locator('.lm_content:has(#file-table)').first();
const pane = () => view().locator('.left-pane');
const rows = () => page.locator('#file-table .file-table-row');
const row = name => rows().filter({ hasText: name });
const fields = name => row(name).locator('select');
const get = key => page.evaluate(key => session.style.widgets[key], key);

test('lists added files, reading each as its kind', async () => {
  await page.setInputFiles('#data-files', fixtures);
  await expect(rows()).toHaveCount(3);
  await expect(row('links.csv').locator('label.active')).toHaveText('Link');
  await expect(row('nodes.csv').locator('label.active')).toHaveText('Node');
  await expect(row('seqs.fasta').locator('label.active')).toHaveText('FASTA');
  // The fields named for what they hold are chosen
  expect(await fields('links.csv').evaluateAll(s => s.map(s => s.value))).toEqual(['source', 'target', 'distance']);
  expect(await fields('nodes.csv').nth(0).inputValue()).toBe('id');
  await expect(fields('seqs.fasta').first()).toBeHidden();
  await expect(page.locator('#launch')).toBeEnabled();
});

test("changing a file's kind changes its fields", async () => {
  await row('links.csv').locator('label', { hasText: 'Node' }).click();
  await expect(row('links.csv').locator('label', { hasText: 'Sequence' })).toBeVisible();
  await expect(fields('links.csv').nth(2)).toBeHidden();
  expect(await page.evaluate(() => session.files.find(f => f.name == 'links.csv').format)).toBe('node');
  await row('links.csv').locator('label', { hasText: 'Matrix' }).click();
  await expect(fields('links.csv').first()).toBeHidden();
  await row('links.csv').locator('label', { hasText: 'Link' }).click();
  await expect(fields('links.csv').nth(2)).toBeVisible();
  expect(await page.evaluate(() => { const f = session.files.find(f => f.name == 'links.csv'); return [f.format, f.field1, f.field2, f.field3]; }))
    .toEqual(['link', 'source', 'target', 'distance']);
});

test('the distance metric sets the link threshold', async () => {
  await view().locator('button[title="Files Settings"]').click();
  await expect(pane()).toBeVisible();
  const metric = pane().locator('select[data-setting="default-distance-metric"]');
  await metric.selectOption('snps');
  await expect.poll(() => get('link-threshold')).toBe(await page.evaluate(() => MT.distanceMetrics.snps.threshold));
  await expect(pane().locator('input[data-setting="link-threshold"]')).toHaveAttribute('step', '1');
  // GapMM is for TN93 only
  await expect(pane().locator('option[value="GAPMM"]')).toBeDisabled();
  await metric.selectOption('tn93');
  await expect.poll(() => get('link-threshold')).toBe(0.015);
  await expect(pane().locator('option[value="GAPMM"]')).toBeEnabled();
});

test('the HIV-TRACE ambiguity strategy has a threshold', async () => {
  const threshold = pane().locator('input[data-setting="ambiguity-threshold"]');
  await expect(threshold).toBeHidden();
  await pane().locator('select[data-setting="ambiguity-resolution-strategy"]').selectOption('HIVTRACE-G');
  await expect(threshold).toBeVisible();
  await pane().locator('select[data-setting="ambiguity-resolution-strategy"]').selectOption('AVERAGE');
  await expect(threshold).toBeHidden();
});

test('the view to launch is a setting', async () => {
  await pane().locator('select[data-setting="default-view"]').selectOption('table');
  expect(await get('default-view')).toBe('table');
  await pane().locator('select[data-setting="default-view"]').selectOption('network');
});

test('sequences can be generated', async () => {
  await pane().locator('.nav-link', { hasText: 'Experimental' }).click();
  await pane().locator('input.generate-number').fill('10');
  await pane().locator('button', { hasText: 'Sequences' }).click();
  await expect(rows()).toHaveCount(4);
  await expect(row('generatedNodes.csv').locator('label.active')).toHaveText('Node');
  await pane().locator('.nav-link', { hasText: 'Files' }).click();
  await view().locator('button[title="Files Settings"]').click();
  await expect(pane()).toBeHidden();
  // ...and removed
  await row('generatedNodes.csv').locator('a[title="Remove this file"]').click();
  await expect(rows()).toHaveCount(3);
  expect(await page.evaluate(() => session.files.map(f => f.name).sort())).toEqual(['links.csv', 'nodes.csv', 'seqs.fasta']);
});

test('the sequence controls preview the sequences, and align them with Smith-Waterman', async () => {
  await view().locator('button', { hasText: 'Sequence Settings' }).click();
  await waitForModal(page, '#sequence-controls-modal');
  const modal = page.locator('#sequence-controls-modal');
  await expect(modal.locator('.alignment-preview canvas')).toHaveCount(1, { timeout: 30000 });
  // The preview scrolls inside the dialog rather than spilling out of it
  const [preview, dialog] = await Promise.all([modal.locator('.alignment-preview'), modal.locator('.modal-content')].map(l => l.boundingBox()));
  expect(preview.x + preview.width).toBeLessThanOrEqual(dialog.x + dialog.width);
  expect(await modal.locator('.alignment-preview').evaluate(el => getComputedStyle(el).overflowX)).toBe('auto');
  await expect(modal.locator('.align-config-row').first()).toBeHidden();
  await modal.locator('label', { hasText: 'Smith-Waterman' }).click();
  await expect(modal.locator('.align-config-row').first()).toBeVisible();
  expect(await get('align-sw')).toBe(true);
  await modal.locator('label', { hasText: 'First Sequence' }).click();
  await expect(modal.locator('.reference-file-row')).toBeHidden();
  expect(await get('reference-source-first')).toBe(true);
  await modal.locator('label', { hasText: 'Load From FASTA' }).click();
  await expect(modal.locator('.reference-file-row')).toBeVisible();
  await modal.locator('label', { hasText: /^\s*None\s*$/ }).click();
  await expect(modal.locator('.align-config-row').first()).toBeHidden();
  expect(await get('align-sw')).toBe(false);
});

test('the audit flags odd sequences, which can be excluded', async () => {
  const modal = page.locator('#sequence-controls-modal');
  await modal.locator('.nav-link', { hasText: 'Audit' }).click();
  await page.setInputFiles('#data-files', { name: 'odd.fasta', mimeType: 'text/plain', buffer: Buffer.from('>empty\n\n>gaps\n-----\n>rna\nACGUACGU\n') });
  await expect(rows()).toHaveCount(4);
  await modal.locator('button', { hasText: 'Run' }).click();
  const flagged = modal.locator('.audited-sequences .alert');
  await expect(flagged.filter({ hasText: 'gaps appears to be all gaps' })).toHaveCount(1);
  await expect(flagged.filter({ hasText: 'rna appears to be RNA' })).toHaveCount(1);
  await flagged.filter({ hasText: 'rna appears' }).locator('button').click();
  expect(await page.evaluate(() => session.data.nodeExclusions)).toContain('rna');
  await expect(flagged.filter({ hasText: 'rna appears' }).locator('button')).toHaveText('Include');
  await flagged.filter({ hasText: 'rna appears' }).locator('button').click();
  expect(await page.evaluate(() => session.data.nodeExclusions)).not.toContain('rna');
  await modal.locator('button', { hasText: 'Done' }).click();
  await expect(modal).toBeHidden();
  await row('odd.fasta').locator('a[title="Remove this file"]').click();
  await expect(rows()).toHaveCount(3);
});

test('launching builds the network', async () => {
  await page.click('#launch');
  await page.waitForFunction(() => session.data.clusters.length > 0 && document.getElementById('numberOfNodes').textContent != '', null, { timeout: 120000 });
  await page.waitForFunction(() => !layout.contentItems.some(i => i.componentType == 'files'));
  expect(await page.evaluate(() => session.data.nodes.length)).toBe(310);
  expect(errors).toEqual([]);
});
