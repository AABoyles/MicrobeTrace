// The entry screen's demo button (#266), the notes views show when the session
// lacks what they need (#268), and the built-in Help that works offline (#276).
const { test, expect } = require('@playwright/test');
const { fixtures, watchErrors, waitForModal, open } = require('./helpers');

test.describe.configure({ mode: 'serial' });

let page, errors;
test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  errors = watchErrors(page);
});
test.afterAll(() => page.close());

const start = p => open(p);

test('the empty Files view offers the demo data', async () => {
  await start(page);
  const button = page.locator('#file-table .demo-button');
  await expect(button).toHaveText('Try the demo data');
  await button.click();
  await page.waitForFunction(() => session.data.nodes.length > 10);
});

test('#demo still loads the demo', async () => {
  await page.goto('about:blank');
  await page.goto('/index.html#demo');
  await page.waitForFunction(() => window.session && session.data.nodes.length > 10);
  await page.goto('about:blank');
});

test('views with no data at all say so, and offer the demo', async () => {
  await start(page);
  await page.evaluate(() => MT.launchView('timeline'));
  const note = page.locator('.view-needs');
  await expect(note).toBeVisible();
  await expect(note).toContainText('No data yet');
  await expect(note.locator('.view-needs-demo')).toBeVisible();
  // The timeline's own prompt to choose a date field is not shown over it
  await expect(page.locator('.view-message')).toBeHidden();
});

test('a view that lacks one kind of data says what it needs', async () => {
  await page.evaluate(() => MT.launchView('files'));
  await page.setInputFiles('#data-files', fixtures.filter(f => /links/.test(f)));
  await page.waitForFunction(() => document.querySelectorAll('#file-table .file-table-row').length >= 1);
  await page.click('#launch');
  await page.waitForFunction(() => session.data.nodes.length > 0);
  await page.evaluate(() => { MT.launchView('sequences'); MT.launchView('geo_map'); MT.launchView('timeline'); });
  const seq = page.locator('.view-needs', { hasText: 'sequence' });
  await expect(seq.first()).toContainText('FASTA');
  const map = page.locator('.view-needs', { hasText: 'latitude and longitude' });
  await expect(map.first()).toContainText('Choose the columns');
  // With data, the demo is not offered
  await expect(page.locator('.view-needs .view-needs-demo:visible')).toHaveCount(0);
  // Views that have what they need have no note
  expect(await page.evaluate(() => ['table', 'network', 'histogram'].some(v => MT.viewNeeds[v]))).toBe(false);
});

test('Help opens the built-in help with no connection', async () => {
  await page.context().setOffline(true);
  await page.locator('nav .dropdown-toggle', { hasText: 'Help' }).click();
  await page.locator('#HelpTab').click();
  await waitForModal(page, '#help-modal');
  const body = page.locator('#help-modal .modal-body');
  for (const heading of ['Loading data', 'The views', 'Thresholds and links', 'Saving, stashing and exporting', 'Mouse and keyboard shortcuts']) {
    await expect(body.locator('h3', { hasText: heading })).toHaveCount(1);
  }
  await page.locator('#help-modal .btn-close').click();
  await page.context().setOffline(false);
});

test('a map\'s Read More opens the help section on tiles', async () => {
  await expect(page.locator('#help-modal')).toBeHidden();
  await page.locator('a[data-help="help-maps"]').first().evaluate(a => a.click());
  await waitForModal(page, '#help-modal');
  await expect(page.locator('#help-maps')).toBeInViewport();
  await page.locator('#help-modal .btn-close').click();
});

test('nothing threw', () => {
  expect(errors).toEqual([]);
});
