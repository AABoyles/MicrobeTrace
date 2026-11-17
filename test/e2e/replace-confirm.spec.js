// Replacing the session (File > Open, Recall, dropping a session file) asks
// first when data is loaded, and not when nothing is: Cancel (or Escape) keeps
// the session, Replace replaces it, Stash Current First keeps a copy too.
const path = require('path');
const { test, expect } = require('@playwright/test');
const { watchErrors, open, waitForModal } = require('./helpers');

test.describe.configure({ mode: 'serial' });

const links = path.join(__dirname, 'fixtures', 'links.csv');
let page, errors, nodes, saved;
test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  errors = watchErrors(page);
  await open(page);
  await page.setInputFiles('#data-files', [links]);
  await expect(page.locator('#file-table .file-table-row')).toHaveCount(1);
  await page.click('#launch');
  await page.waitForFunction(() => session.data.clusters.length > 0 && document.getElementById('numberOfNodes').textContent != '', null, { timeout: 120000 });
  nodes = await page.evaluate(() => session.data.nodes.length);
  saved = await page.evaluate(() => { MT.syncLayout(); return JSON.stringify(session); });
});
test.afterAll(() => page.close());

const dialog = () => page.locator('#replace-modal');
const startTime = () => page.evaluate(() => session.meta.startTime);
// Marks the live session, so that replacing it can be told from keeping it
const mark = () => page.evaluate(() => { session.meta.startTime = 1; });
const replaced = () => page.waitForFunction(() => session.meta.startTime != 1 && session.data.nodes.length > 0 && document.getElementById('numberOfNodes').textContent != '', null, { timeout: 60000 });
const file = { name: 'again.microbetrace', mimeType: 'application/json', get buffer() { return Buffer.from(saved); } };
const stashes = () => page.evaluate(() => db.keys().then(keys => keys.filter(k => /^stash-\d/.test(k) && k.includes('Before replacing'))));

const chooseOpen = () => page.setInputFiles('#OpenTab', file);
async function chooseRecall() {
  await page.evaluate(() => db.keys().then(keys => keys.some(k => k.endsWith('-replace-test')) ||
    db.setItem('stash-' + Date.now() + '-replace-test', JSON.stringify(session))));
  // (Cancelling the question brings the Recall dialog back: it may be open already)
  if (!(await page.locator('#session-recall-modal.show').count())) {
    await page.locator('nav .dropdown-toggle', { hasText: 'File' }).click();
    await page.click('#RecallDataTab');
  }
  await waitForModal(page, '#session-recall-modal');
  await page.locator('#recall-stashes-available .tabulator-row', { hasText: 'replace-test' }).dblclick();
}
const drop = () => page.evaluate(async json => {
  if (!document.querySelector('.file-panel')) MT.launchView('files');
  const panel = await new Promise(resolve => { const t = setInterval(() => { const p = document.querySelector('.file-panel'); if (p) { clearInterval(t); resolve(p); } }, 50); });
  const data = new DataTransfer();
  data.items.add(new File([json], 'dropped.microbetrace', { type: 'application/json' }));
  panel.dispatchEvent(new DragEvent('drop', { dataTransfer: data, bubbles: true, cancelable: true }));
}, saved);

const flows = { Open: chooseOpen, Recall: chooseRecall, 'dropping a file': drop };

for (const [name, choose] of Object.entries(flows)) {
  test(`${name} asks before replacing a session with data, and Cancel keeps it`, async () => {
    await mark();
    await choose();
    await waitForModal(page, '#replace-modal');
    await expect(dialog()).toHaveAttribute('aria-labelledby', 'replaceModalLabel');
    await expect(dialog().locator('.modal-title')).toHaveText('Replace the current session?');
    await expect(dialog().locator('.modal-body')).toContainText('Unsaved changes will be lost.');
    await dialog().getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog()).toBeHidden();
    await page.waitForTimeout(500);
    expect(await startTime()).toBe(1);
    expect(await page.evaluate(() => session.data.nodes.length)).toBe(nodes);
  });

  test(`${name}: Escape cancels, and Replace replaces`, async () => {
    await mark();
    await choose();
    await waitForModal(page, '#replace-modal');
    // Focus is in the dialog, and Escape closes it
    expect(await page.evaluate(() => document.getElementById('replace-modal').contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(dialog()).toBeHidden();
    await page.waitForTimeout(500);
    expect(await startTime()).toBe(1);
    await choose();
    await waitForModal(page, '#replace-modal');
    await dialog().locator('#replace-button').click();
    await replaced();
    expect(await page.evaluate(() => session.data.nodes.length)).toBe(nodes);
    expect(errors).toEqual([]);
  });
}

test('Cancel in Recall brings the Recall dialog back', async () => {
  await mark();
  await page.locator('#recall-stashes-available').waitFor({ state: 'attached' });
  await page.locator('nav .dropdown-toggle', { hasText: 'File' }).click();
  await page.click('#RecallDataTab');
  await waitForModal(page, '#session-recall-modal');
  await page.locator('#recall-stashes-available .tabulator-row', { hasText: 'replace-test' }).first().dblclick();
  await waitForModal(page, '#replace-modal');
  await dialog().getByRole('button', { name: 'Cancel' }).click();
  await waitForModal(page, '#session-recall-modal');
  await page.locator('#session-recall-modal .btn-close').click();
  await expect(page.locator('#session-recall-modal')).toBeHidden();
  expect(await startTime()).toBe(1);
});

test('Stash Current First keeps a copy of the session, then replaces it', async () => {
  await mark();
  await chooseOpen();
  await waitForModal(page, '#replace-modal');
  await dialog().locator('#replace-stash-first').click();
  await replaced();
  expect((await stashes()).length).toBe(1);
});

test('with nothing loaded, there is nothing to lose, so there is no question', async ({ browser }) => {
  const fresh = await browser.newPage();
  const freshErrors = watchErrors(fresh);
  await open(fresh);
  await fresh.setInputFiles('#OpenTab', file);
  await fresh.waitForFunction(n => session.data.nodes.length == n && document.getElementById('numberOfNodes').textContent == '' + n, nodes, { timeout: 60000 });
  await expect(fresh.locator('#replace-modal')).toBeHidden();
  expect(freshErrors).toEqual([]);
  await fresh.close();
});
