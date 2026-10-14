// The Conflicts view: where files disagree about nodes, each file's value and
// the one used; using another file's value for one node, or another file's
// values for a field; the notice after launching; the views following the
// choice; and sessions keeping it.
const path = require('path');
const { test, expect } = require('@playwright/test');
const { watchErrors, open, launchView } = require('./helpers');

test.describe.configure({ mode: 'serial' });

const links = path.join(__dirname, 'fixtures', 'links.csv');
const csv = (name, header, rows) => ({ name, mimeType: 'text/csv', buffer: Buffer.from([header, ...rows].map(r => r.join(',')).join('\n')) });
const ids = n => Array.from({ length: n }, (_, i) => 'S' + i);
const day = i => '2020-01-' + String(i % 28 + 1).padStart(2, '0');
// The case list (on top) and the lab's list, which disagree on S0-S9's state
// and S0-S3's date
const cases = csv('nodes-cases.csv', ['id', 'state', 'date'], ids(50).map((id, i) => [id, 'Texas', day(i)]));
const lab = csv('nodes-lab.csv', ['id', 'state', 'date', 'lab'], ids(100).map((id, i) => [id, i < 10 ? 'Ohio' : 'Texas', i < 4 ? '2020-02-01' : day(i), 'Lab ' + (i % 3)]));

let page, errors;
test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  errors = watchErrors(page);
  await open(page);
  for (const [i, file] of [links, cases, lab].entries()) {
    await page.setInputFiles('#data-files', [file]);
    await expect(page.locator('#file-table .file-table-row')).toHaveCount(i + 1);
  }
  await page.click('#launch');
  await page.waitForFunction(() => session.data.clusters.length > 0 && document.getElementById('numberOfNodes').textContent != '', null, { timeout: 120000 });
});
test.afterAll(() => page.close());

const view = () => page.locator('.lm_content:has(.conflicts-view)');
const row = id => view().locator('.conflicts-grid .tabulator-row', { has: page.locator('.tabulator-cell[tabulator-field="id"]', { hasText: new RegExp('^' + id + '\\b') }) });
const used = id => row(id).locator('.conflict-value.used').textContent().then(t => t.trim());
const state = id => page.evaluate(id => session.data.nodes.find(d => d._id == id).state, id);

test('after launching, a notice says how many values differ, and opens the view', async () => {
  const notice = page.locator('.alertify-notifier .ajs-message', { hasText: 'differ between files' });
  await expect(notice).toContainText('14 node values differ between files');
  await notice.click();
  await expect(view()).toBeVisible();
});

test('the view lists the fields files disagree on, and each file\'s values', async () => {
  expect(await view().locator('.conflicts-field option').allTextContents()).toEqual(['State (10 nodes)', 'Date (4 nodes)']);
  await expect(view().locator('.conflicts-grid .tabulator-row')).toHaveCount(10);
  // In order of their IDs, the top file's value used
  expect(await view().locator('.tabulator-cell[tabulator-field="id"]').allTextContents()).toEqual(ids(10).map(id => id));
  await expect.poll(() => used('S0')).toBe('Texas');
  expect(await view().locator('.tabulator-col-title').allTextContents()).toEqual(['Node', 'nodes-cases.csv', 'nodes-lab.csv']);
  await expect(view().locator('.conflicts-rule')).toHaveValue('');
  expect(await view().locator('.conflicts-rule option').allTextContents()).toEqual(["The top file's (nodes-cases.csv)", "nodes-lab.csv's"]);
});

test('clicking another file\'s value uses it for that node, and the views follow', async () => {
  await page.evaluate(() => MT.settings.set('node-color-variable', 'state'));
  // The color table's count of Ohio, if it has a row for it
  const ohio = () => page.evaluate(() => {
    const row = Array.from(document.querySelectorAll('#node-color-table tr')).find(tr => tr.cells[0] && tr.cells[0].textContent.trim() == 'Ohio');
    return row ? row.cells[1].textContent : null;
  });
  await expect.poll(ohio).toBe(null); // no node uses Ohio yet
  await row('S1').locator('.conflict-value', { hasText: 'Ohio' }).click();
  await expect.poll(() => state('S1')).toBe('Ohio');
  await expect.poll(() => used('S1')).toBe('Ohio');
  await expect(row('S1').locator('.conflict-picked')).toBeVisible();
  expect(await page.evaluate(() => MT.provenance('S1', 'state').map(p => [p.source, p.used]))).toEqual([['nodes-cases.csv', false], ['nodes-lab.csv', true]]);
  // The color table counts it
  await expect.poll(ohio).toBe('1');
});

