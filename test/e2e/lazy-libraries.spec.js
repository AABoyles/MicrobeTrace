// The large libraries load when first needed, not with the page (#324): a fresh
// page requests only the primary bundle, and each view or action fetches its own.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { watchErrors, open, loadNetwork, launchView } = require('./helpers');

const root = path.join(__dirname, '..', '..');
const bundles = page => {
  const requested = [];
  page.on('request', request => {
    const match = /\/dist\/bundle\.([a-z]+)\.js$/.exec(new URL(request.url()).pathname);
    if (match) requested.push(match[1]);
  });
  return requested;
};

test('a fresh page loads only the primary bundle, within a byte budget', async ({ page }) => {
  const errors = watchErrors(page);
  const sizes = {};
  page.on('response', async response => {
    const { pathname } = new URL(response.url());
    if (/\.(js|css)$/.test(pathname)) sizes[pathname] = (await response.body()).length;
  });
  const requested = bundles(page);
  await open(page);
  await page.waitForLoadState('networkidle');
  expect(requested).toEqual(['primary']);
  const total = Object.values(sizes).reduce((a, b) => a + b, 0);
  console.log('Startup JS and CSS bytes:', total);
  // About 1.6 MB today (it was 4.9 MB before the libraries were split out)
  expect(total).toBeLessThan(2.2 * 1024 * 1024);
  for (const global of ['XLSX', 'JSZip', 'Tabulator', 'Plotly', 'L', 'TidyTree', 'alignmentViewer', 'pdfMake']) {
    expect(await page.evaluate(name => typeof self[name], global), global).toBe('undefined');
  }
  expect(errors).toEqual([]);
});

test('each view fetches the libraries it draws with, once', async ({ page }) => {
  const errors = watchErrors(page);
  const requested = bundles(page);
  await loadNetwork(page);
  expect(requested).toEqual(['primary']);
  const typeOf = name => page.evaluate(name => typeof self[name], name);
  for (const [view, bundle, global] of [['histogram', 'plotly', 'Plotly'], ['table', 'table', 'Tabulator'], ['geo_map', 'map', 'L'], ['phylogenetic_tree', 'tree', 'TidyTree']]) {
    await launchView(page, view);
    await expect.poll(() => typeOf(global), { message: view }).not.toBe('undefined');
    expect(requested.filter(name => name == bundle), bundle).toHaveLength(1);
  }
  // Another chart view reuses Plotly
  await launchView(page, 'scatterplot');
  expect(requested.filter(name => name == 'plotly')).toHaveLength(1);
  expect(requested).not.toContain('xlsx');
  expect(errors).toEqual([]);
});

test('adding an Excel file fetches the spreadsheet bundle', async ({ page }) => {
  const errors = watchErrors(page);
  const requested = bundles(page);
  await open(page);
  const sheet = XLSX.utils.aoa_to_sheet([['source', 'target'], ['a', 'b']]);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'links');
  expect(requested).not.toContain('xlsx');
  await page.setInputFiles('#data-files', [{ name: 'links.xlsx', mimeType: 'application/octet-stream', buffer: Buffer.from(XLSX.write(book, { type: 'buffer', bookType: 'xlsx' })) }]);
  await expect(page.locator('#file-table .file-table-row')).toHaveCount(1);
  expect(requested.filter(name => name == 'xlsx')).toHaveLength(1);
  expect(errors).toEqual([]);
});

test('every library MT.loadLibrary names has a bundle entry', () => {
  const source = fs.readFileSync(path.join(root, 'src', 'export.js'), 'utf8');
  const names = Object.keys(JSON.parse(/const LIBRARY_GLOBALS = (\{[^}]*\})/.exec(source)[1].replace(/(\w+):/g, '"$1":').replace(/'/g, '"')));
  expect(names.length).toBeGreaterThan(5);
  for (const name of names) expect(fs.existsSync(path.join(root, 'scripts', 'entries', name + '.js')), name).toBe(true);
});
