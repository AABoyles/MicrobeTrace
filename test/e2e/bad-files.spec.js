// Files with duplicate IDs, and files cut off mid-record (as a download or a
// copy-paste can leave them): each loads, or is said not to, with a message
// that names the problem, and Launch finishes rather than hanging (#172)
const { test, expect } = require('@playwright/test');
const { watchErrors, open } = require('./helpers');

let page, errors;
test.beforeEach(async ({ browser }) => {
  page = await browser.newPage();
  errors = watchErrors(page);
  await open(page);
});
test.afterEach(async () => { expect(errors).toEqual([]); await page.close(); });

const file = (name, mimeType, text) => ({ name, mimeType, buffer: Buffer.from(text) });

// Adds the files to the Files view, and launches them once Launch is enabled
async function add(...files) {
  await page.setInputFiles('#data-files', files);
  await expect(page.locator('#file-table .file-table-row')).toHaveCount(files.length);
}

// Launches the files and waits for the load to finish (its dialog closes). A
// load that hangs fails here, at the timeout.
async function launch(...files) {
  await add(...files);
  await expect(page.locator('#launch')).toBeEnabled();
  await page.click('#launch');
  await page.waitForFunction(() => session.data.nodes.length > 0, null, { timeout: 60000 });
  await page.waitForFunction(() => !document.querySelector('#loading-information-modal.show'), null, { timeout: 60000 });
}
const ids = () => page.evaluate(() => session.data.nodes.map(d => d._id).sort());
const toast = text => page.locator('.toast').filter({ hasText: text });

// A repeated ID is one node, keeping its first row's values; a later row only
// fills in what is blank (as the loading log says)
test('a FASTA with a repeated ID keeps one node for it, with its first sequence, and says so', async () => {
  await launch(file('dup.fasta', 'text/plain', '>A\nACGTACGTAC\n>B\nACGTACGTAG\n>A\nTTTTACGTAC\n'));
  expect(await ids()).toEqual(['A', 'B']);
  expect(await page.evaluate(() => session.data.nodes.find(d => d._id == 'A').seq)).toBe('ACGTACGTAC');
  await expect(toast('1 repeated ID was merged')).toBeVisible();
});

test('a node list with a repeated ID keeps its first row’s values, and a later row fills its blanks', async () => {
  await launch(file('nodes.csv', 'text/csv', 'id,age,group\nA,30,\nB,40,g1\nA,50,g0\n'));
  expect(await ids()).toEqual(['A', 'B']);
  expect(await page.evaluate(() => session.data.nodes.find(d => d._id == 'A').age)).toBe(30);
  expect(await page.evaluate(() => session.data.nodes.find(d => d._id == 'A').group)).toBe('g0');
  await expect(toast('1 repeated ID was merged')).toBeVisible();
});

test('a link list cut off mid-row is read from its header, and loads with the short link named', async () => {
  // The last row has no distance: the file was cut off in it
  const links = file('links.csv', 'text/csv', 'source,target,distance\nA,B,0.1\nB,C');
  await add(links);
  // Its columns are found (the file is not reported as having none)
  const row = page.locator('.file-table-row').first();
  await expect(row.locator('.file-problem')).toBeHidden();
  await expect(row.locator('select').first()).toHaveValue('source');
  await page.click('#launch');
  await page.waitForFunction(() => session.data.graph && session.data.graph.m > 0, null, { timeout: 60000 });
  await page.waitForFunction(() => !document.querySelector('#loading-information-modal.show'), null, { timeout: 60000 });
  expect(await ids()).toEqual(['A', 'B', 'C']);
  await expect(toast('1 link has an empty distance')).toBeVisible();
});

test('a node list cut off mid-row loads its complete rows', async () => {
  await launch(file('nodes.csv', 'text/csv', 'id,age,group\nA,30,g0\nB,4'));
  expect(await ids()).toEqual(['A', 'B']);
  expect(await page.evaluate(() => session.data.nodes.find(d => d._id == 'A').age)).toBe(30);
});

test('a FASTA cut off mid-sequence loads, and warns that its sequences differ in length', async () => {
  await launch(file('truncated.fasta', 'text/plain', '>A\nACGTACGTAC\n>B\nACGTAC'));
  expect(await ids()).toEqual(['A', 'B']);
  await expect(toast('sequences differ in length (6 to 10)')).toBeVisible();
});

test('a FASTA cut off after a header keeps that record as a node, for the audit to flag', async () => {
  await launch(file('header.fasta', 'text/plain', '>A\nACGTACGTAC\n>B'));
  expect(await ids()).toEqual(['A', 'B']);
});

// When one file's parser throws, the load fails only once the other files have
// finished, so none of them is still adding to the session after the user is told
// the load failed (#240)
test('a file whose parser throws fails the load after the other files have finished', async () => {
  await page.evaluate(() => {
    // Registering the tree as a source happens before its parser first waits
    const add = MTNodeSources.prototype.add;
    MTNodeSources.prototype.add = function (name, ...rest) {
      if (name == 'tree.nwk') throw new Error('a broken tree');
      return add.call(this, name, ...rest);
    };
    self.nodesAtFailure = null;
    MT.events.on('session-load-failed', () => { self.nodesAtFailure = session.data.nodes.length; });
  });
  await add(file('seqs.fasta', 'text/plain', '>A\nACGTACGTAC\n>B\nACGTACGTAG\n'), file('tree.nwk', 'text/plain', '(A:0.1,B:0.2);'));
  await expect(page.locator('#launch')).toBeEnabled();
  await page.click('#launch');
  await expect(toast('The load failed')).toBeVisible({ timeout: 60000 });
  const atFailure = await page.evaluate(() => self.nodesAtFailure);
  await page.waitForTimeout(1000);
  expect(await page.evaluate(() => session.data.nodes.length)).toBe(atFailure);
  // loadFailed logs the error it reports
  errors.splice(0, errors.length, ...errors.filter(e => !e.includes('a broken tree')));
});

// A tree's nodes have the tree file as their source, so a tree and a FASTA with
// the same IDs load together
test('a tree loads with a FASTA of the same IDs', async () => {
  await launch(file('seqs.fasta', 'text/plain', '>A\nACGTACGTAC\n>B\nACGTACGTAG\n'), file('tree.nwk', 'text/plain', '(A:0.1,B:0.2);'));
  expect(await ids()).toEqual(['A', 'B']);
  expect(await page.evaluate(() => session.data.nodes.find(d => d._id == 'A').seq)).toBe('ACGTACGTAC');
});
