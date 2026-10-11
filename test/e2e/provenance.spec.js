// Where node values come from: two files that disagree about nodes, the top
// file's values winning (and another's filling its gaps), each value traced
// to its files, reordering files to change which wins, a node listed twice in
// one file, and merging many nodes quickly.
const path = require('path');
const { test, expect } = require('@playwright/test');
const { watchErrors, open, waitForModal } = require('./helpers');

const links = path.join(__dirname, 'fixtures', 'links.csv');
const csv = (name, header, rows) => ({ name, mimeType: 'text/csv', buffer: Buffer.from([header, ...rows].map(r => r.join(',')).join('\n')) });
const ids = n => Array.from({ length: n }, (_, i) => 'S' + i);
// The case list: S0-S49, S10-S14 without dates
const cases = csv('nodes-cases.csv', ['id', 'state', 'date'],
  ids(50).map((id, i) => [id, 'Texas', i >= 10 && i < 15 ? '' : '2020-01-' + String(i % 28 + 1).padStart(2, '0')]));
// The lab's list: S0-S99, disagreeing on S0-S9's state, with a field of its own
const lab = csv('nodes-lab.csv', ['id', 'state', 'date', 'lab'],
  ids(100).map((id, i) => [id, i < 10 ? 'Ohio' : 'Texas', '2020-01-' + String(i % 28 + 1).padStart(2, '0'), 'Lab ' + (i % 3)]));

// Opens MicrobeTrace and adds files one at a time, in order
async function add(page, files) {
  await open(page);
  for (const [i, file] of files.entries()) {
    await page.setInputFiles('#data-files', [file]);
    await expect(page.locator('#file-table .file-table-row')).toHaveCount(i + 1);
  }
}
async function launch(page) {
  await page.click('#launch');
  await page.waitForFunction(() => session.data.clusters.length > 0 && document.getElementById('numberOfNodes').textContent != '', null, { timeout: 120000 });
}
const node = (page, id) => page.evaluate(id => { const d = session.data.nodes.find(d => d._id == id); return { state: d.state, date: d.date, lab: d.lab }; }, id);

test('the top file wins where files disagree, and other files fill its gaps', async ({ page }) => {
  const errors = watchErrors(page);
  await add(page, [links, cases, lab]);
  await expect(page.locator('.file-order-hint')).toBeVisible();
  await launch(page);
  expect(await node(page, 'S0')).toEqual({ state: 'Texas', date: '2020-01-01', lab: 'Lab 0' });
  // An empty date in the top file is filled from the file below
  expect((await node(page, 'S10')).date).toBe('2020-01-11');
  // A node only the lower file has takes its values
  expect((await node(page, 'S60')).state).toBe('Texas');
  // Each value traced to its files, the one used marked
  expect(await page.evaluate(() => MT.provenance('S0', 'state'))).toEqual([
    { source: 'nodes-cases.csv', row: 0, value: 'Texas', used: true },
    { source: 'nodes-lab.csv', row: 0, value: 'Ohio', used: false }
  ]);
  expect(await page.evaluate(() => MT.provenance('S10', 'date').map(p => [p.source, p.used]))).toEqual([['nodes-lab.csv', true]]);
  // Where they disagree: the ten states
  expect(await page.evaluate(() => Object.fromEntries(Array.from(MT.nodeConflicts(), ([field, keys]) => [field, keys.length])))).toEqual({ state: 10 });
  await expect(page.locator('#loading-information')).toContainText("10 node values differ between files; the top file's are used.");
  expect(errors).toEqual([]);
});

test('dragging a file to the top makes its values win', async ({ page }) => {
  await add(page, [links, cases, lab]);
  const row = name => page.locator('#file-table .file-table-row', { hasText: name });
  await row('nodes-lab.csv').locator('.file-grip').dragTo(row('nodes-cases.csv'), { targetPosition: { x: 20, y: 5 } });
  await expect.poll(() => page.evaluate(() => session.files.map(f => f.name))).toEqual(['links.csv', 'nodes-lab.csv', 'nodes-cases.csv']);
  expect(await page.locator('#file-table .file-table-row .file-title').allTextContents()).toEqual(['links.csv', 'nodes-lab.csv', 'nodes-cases.csv']);
  await launch(page);
  expect((await node(page, 'S0')).state).toBe('Ohio');
  expect(await page.evaluate(() => MT.provenance('S0', 'state').map(p => [p.source, p.used]))).toEqual([['nodes-lab.csv', true], ['nodes-cases.csv', false]]);
});

