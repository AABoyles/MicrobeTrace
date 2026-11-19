// Session recovery (#225, #278): the setting is in the Files tab, not Experimental;
// an autostash copy found at startup is offered back, by keyboard too, and can be
// restored or discarded; a failed write is reported.
const path = require('path');
const { test, expect } = require('@playwright/test');
const { watchErrors, open, waitForModal } = require('./helpers');

const links = path.join(__dirname, 'fixtures', 'links.csv');
const keys = page => page.evaluate(() => db.keys().then(keys => keys.filter(k => /^stash-\d/.test(k))));

// Loads a network, leaving an autostash copy of it in the browser's storage, then starts afresh
async function leaveAutostash(page) {
  await open(page);
  await page.setInputFiles('#data-files', [links]);
  await expect(page.locator('#file-table .file-table-row')).toHaveCount(1);
  await page.click('#launch');
  await page.waitForFunction(() => session.data.clusters.length > 0 && document.getElementById('numberOfNodes').textContent != '', null, { timeout: 120000 });
  const nodes = await page.evaluate(() => session.data.nodes.length);
  await page.evaluate(() => { MT.syncLayout(); return db.setItem('stash-' + Date.now() + '-autostash', JSON.stringify(session)); });
  return nodes;
}

test('the setting is on the Files tab, with its privacy note', async ({ page }) => {
  await open(page);
  await expect(page.locator('#file-settings input[name="stash-auto"]')).toHaveCount(2);
  await expect(page.locator('#experimental-settings input[name="stash-auto"]')).toHaveCount(0);
  await expect(page.locator('#stash-auto-help')).toContainText('PII');
});

test('a write the browser refuses is rejected, not reported as stashed', async ({ page }) => {
  const errors = watchErrors(page);
  await open(page);
  await page.setInputFiles('#data-files', [links]);
  await expect(page.locator('#file-table .file-table-row')).toHaveCount(1);
  await page.click('#launch');
  await page.waitForFunction(() => session.data.clusters.length > 0 && document.getElementById('numberOfNodes').textContent != '', null, { timeout: 120000 });
  // A value IndexedDB cannot store makes the write fail
  await page.evaluate(() => { window.badWrite = db.setItem('x', () => {}).then(() => 'resolved', e => e.name); });
  expect(await page.evaluate(() => window.badWrite)).toBe('DataCloneError');
  expect(errors).toEqual([]);
});

test('a copy left behind is offered, and can be restored with the keyboard', async ({ page }) => {
  const errors = watchErrors(page);
  const nodes = await leaveAutostash(page);
  await page.reload();
  await page.waitForSelector('#data-files', { state: 'attached' });
  await waitForModal(page, '#recover-modal');
  await expect(page.locator('#recover-restore')).toBeFocused();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => session.data.nodes.length > 0, null, { timeout: 120000 });
  expect(await page.evaluate(() => session.data.nodes.length)).toBe(nodes);
  // Kept as an ordinary stash, so it is not offered again
  await expect.poll(async () => (await keys(page)).map(k => k.replace(/^stash-\d+-/, '')).sort()).toEqual(['Recovered session']);
  expect(errors).toEqual([]);
});

test('a copy can be discarded, or left for later', async ({ page }) => {
  await leaveAutostash(page);
  await page.reload();
  await waitForModal(page, '#recover-modal');
  await page.keyboard.press('Escape');
  await expect(page.locator('#recover-modal')).toBeHidden();
  expect(await keys(page)).toHaveLength(1);
  await page.reload();
  await waitForModal(page, '#recover-modal');
  await page.click('#recover-discard');
  await expect(page.locator('#recover-modal')).toBeHidden();
  await expect.poll(() => keys(page)).toEqual([]);
  await page.reload();
  await page.waitForSelector('#data-files', { state: 'attached' });
  await expect(page.locator('#recover-modal.show')).toHaveCount(0);
});

test('an unchanged session is not written again (#254)', async ({ page }) => {
  const errors = watchErrors(page);
  await open(page);
  await page.evaluate(() => db.setItem('stash-auto', 'true'));
  await page.setInputFiles('#data-files', [links]);
  await expect(page.locator('#file-table .file-table-row')).toHaveCount(1);
  await page.click('#launch');
  await page.waitForFunction(() => session.data.clusters.length > 0 && document.getElementById('numberOfNodes').textContent != '' && temp.autostash, null, { timeout: 120000 });
  // Each minute's copy, called directly rather than by waiting minutes (or
  // running a fake clock through every animation frame of those minutes).
  const tick = () => page.evaluate(() => temp.autostash.tick());
  await page.evaluate(() => { MT.events.emit('stop-force-simulation'); MT.syncLayout = () => {}; });
  expect(await page.evaluate(() => typeof temp.autostash.interval)).not.toBe('undefined');
  // (The views finish opening, and the Files view closes, just after launch)
  await expect.poll(() => page.evaluate(async () => {
    const before = JSON.stringify(session);
    await new Promise(resolve => setTimeout(resolve, 1000));
    return JSON.stringify(session) === before;
  }), { timeout: 30000 }).toBe(true);
  await tick();
  const first = await keys(page);
  expect(first).toHaveLength(1);
  await tick();
  await tick();
  expect(await keys(page)).toEqual(first);
  expect(errors).toEqual([]);
});

test('reopening a session drops any saved encoded sequences (#224)', async ({ page }) => {
  await open(page);
  await page.setInputFiles('#data-files', [links]);
  await expect(page.locator('#file-table .file-table-row')).toHaveCount(1);
  await page.click('#launch');
  await page.waitForFunction(() => session.data.clusters.length > 0 && document.getElementById('numberOfNodes').textContent != '', null, { timeout: 120000 });
  const left = await page.evaluate(async () => {
    MT.syncLayout();
    const saved = JSON.parse(JSON.stringify(session));
    saved.data.nodes.forEach(d => { d._seqInt = { 0: 1, 1: 2 }; });
    MT.applySession(saved);
    await new Promise(r => setTimeout(r, 500));
    return session.data.nodes.filter(d => '_seqInt' in d).length + ':' + JSON.stringify(session).includes('_seqInt');
  });
  expect(left).toBe('0:false');
});
