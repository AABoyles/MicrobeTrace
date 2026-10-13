// The menus and the words in dialogs: search, the File, View and Help menus,
// the license, the empty Files view and its rows, the loading dialog, and the
// names the Save, Stash and Export dialogs suggest.
const { test, expect } = require('@playwright/test');
const { fixtures, watchErrors, waitForModal, openExport, launchView } = require('./helpers');

test.describe.configure({ mode: 'serial' });

let page, errors;
test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  errors = watchErrors(page);
});
test.afterAll(() => page.close());

const today = () => page.evaluate(() => {
  const d = new Date(), pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
});
const menu = name => page.locator('nav .dropdown-toggle', { hasText: name });
const openMenu = async name => {
  await menu(name).click();
  const items = page.locator('nav .dropdown-menu.show');
  await expect(items).toBeVisible();
  return items;
};
const closeMenu = () => page.keyboard.press('Escape');
const dropZone = () => page.locator('#file-table .drop-zone');
const rows = () => page.locator('#file-table .file-table-row');

test('the license reads as text, and its dialog has one id', async () => {
  await page.goto('/index.html');
  await waitForModal(page, 'div#licenseAgreement');
  const body = page.locator('#licenseAgreement .modal-body');
  await expect(body.locator('pre')).toHaveCount(0);
  await expect(body.locator('p').first()).toContainText('provided to you "As-is"');
  await expect(body).toContainText('Accept to agree to these terms, or Reject to leave MicrobeTrace.');
  expect(await page.locator('[id="licenseAgreement"]').count()).toBe(1);
  await expect(page.locator('#licenseAgreement')).toHaveAttribute('aria-labelledby', 'licenseAgreementLabel');
  await page.click('#acceptAgreement');
  await expect(page.locator('div#licenseAgreement')).toBeHidden();
});

test('search waits for data, with labelled options', async () => {
  await expect(page.locator('#search')).toBeDisabled();
  await expect(page.locator('#search-field')).toBeDisabled();
  await expect(page.locator('#search')).toHaveAttribute('placeholder', 'Search nodes by ID');
  // The field menu shows its field before there's data
  expect(await page.locator('#search-field').evaluate(el => el.selectedOptions[0].text)).toBe('ID');
  await expect(page.locator('#casesensitivebutton')).toHaveText('Aa');
  await expect(page.locator('#casesensitivebutton')).toHaveAttribute('title', 'Match case');
  await expect(page.locator('#wholewordbutton')).toHaveText('ab');
  await expect(page.locator('#wholewordbutton')).toHaveAttribute('title', 'Match whole words');
});

test('the empty Files view is a drop zone, and opens the file picker', async () => {
  await expect(dropZone()).toBeVisible();
  await expect(dropZone()).toContainText('Drop files here, or add files');
  await expect(page.locator('#file-table')).not.toContainText('troubleshoot caching');
  await expect(page.locator('label[for="data-files"].btn')).toHaveText('Add Files');
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), dropZone().click()]);
  expect(chooser.isMultiple()).toBe(true);
  // Dragging files over the view highlights it
  await page.evaluate(() => document.querySelector('.file-panel').dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: new DataTransfer() })));
  await expect(page.locator('.file-panel')).toHaveClass(/dragging/);
  await page.evaluate(() => document.querySelector('.file-panel').dispatchEvent(new DragEvent('dragleave', { bubbles: true, relatedTarget: document.body })));
  await expect(page.locator('.file-panel')).not.toHaveClass(/dragging/);
});

test('troubleshooting caching is in the Help menu', async () => {
  const items = await openMenu('Help');
  const link = items.locator('a', { hasText: 'Troubleshoot Caching' });
  await expect(link).toHaveAttribute('href', 'https://github.com/CDCgov/MicrobeTrace/wiki/Troubleshooting---Caching');
  await expect(link).toHaveAttribute('target', '_blank');
  await closeMenu();
});

test('the distance metric fits its menu, with its full name as a tooltip', async () => {
  await page.locator('button[title="Files Settings"]').click();
  const select = page.locator('#default-distance-metric');
  await expect(select).toBeVisible();
  // Every option's text fits inside the closed menu
  const fit = await select.evaluate(el => {
    const cs = getComputedStyle(el), ctx = document.createElement('canvas').getContext('2d');
    ctx.font = cs.fontSize + ' ' + cs.fontFamily;
    const room = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    return Array.from(el.options).filter(o => ctx.measureText(o.text).width > room).map(o => o.text);
  });
  expect(fit).toEqual([]);
  await expect(select).toHaveAttribute('title', 'Tamura-Nei 1993');
  await page.evaluate(() => MT.settings.set('default-distance-metric', 'k2p'));
  await expect(select).toHaveAttribute('title', 'Kimura 2-Parameter');
  await page.evaluate(() => MT.settings.set('default-distance-metric', 'tn93'));
  await expect(select).toHaveAttribute('title', 'Tamura-Nei 1993');
  await page.locator('.left-pane .pane-close').click();
  await expect(page.locator('.left-pane')).toBeHidden();
});