test('a node listed twice in one file is one node: its first row, filled in by the second', async ({ page }) => {
  const twice = csv('nodes-twice.csv', ['id', 'state', 'date'], [['S0', 'Texas', ''], ['S1', 'Utah', '2020-01-02'], ['S0', 'Ohio', '2020-01-03']]);
  await add(page, [links, twice]);
  await launch(page);
  expect(await page.evaluate(() => session.data.nodes.filter(d => d._id == 'S0').length)).toBe(1);
  expect(await node(page, 'S0')).toMatchObject({ state: 'Texas', date: '2020-01-03' });
});

test('merging many nodes is quick', async ({ page }) => {
  await open(page);
  // 30,000 nodes from one file, then again from another
  const ms = await page.evaluate(() => {
    const a = session.data.sources.add('a.csv', 0), b = session.data.sources.add('b.csv', 1);
    const start = performance.now();
    for (let i = 0; i < 30000; i++) MT.addNode({ _id: 'N' + i, state: 'Texas', origin: ['a.csv'] }, true, a);
    for (let i = 0; i < 30000; i++) MT.addNode({ _id: 'N' + i, state: 'Ohio', group: 'g' + (i % 4), origin: ['b.csv'] }, true, b);
    return performance.now() - start;
  });
  expect(await page.evaluate(() => [session.data.nodes.length, session.data.nodes[5].state, session.data.nodes[5].group])).toEqual([30000, 'Texas', 'g1']);
  expect(ms).toBeLessThan(1500);
});

test('nodes added without a source (sessions, imports) merge by ID, later values winning', async ({ page }) => {
  await open(page);
  const merged = await page.evaluate(() => {
    MT.addNode({ _id: 'X1', state: 'Texas', origin: 'HIVTRACE Import' }, false);
    MT.addNode({ _id: 'X1', state: 'Ohio', origin: ['Other'] }, false);
    const nodes = session.data.nodes.filter(d => d._id == 'X1');
    return { count: nodes.length, state: nodes[0].state, origin: nodes[0].origin, provenance: MT.provenance('X1', 'state') };
  });
  expect(merged).toEqual({ count: 1, state: 'Ohio', origin: ['Other', 'HIVTRACE Import'], provenance: [] });
});

// What the session knows about where values came from
const traced = page => page.evaluate(() => ({
  state: MT.provenance('S0', 'state'),
  date: MT.provenance('S10', 'date'),
  lab: MT.provenance('S60', 'lab'),
  conflicts: Object.fromEntries(Array.from(MT.nodeConflicts(), ([field, keys]) => [field, keys.slice().sort()]))
}));

test('a saved session keeps where its values came from', async ({ page }) => {
  const errors = watchErrors(page);
  await add(page, [links, cases, lab]);
  await launch(page);
  const before = await traced(page);
  expect(before.state.map(p => p.source)).toEqual(['nodes-cases.csv', 'nodes-lab.csv']);
  // Saved from the Save dialog, uncompressed, and opened again
  await page.keyboard.press('Control+s');
  const modal = page.locator('#session-save-modal');
  await expect(modal).toBeVisible();
  await modal.locator('#save-file-compress').uncheck();
  const [download] = await Promise.all([page.waitForEvent('download'), modal.locator('#save-data').click()]);
  const file = await download.path();
  const saved = JSON.parse(require('fs').readFileSync(file, 'utf8'));
  expect(saved.data.nodeSources.sources.map(s => s.name)).toEqual(['links.csv', 'nodes-cases.csv', 'nodes-lab.csv']);
  await page.setInputFiles('#OpenTab', { name: 'reopened.microbetrace', mimeType: 'application/json', buffer: require('fs').readFileSync(file) });
  await page.waitForFunction(() => session.data.nodes.length > 0 && document.getElementById('numberOfNodes').textContent != '', null, { timeout: 60000 });
  expect(await traced(page)).toEqual(before);
  expect((await node(page, 'S0')).state).toBe('Texas');
  expect(errors).toEqual([]);
});

