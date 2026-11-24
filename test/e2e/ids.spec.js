// Node IDs are read as they are written, trimmed, the same from every file,
// and what the files merge or drop is reported (#219).
const { test, expect } = require('@playwright/test');
const { watchErrors, open } = require('./helpers');

test.describe.configure({ mode: 'serial' });

let page, errors;
test.beforeEach(async ({ browser }) => {
  page = await browser.newPage();
  errors = watchErrors(page);
  await open(page);
});
test.afterEach(async () => { expect(errors).toEqual([]); await page.close(); });

const csv = (name, text) => ({ name, mimeType: 'text/csv', buffer: Buffer.from(text) });
async function launch(...files) {
  await page.setInputFiles('#data-files', files);
  await expect(page.locator('#file-table .file-table-row')).toHaveCount(files.length);
  await page.click('#launch');
  await page.waitForFunction(() => session.data.nodes.length > 0, null, { timeout: 60000 });
  await page.waitForFunction(() => !document.querySelector('#loading-information-modal.show'), null, { timeout: 60000 });
}
const ids = () => page.evaluate(() => session.data.nodes.map(d => d._id).sort());

test('IDs keep their leading zeros and exponents, and are trimmed, so a sequence joins its node row', async () => {
  const fasta = { name: 'seqs.fasta', mimeType: 'text/plain', buffer: Buffer.from('>007\nACGTACGTAC\n>1E3 \nACGTACGTAG\n>A\nACGTACGTAA\n') };
  await launch(fasta, csv('nodes.csv', 'id,age\n007,30\n 1E3,40\nA ,50\n'));
  expect(await ids()).toEqual(['007', '1E3', 'A']);
  // Other columns are still numbers
  expect(await page.evaluate(() => session.data.nodes.find(d => d._id === '007').age)).toBe(30);
  expect(await page.evaluate(() => session.data.nodes.find(d => d._id === 'A').seq)).toBe('ACGTACGTAA');
});

test('a link list names its nodes as written, and a blank ID is not a node called null', async () => {
  await launch(csv('links.csv', 'source,target,distance\n007, 008 ,0.01\n007,,0.02\n'));
  expect(await ids()).toEqual(['007', '008']);
  const link = await page.evaluate(() => MT.getLink('007', '008'));
  expect(link).toBeTruthy();
  await expect(page.locator('.toast').filter({ hasText: 'blank ID' })).toBeVisible();
});

test('repeated IDs, self-links, repeated pairs and unmatched endpoints are reported', async () => {
  await launch(
    csv('nodes.csv', 'id\nA\nB\nB\nC\n'),
    csv('links.csv', 'source,target,distance\nA,A,0.1\nA,B,0.1\nB,A,0.2\nA,D,0.3\n')
  );
  const toast = page.locator('.toast').filter({ hasText: 'repeated ID' });
  await expect(toast).toBeVisible();
  await expect(toast).toContainText('1 repeated ID was merged');
  await expect(toast).toContainText('1 link from a node to itself was dropped');
  await expect(toast).toContainText('1 link repeated a pair of nodes already linked');
  await expect(toast).toContainText('1 node in the links is not in the node or sequence files');
  expect(await ids()).toEqual(['A', 'B', 'C', 'D']);
});

test('IDs match case-sensitively', async () => {
  await launch(csv('nodes.csv', 'id\na\nA\n'));
  expect(await ids()).toEqual(['A', 'a']);
});

test('HIV-TRACE and session IDs are trimmed the same way', async () => {
  const trace = { trace_results: { Nodes: [{ _id: ' P1 ', patient_attributes: { x: 1 } }, { _id: 'P2', patient_attributes: { x: 2 } }], Edges: [{ sequences: ['P1', ' P2'], length: '0.01' }] } };
  await page.setInputFiles('#data-files', { name: 't.hivtrace', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(trace)) });
  await page.waitForFunction(() => session.data.nodes.length > 0);
  expect(await ids()).toEqual(['P1', 'P2']);
});