test("a file's row ends with resave and a red remove, and the drop zone returns with the last", async () => {
  await page.setInputFiles('#data-files', fixtures);
  await expect(rows()).toHaveCount(3);
  await expect(dropZone()).toBeHidden();
  await expect(page.locator('#launch')).toBeEnabled();
  const row = rows().first();
  const order = await row.locator('.file-name').evaluate(el => Array.from(el.children).map(c => c.title || c.className.split(' ')[0]));
  // (After the grip that reorders files)
  expect(order).toEqual(['Drag to reorder', 'file-title', 'btn-group', 'Resave this file', 'Remove this file']);
  const red = await row.locator('a[title="Remove this file"]').evaluate(el => getComputedStyle(el).color);
  expect(red).toBe('rgb(220, 53, 69)');
  // Removing every file empties the view again
  for (let n = 3; n > 0; n--) await rows().first().locator('a[title="Remove this file"]').click();
  await expect(rows()).toHaveCount(0);
  await expect(dropZone()).toBeVisible();
  await expect(page.locator('#launch')).toBeDisabled();
  expect(await page.evaluate(() => session.files.length)).toBe(0);
});

test('the loading dialog counts the files, and its log reads as text', async () => {
  await page.setInputFiles('#data-files', fixtures);
  await expect(rows()).toHaveCount(3);
  await page.click('#launch');
  await expect(page.locator('#loading-title')).toHaveText('Loading 3 files');
  const log = await page.locator('#loading-information').evaluate(el => {
    const cs = getComputedStyle(el);
    return { size: parseFloat(cs.fontSize), family: cs.fontFamily };
  });
  expect(log.size).toBeGreaterThanOrEqual(12);
  expect(log.family).not.toMatch(/Courier|monospace/);
  await page.waitForFunction(() => session.data.clusters.length > 0 && document.getElementById('numberOfNodes').textContent != '', null, { timeout: 120000 });
  await page.waitForFunction(() => !layout.contentItems.some(i => i.componentType == 'files'));
});

test('search opens once there is data, and says which field it searches', async () => {
  await expect(page.locator('#search')).toBeEnabled();
  await expect(page.locator('#search-field')).toBeEnabled();
  await page.evaluate(() => MT.settings.set('search-field', 'cluster'));
  await expect(page.locator('#search')).toHaveAttribute('placeholder', 'Search nodes by Cluster');
  await page.evaluate(() => MT.settings.set('search-field', '_id'));
  await expect(page.locator('#search')).toHaveAttribute('placeholder', 'Search nodes by ID');
});

test('the search options show when they are on, however they were set', async () => {
  const button = page.locator('#casesensitivebutton');
  await button.click();
  await expect(button).toHaveClass(/active/);
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => MT.settings.get('search-case-sensitive'))).toBe(true);
  // A tint, not just a shade of grey (once the button's transition ends)
  const primary = await page.evaluate(() => getComputedStyle(document.body).getPropertyValue('--bs-primary').trim())
    .then(hex => `rgb(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)})`);
  await expect.poll(() => button.evaluate(el => getComputedStyle(el).borderColor)).toBe(primary);
  await button.click();
  await expect(button).not.toHaveClass(/active/);
  await expect(button).toHaveAttribute('aria-pressed', 'false');
  // Set from elsewhere, as when a session opens
  await page.evaluate(() => MT.settings.set('search-whole-word', true));
  await expect(page.locator('#wholewordbutton')).toHaveClass(/active/);
  await page.evaluate(() => MT.settings.set('search-whole-word', false));
  await expect(page.locator('#wholewordbutton')).not.toHaveClass(/active/);
});

test('the File menu starts with New, says where stashes go, and shows its shortcut', async () => {
  const items = await openMenu('File');
  const labels = await items.locator('.dropdown-item').allInnerTexts();
  expect(labels.map(l => l.replace(/\s+/g, ' ').trim())).toEqual(['New', 'Open…', 'Save… Ctrl+S', 'Stash in Browser…', 'Recall from Browser…', 'Add Data']);
  await expect(items.locator('#SaveDataTab .shortcut')).toHaveText('Ctrl+S');
  await closeMenu();
});

