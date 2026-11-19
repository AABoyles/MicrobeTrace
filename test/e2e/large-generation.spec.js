// Large inputs that used to fail before distances were computed: generated
// sequences too many for one file (#301), and length checks over hundreds of
// thousands of sequences (#302). The sizes themselves take minutes, so these
// shrink the limit, or call the check directly.
const { test, expect } = require('@playwright/test');
const { watchErrors, open } = require('./helpers');

let page, errors;
test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  errors = watchErrors(page);
  await open(page);
});
test.afterAll(() => page.close());

test('the length check copes with hundreds of thousands of sequences (#302)', async () => {
  const warnings = await page.evaluate(() => {
    const lengths = new Array(300000).fill(1617);
    lengths[123456] = 1500;
    return MT.lengthWarnings(null, lengths);
  });
  expect(warnings).toHaveLength(1);
  expect(warnings[0]).toContain('1,500 to 1,617');
});

test('generated sequences too many for one file go in several, and all load (#301)', async () => {
  // Five sequences a file, as hundreds of thousands are at the real limit
  await page.evaluate(() => { MT.generatedFileChars = 5 * (session.data.reference.length + 50); });
  await page.evaluate(() => { document.querySelector('.generate-number').value = 23; document.querySelector('.generate-sequences').click(); });
  const rows = page.locator('#file-table .file-table-row');
  await expect(rows).toHaveCount(5);
  expect(await page.evaluate(() => session.files.map(f => f.name).sort()))
    .toEqual([1, 2, 3, 4, 5].map(i => `generatedNodes-${i}.csv`));
  await page.click('#launch');
  await page.waitForFunction(() => session.data.nodes.length > 0 && document.getElementById('numberOfNodes').textContent != '', null, { timeout: 60000 });
  expect(await page.evaluate(() => session.data.nodes.length)).toBe(23);
  expect(await page.evaluate(() => session.data.nodes.every(d => d.seq))).toBe(true);
  expect(errors).toEqual([]);
});