test('a field can use another file\'s values, and picks can be cleared', async () => {
  await view().locator('.conflicts-rule').selectOption('nodes-lab.csv');
  await expect.poll(() => page.evaluate(() => ['S0', 'S5', 'S9', 'S20'].map(id => session.data.nodes.find(d => d._id == id).state))).toEqual(['Ohio', 'Ohio', 'Ohio', 'Texas']);
  await expect.poll(() => used('S0')).toBe('Ohio');
  // A node's pick wins over the field's choice: pick the top file's for S2
  await row('S2').locator('.conflict-value', { hasText: 'Texas' }).click();
  await expect.poll(() => state('S2')).toBe('Texas');
  // Clearing picks leaves the field's choice
  await view().locator('.conflicts-clear').click();
  await expect.poll(() => state('S2')).toBe('Ohio');
  await expect(view().locator('.conflict-picked')).toHaveCount(0);
  await expect(view().locator('.conflicts-clear')).toBeDisabled();
  // The other field keeps the top file's
  await view().locator('.conflicts-field').selectOption('date');
  await expect(view().locator('.conflicts-grid .tabulator-row')).toHaveCount(4);
  await expect.poll(() => used('S0')).toBe('2020-01-01');
});

test('the table view shows the values chosen', async () => {
  await launchView(page, 'table');
  const table = page.locator('.lm_content:has(.table-grid)');
  await expect(table.locator('.tabulator-row').first()).toBeVisible();
  const shown = () => table.locator('.table-grid').evaluate(el => {
    const t = Tabulator.findTable(el).pop();
    const row = t.getData().find(d => d._id == 'S3');
    return row && row.state;
  });
  // (The table's columns may not show state, but its rows are the nodes)
  await expect.poll(shown).toBe('Ohio');
  await page.evaluate(() => MT.preferSource('state', null));
  await expect.poll(shown).toBe('Texas');
  await page.evaluate(() => MT.preferSource('state', 'nodes-lab.csv'));
});

test('a saved session keeps the choices', async () => {
  await page.evaluate(() => MT.pickSource('S4', 'state', 'nodes-cases.csv'));
  const json = await page.evaluate(() => JSON.stringify(session));
  const saved = JSON.parse(json).data.nodeSources;
  expect(saved.rules).toEqual({ state: 'nodes-lab.csv' });
  expect(saved.picks).toEqual([['S4', 'state', 'nodes-cases.csv']]);
  await page.setInputFiles('#OpenTab', { name: 'choices.microbetrace', mimeType: 'application/json', buffer: Buffer.from(json) });
  await page.waitForFunction(() => session.data.nodes.length > 0 && document.getElementById('numberOfNodes').textContent != '', null, { timeout: 60000 });
  expect(await page.evaluate(() => ['S0', 'S4'].map(id => session.data.nodes.find(d => d._id == id).state))).toEqual(['Ohio', 'Texas']);
  expect(await page.evaluate(() => [session.data.sources.rules.get('state'), session.data.sources.picked('S4', 'state')])).toEqual(['nodes-lab.csv', 'nodes-cases.csv']);
  // The reopened session's view shows them
  await launchView(page, 'conflicts');
  await expect(view().locator('.conflicts-rule')).toHaveValue('nodes-lab.csv');
  await expect(row('S4').locator('.conflict-picked')).toBeVisible();
  // Opening a session doesn't repeat the notice
  expect(errors).toEqual([]);
});

test('without disagreements, or sources, the view says so', async () => {
  await page.evaluate(() => {
    const old = JSON.parse(JSON.stringify(session));
    delete old.data.nodeSources;
    MT.applySession(old);
  });
  await page.waitForFunction(() => session.data.nodes.length > 0 && document.getElementById('numberOfNodes').textContent != '', null, { timeout: 60000 });
  await launchView(page, 'conflicts');
  await expect(view().locator('.view-message')).toContainText("isn't known");
  await expect(view().locator('.conflicts-view')).toBeHidden();
  expect(errors).toEqual([]);
});
