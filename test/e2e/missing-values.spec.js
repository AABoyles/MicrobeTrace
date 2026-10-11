// Nodes missing values: a missing date is filled with the earliest date, but a
// missing number (such as a latitude, or a count) stays missing, from CSV and
// from spreadsheets (whose cells are text, and the browser reads text such as
// "12" as a date).
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { test, expect } = require('@playwright/test');
const { watchErrors, open } = require('./helpers');

const links = path.join(__dirname, 'fixtures', 'links.csv');
// The fixture's nodes with a count from 1 to 12, and with S0-S9's coordinates
// and counts and S10-S14's dates removed
const rows = fs.readFileSync(path.join(__dirname, 'fixtures', 'nodes.csv'), 'utf8').trim().split('\n').map(line => line.split(','));
const [header, ...nodes] = rows;
const edited = nodes.map(([id, date, lat, lon, state, group], i) => [
  id, i >= 10 && i < 15 ? '' : date, i < 10 ? '' : lat, i < 10 ? '' : lon, state, group, i < 10 ? '' : '' + (i % 12 + 1)
]);
const columns = header.concat('count');
const csv = [columns, ...edited].map(row => row.join(',')).join('\n');
const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([columns, ...edited.map(row => row.map(v => v === '' ? null : v))]), 'nodes');
const xlsx = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

async function load(page, nodeFile) {
  await open(page);
  await page.setInputFiles('#data-files', [links]);
  await page.setInputFiles('#data-files', [nodeFile]);
  await page.waitForFunction(() => document.querySelectorAll('#file-table .file-table-row').length >= 2);
  await page.click('#launch');
  await page.waitForFunction(() => session.data.clusters.length > 0 && document.getElementById('numberOfNodes').textContent != '', null, { timeout: 120000 });
}

// The nodes' values for the edited rows
const read = page => page.evaluate(() => {
  const byId = id => session.data.nodes.find(d => d.id == id);
  const dates = session.data.nodes.map(d => MT.parseDate(d.date)).filter(Boolean).map(d => d.getTime());
  return {
    lats: ['S0', 'S5', 'S9'].map(id => byId(id).lat),
    counts: ['S0', 'S5', 'S9'].map(id => byId(id).count),
    lat: byId('S20').lat,
    count: byId('S20').count,
    filled: ['S10', 'S14'].map(id => MT.parseDate(byId(id).date) && MT.parseDate(byId(id).date).getTime()),
    earliest: Math.min(...dates),
    invalid: session.data.nodes.filter(d => Object.values(d).some(v => v === 'Invalid Date')).length
  };
});

for (const [kind, file] of [
  ['CSV', { name: 'nodes.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) }],
  ['a spreadsheet', { name: 'nodes.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: xlsx }]
]) {
  test(`from ${kind}, missing dates are filled but missing numbers aren't`, async ({ page }) => {
    const errors = watchErrors(page);
    await load(page, file);
    const values = await read(page);
    // No date strings in place of missing latitudes and counts
    expect(values.lats).toEqual([null, null, null]);
    expect(values.counts).toEqual([null, null, null]);
    expect(+values.lat).toBe(+nodes[20][2]); // S20's, kept
    expect(+values.count).toBe(20 % 12 + 1);
    // Missing dates are the earliest date
    expect(values.filled).toEqual([values.earliest, values.earliest]);
    expect(values.invalid).toBe(0);
    expect(errors).toEqual([]);
  });
}

test('latitudes are numbers, and so not dates; text dates are', async ({ page }) => {
  await open(page);
  expect(await page.evaluate(() => [30.5, '30.5', '12', '2020', '2020-01-04', 'Jan 4 2020', new Date(2020, 0, 4), 'Georgia', ''].map(v => MT.isDate(v))))
    .toEqual([false, false, false, false, true, true, true, false, false]);
});