test('a stashed session does too', async ({ page }) => {
  await add(page, [links, cases, lab]);
  await launch(page);
  const before = await traced(page);
  await page.locator('nav .dropdown-toggle', { hasText: 'File' }).click();
  await page.click('#StashDataTab');
  await waitForModal(page, '#session-stash-modal');
  await page.fill('#stash-name', 'provenance');
  await page.click('#stash-data');
  await expect(page.locator('.alertify-notifier')).toContainText('Stashed');
  await expect(page.locator('#session-stash-modal')).toBeHidden();
  await page.evaluate(() => MT.reset());
  expect(await page.evaluate(() => MT.provenance('S0', 'state'))).toEqual([]);
  await page.locator('nav .dropdown-toggle', { hasText: 'File' }).click();
  await page.click('#RecallDataTab');
  await waitForModal(page, '#session-recall-modal');
  const stash = page.locator('#recall-stashes-available .tabulator-row', { hasText: 'provenance' });
  await expect(stash).toHaveCount(1);
  // (Its name: the middle of the row is the columns' resize handle)
  await stash.locator('.tabulator-cell').first().click();
  await expect(stash).toHaveClass(/tabulator-selected/);
  await page.click('#recall-load-stash');
  await page.waitForFunction(() => session.data.nodes.length > 0 && document.getElementById('numberOfNodes').textContent != '', null, { timeout: 60000 });
  expect(await traced(page)).toEqual(before);
});

test('a session saved before sources were, opens with none', async ({ page }) => {
  const errors = watchErrors(page);
  await add(page, [links, cases, lab]);
  await launch(page);
  const json = await page.evaluate(() => {
    const old = JSON.parse(JSON.stringify(session));
    delete old.data.nodeSources;
    return JSON.stringify(old);
  });
  await page.setInputFiles('#OpenTab', { name: 'old.microbetrace', mimeType: 'application/json', buffer: Buffer.from(json) });
  await page.waitForFunction(() => session.data.nodes.length > 0 && document.getElementById('numberOfNodes').textContent != '', null, { timeout: 60000 });
  expect((await node(page, 'S0')).state).toBe('Texas');
  expect(await traced(page)).toEqual({ state: [], date: [], lab: [], conflicts: {} });
  expect(errors).toEqual([]);
});

test('saving sources adds little to a session', async ({ page }) => {
  await add(page, [links, cases, lab]);
  await launch(page);
  const sizes = await page.evaluate(() => ({ session: JSON.stringify(session).length, sources: JSON.stringify(session.data.nodeSources).length }));
  // Values the nodes have are saved as 1
  expect(sizes.sources / sizes.session).toBeLessThan(0.05);
});

// The node fields that would be listed as "ID" in menus
const idFields = page => page.evaluate(() => session.data.nodeFields.filter(f => MT.titleize(f) == 'ID'));

test('the column chosen as the ID is the ID, listed once', async ({ page }) => {
  const errors = watchErrors(page);
  await add(page, [links, cases]);
  await launch(page);
  expect(await idFields(page)).toEqual(['_id']);
  expect(await page.locator('#search-field option', { hasText: /^ID$/ }).count()).toBe(1);
  expect(await page.evaluate(() => session.data.nodes.find(d => d._id == 'S0').id)).toBeUndefined();
  expect(errors).toEqual([]);
});

test('so are columns chosen as the ID and sequence under other names', async ({ page }) => {
  const seqs = csv('nodes-samples.csv', ['SampleID', 'SEQUENCE', 'state'],
    ids(20).map((id, i) => [id, 'ACGT'.repeat(10) + 'ACGT'.slice(0, i % 4), 'Texas']));
  await add(page, [links, seqs]);
  // The Files view chose them
  const fields = page.locator('#file-table .file-table-row', { hasText: 'nodes-samples.csv' }).locator('select');
  await expect(fields.nth(0)).toHaveValue('SampleID');
  await expect(fields.nth(1)).toHaveValue('SEQUENCE');
  await launch(page);
  const fieldsAfter = await page.evaluate(() => session.data.nodeFields);
  expect(fieldsAfter).not.toContain('SampleID');
  expect(fieldsAfter).not.toContain('SEQUENCE');
  expect(fieldsAfter).toContain('state');
  expect(await page.evaluate(() => { const d = session.data.nodes.find(d => d._id == 'S1'); return [d.seq.replace(/-/g, '').length, d.SEQUENCE]; })).toEqual([41, undefined]);
});

test('a session that lists the ID column as a field too opens listing it once', async ({ page }) => {
  await add(page, [links, cases]);
  await launch(page);
  // As sessions were saved before: the ID column copied onto the nodes and listed
  const json = await page.evaluate(() => {
    const old = JSON.parse(JSON.stringify(session));
    old.data.nodes.forEach(d => { d.id = d._id; });
    old.data.nodeFields.push('id');
    return JSON.stringify(old);
  });
  await page.setInputFiles('#OpenTab', { name: 'old.microbetrace', mimeType: 'application/json', buffer: Buffer.from(json) });
  await page.waitForFunction(() => session.data.nodes.length > 0 && document.getElementById('numberOfNodes').textContent != '', null, { timeout: 60000 });
  expect(await idFields(page)).toEqual(['_id']);
});