test('the View menu has the network above two columns of grouped views', async () => {
  const items = await openMenu('View');
  expect(await items.locator('.dropdown-header').allInnerTexts()).toEqual(['Charts', 'Tables', 'Maps', 'Phylogenetics']);
  // The network spans both columns, so their headings line up
  const network = await items.locator('.view-menu-top').boundingBox();
  const headings = await items.locator(':scope > div:not(.view-menu-top) > .dropdown-header:first-child').evaluateAll(hs => hs.map(h => h.getBoundingClientRect().top));
  expect(headings.length).toBe(2);
  expect(Math.abs(headings[0] - headings[1])).toBeLessThan(2);
  expect(network.y + network.height).toBeLessThanOrEqual(headings[0] + 1);
  await expect(items.locator('.viewbutton')).toHaveCount(18);
  const views = await items.locator('.viewbutton').allInnerTexts();
  expect(views).toContain('Crosstab');
  expect(views).not.toContain('CrossTab');
  const [first, second] = await items.locator(':scope > div:not(.view-menu-top)').evaluateAll(cols => cols.map(c => c.getBoundingClientRect().toJSON()));
  expect(second.left).toBeGreaterThanOrEqual(first.right - 1);
  expect(Math.abs(second.top - first.top)).toBeLessThan(2);
  await closeMenu();
});

test('Save suggests a dated name, and keeps one typed in', async () => {
  await page.keyboard.press('Control+s');
  await waitForModal(page, '#session-save-modal');
  const name = page.locator('#save-file-name');
  await expect(name).toHaveValue(`microbetrace-${await today()}`);
  await expect(page.locator('label[for="save-file-compress"]')).toHaveText('Compress the file');
  await name.fill('my-outbreak');
  await page.locator('#session-save-modal .btn-close').click();
  await expect(page.locator('#session-save-modal')).toBeHidden();
  await page.keyboard.press('Control+s');
  await waitForModal(page, '#session-save-modal');
  await expect(name).toHaveValue('my-outbreak');
  await name.fill('');
  await page.locator('#session-save-modal .btn-close').click();
  await expect(page.locator('#session-save-modal')).toBeHidden();
});

test("exports suggest the view's name and the date", async () => {
  const date = await today();
  let modal = await openExport(page, page.locator('.lm_content:has(.network-view)').first(), 'Export Network');
  await expect(modal.locator('[name="export-filename"]')).toHaveValue(`microbetrace-network-${date}`);
  await modal.locator('.btn-close').click();
  await expect(modal).toBeHidden();
  await launchView(page, 'timeline');
  modal = await openExport(page, page.locator('.lm_content:has(#timeline-export-modal)'), 'Export Epi Curve');
  await expect(modal.locator('[name="export-filename"]')).toHaveValue(`microbetrace-epi-curve-${date}`);
  await modal.locator('.btn-close').click();
  await expect(modal).toBeHidden();
});

test('the stash dialogs speak plainly, and say where stashes are kept', async () => {
  await openMenu('File');
  await page.click('#StashDataTab');
  await waitForModal(page, '#session-stash-modal');
  const dialog = page.locator('#session-stash-modal');
  await expect(dialog.locator('.modal-title')).toHaveText('Stash in Browser');
  await expect(dialog.locator('#stash-name')).toHaveAttribute('placeholder', 'Stash name');
  await expect(dialog.locator('#stash-help')).toContainText('kept in this browser');
  await expect(dialog.locator('#stash-data')).toHaveText('Stash');
  await expect(dialog).not.toContainText('!');
  await dialog.locator('.btn-close').click();
  await expect(dialog).toBeHidden();
  await openMenu('File');
  await page.click('#RecallDataTab');
  await waitForModal(page, '#session-recall-modal');
  await expect(page.locator('#session-recall-modal .modal-title')).toHaveText('Recall from Browser');
  await page.locator('#session-recall-modal .btn-close').click();
  await expect(page.locator('#session-recall-modal')).toBeHidden();
});

test('a new session puts search away again', async () => {
  await openMenu('File');
  await page.click('#NewTab');
  await waitForModal(page, '#exit-modal');
  await page.click('#exit-button');
  await expect(page.locator('#search')).toBeDisabled();
  await expect(page.locator('#search-field')).toBeDisabled();
  await expect(dropZone()).toBeVisible();
  expect(errors).toEqual([]);
});
