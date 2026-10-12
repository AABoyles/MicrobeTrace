// The Recall dialog: the stashes, newest first, by name and when they were
// stashed; choosing one by clicking anywhere on its row; recalling one by
// double-clicking it; deleting one, and undoing that; a stash that can't be
// read; and nothing stashed.
const path = require('path');
const { test, expect } = require('@playwright/test');
const { watchErrors, open, waitForModal } = require('./helpers');

test.describe.configure({ mode: 'serial' });

const links = path.join(__dirname, 'fixtures', 'links.csv');
let page, errors, nodes;
test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  errors = watchErrors(page);
  await open(page);
  await page.setInputFiles('#data-files', [links]);
  await expect(page.locator('#file-table .file-table-row')).toHaveCount(1);
  await page.click('#launch');
  await page.waitForFunction(() => session.data.clusters.length > 0 && document.getElementById('numberOfNodes').textContent != '', null, { timeout: 120000 });
  nodes = await page.evaluate(() => session.data.nodes.length);
});
test.afterAll(() => page.close());

const dialog = () => page.locator('#session-recall-modal');
const rows = () => dialog().locator('.tabulator-row');
const row = name => rows().filter({ has: page.locator('.tabulator-cell[tabulator-field="name"]', { hasText: name }) });
const names = () => dialog().locator('.tabulator-cell[tabulator-field="name"]').allInnerTexts();
const buttons = () => dialog().locator('#recall-load-stash, #recall-delete-stash');

async function openRecall() {
  await page.locator('nav .dropdown-toggle', { hasText: 'File' }).click();
  await page.click('#RecallDataTab');
  await waitForModal(page, '#session-recall-modal');
}
async function closeRecall() {
  await dialog().locator('.btn-close').click();
  await expect(dialog()).toBeHidden();
}
// Stashes of this session as stashing keeps them ([name, hours ago, contents])
const stash = entries => page.evaluate(entries => Promise.all(entries.map(([name, hoursAgo, json]) =>
  localforage.setItem('stash-' + Math.round(Date.now() - hoursAgo * 3600000) + '-' + name, json || JSON.stringify(session)))), entries);
const stashKeys = () => page.evaluate(() => localforage.keys().then(keys => keys.filter(k => /^stash-\d/.test(k))));

test('the stashes are listed newest first, by name and when they were stashed', async () => {
  // (The autostash setting is kept alongside them)
  await page.evaluate(() => localforage.setItem('stash-auto', '0'));
  await stash([['Outbreak A, first look', 72], ['', 1], ['cluster <b>7</b>', 0]]);
  await openRecall();
  expect(await names()).toEqual(['cluster <b>7</b>', 'Untitled', 'Outbreak A, first look']);
  // When, as this browser writes dates and times
  const expected = await page.evaluate(() => localforage.keys().then(keys => keys.filter(k => /^stash-\d/.test(k))
    .map(k => +k.split('-')[1]).sort((a, b) => b - a)
    .map(t => new Date(t).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }))));
  expect(await dialog().locator('.tabulator-cell[tabulator-field="time"]').allInnerTexts()).toEqual(expected);
  // Nothing is chosen yet
  for (const button of await buttons().all()) await expect(button).toBeDisabled();
  expect(errors).toEqual([]);
});

test('a stash is chosen by clicking anywhere on its row', async () => {
  // Its middle
  await rows().nth(2).click();
  await expect(rows().nth(2)).toHaveClass(/tabulator-selected/);
  for (const button of await buttons().all()) await expect(button).toBeEnabled();
  // Where its columns meet
  const cell = await rows().nth(1).locator('.tabulator-cell[tabulator-field="time"]').boundingBox();
  await page.mouse.click(cell.x - 1, cell.y + cell.height / 2);
  await expect(rows().nth(1)).toHaveClass(/tabulator-selected/);
  await expect(rows().nth(2)).not.toHaveClass(/tabulator-selected/);
});

test('deleting a stash can be undone', async () => {
  const before = await stashKeys();
  await row('Outbreak A').click();
  await dialog().locator('#recall-delete-stash').click();
  await expect(rows()).toHaveCount(2);
  expect(await names()).not.toContain('Outbreak A, first look');
  expect((await stashKeys()).length).toBe(2);
  for (const button of await buttons().all()) await expect(button).toBeDisabled();
  const notice = page.locator('.alertify-notifier .ajs-message', { hasText: 'Deleted' });
  await expect(notice).toHaveText('Deleted “Outbreak A, first look”. Click here to undo.');
  await notice.click();
  await expect(rows()).toHaveCount(3);
  expect((await stashKeys()).sort()).toEqual(before.sort());
});

test('double-clicking a stash recalls it', async () => {
  await closeRecall();
  await page.locator('nav .dropdown-toggle', { hasText: 'File' }).click();
  await page.click('#NewTab');
  await waitForModal(page, '#exit-modal');
  await page.click('#exit-button');
  await page.waitForFunction(() => session.data.nodes.length == 0);
  await openRecall();
  // The one restored, too
  await row('Outbreak A').dblclick();
  await page.waitForFunction(n => session.data.nodes.length == n && document.getElementById('numberOfNodes').textContent == '' + n, nodes, { timeout: 60000 });
  await expect(dialog()).toBeHidden();
  expect(errors).toEqual([]);
});

test("a stash that can't be read says so", async () => {
  await stash([['broken', 2, '{not a session']]);
  await openRecall();
  await row('broken').click();
  await dialog().locator('#recall-load-stash').click();
  await expect(page.locator('.alertify-notifier .ajs-message', { hasText: 'broken' })).toHaveText('“broken” couldn\'t be recalled.');
  await expect(dialog()).toBeVisible();
  // (It's logged, for whoever looks)
  expect(errors).toEqual([expect.stringMatching(/JSON/)]);
  errors.length = 0;
});

test('with nothing stashed, the dialog says so', async () => {
  await closeRecall();
  await page.evaluate(async () => {
    for (const k of await localforage.keys()) if (/^stash-\d/.test(k)) await localforage.removeItem(k);
  });
  await openRecall();
  await expect(rows()).toHaveCount(0);
  await expect(dialog().locator('.tabulator-placeholder')).toHaveText('Nothing is stashed in this browser yet. Stash a session from the File menu.');
  for (const button of await buttons().all()) await expect(button).toBeDisabled();
  await closeRecall();
  expect(errors).toEqual([]);
});
