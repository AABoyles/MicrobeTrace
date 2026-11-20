/* global stalled, RealWorker -- set on window by the specs' page.evaluate calls */
// The loading dialog (#265, #190): real progress, a Cancel that stops the work,
// and a live region for the progress text; and what a file is read as, decided
// from its contents (#267).
const path = require('path');
const { test, expect } = require('@playwright/test');
const { fixtures, watchErrors, open } = require('./helpers');

const fixture = name => path.join(__dirname, 'fixtures', name);
const file = (name, text) => ({ name, mimeType: 'text/plain', buffer: Buffer.from(text) });
const upload = name => ({ name, mimeType: 'text/plain', buffer: require('fs').readFileSync(fixture(name)) });

let page, errors;
test.beforeEach(async ({ browser }) => {
  page = await browser.newPage();
  errors = watchErrors(page);
});
test.afterEach(() => page.close());

const rows = () => page.locator('#file-table .file-table-row');
const row = name => rows().filter({ hasText: name });
const active = name => row(name).locator('label:has(> input:checked)');

test('Cancel terminates the workers and returns to the files, still listed', async () => {
  // Workers that never reply, so the load is waiting on one
  await page.addInitScript(() => {
    window.stalled = { started: 0, terminated: 0 };
    window.Worker = class {
      constructor() { window.stalled.started++; }
      postMessage() {}
      terminate() { window.stalled.terminated++; }
    };
  });
  await open(page);
  await page.setInputFiles('#data-files', fixtures);
  await expect(rows()).toHaveCount(3);
  await page.click('#launch');
  await expect(page.locator('#loading-information-modal')).toHaveClass(/show/);
  await expect(page.locator('#loading-progress-text')).toContainText('Parsing');
  const started = await page.evaluate(() => stalled.started);
  expect(started).toBeGreaterThan(0);
  await page.click('#loading-cancel');
  await expect(page.locator('#loading-information-modal')).not.toHaveClass(/show/);
  expect(await page.evaluate(() => stalled.terminated)).toBeGreaterThan(0);
  await expect(rows()).toHaveCount(3);
  await expect(page.locator('#launch')).toBeEnabled();
  await expect(page.locator('.toast', { hasText: 'cancelled' }).first()).toBeVisible();
  expect(await page.evaluate(() => session.data.nodes.length)).toBe(0);
  expect(await page.evaluate(() => session.files.length)).toBe(3);
  await expect(page.locator('#file-table')).toBeVisible();
  expect(errors).toEqual([]);
});

test('after a cancel, Launch loads the files', async () => {
  await open(page);
  await page.setInputFiles('#data-files', fixtures);
  await expect(rows()).toHaveCount(3);
  // Stall the workers for the first launch only
  await page.evaluate(() => {
    window.RealWorker = Worker;
    window.Worker = class { postMessage() {} terminate() {} };
  });
  await page.click('#launch');
  await expect(page.locator('#loading-information-modal')).toHaveClass(/show/);
  await page.click('#loading-cancel');
  await expect(page.locator('#loading-information-modal')).not.toHaveClass(/show/);
  await expect(page.locator('#launch')).toBeEnabled();
  await page.evaluate(() => { window.Worker = RealWorker; });
  await page.click('#launch');
  await page.waitForFunction(() => session.data.nodes.length > 0 && session.data.clusters.length > 0, null, { timeout: 60000 });
});

test('the progress text names the steps, with a percentage for the distances, in a live region', async () => {
  await open(page);
  await page.setInputFiles('#data-files', fixtures);
  await expect(rows()).toHaveCount(3);
  await page.evaluate(() => {
    window.seen = [];
    new MutationObserver(() => seen.push(document.getElementById('loading-progress-text').textContent))
      .observe(document.getElementById('loading-progress-text'), { childList: true, characterData: true, subtree: true });
  });
  await page.click('#launch');
  await expect(page.locator('#loading-progress-text')).toHaveAttribute('role', 'status');
  await expect(page.locator('#loading-progress-text')).toHaveAttribute('aria-live', 'polite');
  await expect(page.locator('#loading-information-modal .dna')).toHaveAttribute('aria-hidden', 'true');
  await page.waitForFunction(() => session.data.clusters.length > 0, null, { timeout: 60000 });
  const seen = await page.evaluate(() => seen);
  expect(seen.some(t => /^Parsing/.test(t))).toBe(true);
  expect(seen.some(t => /^Computing distances \(\d+%\)/.test(t))).toBe(true);
  await expect(page.locator('#loading-information-modal')).toHaveAttribute('aria-busy', 'false');
});

test('there is no Close that leaves the work running, and no joke toast', async () => {
  await open(page);
  await expect(page.locator('#loading-information-modal .modal-footer button')).toHaveText(['Cancel']);
  expect(await page.evaluate(() => document.body.innerHTML.includes('reverse the DNA'))).toBe(false);
});

test('a distance matrix named dm.csv is read as a matrix, and loads', async () => {
  await open(page);
  await page.setInputFiles('#data-files', fixture('dm.csv'));
  await expect(active('dm.csv')).toHaveText('Matrix');
  await expect(row('dm.csv').locator('.file-detected')).toContainText('distance matrix');
  await page.click('#launch');
  await page.waitForFunction(() => session.data.nodes.length == 4 && session.data.graph.m == 6, null, { timeout: 60000 });
});

test('a tab-separated matrix and a triangular matrix are matrices', async () => {
  await open(page);
  await page.setInputFiles('#data-files', [fixture('dm.tsv'), fixture('tri.csv')]);
  await expect(active('dm.tsv')).toHaveText('Matrix');
  await expect(active('tri.csv')).toHaveText('Matrix');
  await expect(row('dm.tsv').locator('.file-detected')).toContainText('tab-separated');
});

test('a tab-separated link list has its columns, and loads', async () => {
  await open(page);
  await page.setInputFiles('#data-files', fixture('links.tsv'));
  await expect(active('links.tsv')).toHaveText('Link');
  expect(await row('links.tsv').locator('select').evaluateAll(s => s.map(s => s.value))).toEqual(['source', 'target', 'distance']);
  await expect(page.locator('#launch')).toBeEnabled();
  await page.click('#launch');
  await page.waitForFunction(() => session.data.nodes.length == 4 && session.data.graph.m == 3, null, { timeout: 60000 });
});

test('a file is read from its contents: FASTA, Newick, nodes, links', async () => {
  await open(page);
  await page.setInputFiles('#data-files', [
    file('sequences.txt', '>a\nACGT\n>b\nACGA\n'),
    upload('tree.txt'),
    upload('patients.csv'),
    file('pairs.dat', 'source,target\nA,B\nB,C\n')
  ]);
  await expect(rows()).toHaveCount(4);
  await expect(active('sequences.txt')).toHaveText('FASTA');
  await expect(active('tree.txt')).toHaveText('Newick');
  await expect(active('patients.csv')).toHaveText('Node');
  await expect(active('pairs.dat')).toHaveText('Link');
  // ...and the choice is still the user's
  await row('patients.csv').locator('label', { hasText: 'Link' }).click();
  await expect(active('patients.csv')).toHaveText('Link');
});

test('a file that cannot be split into columns says how it was read', async () => {
  await open(page);
  await page.setInputFiles('#data-files', file('notes.txt', 'just some words\nand some more\n'));
  await expect(row('notes.txt').locator('.file-problem')).toContainText('No columns were found in this file (read as comma-separated)');
});
