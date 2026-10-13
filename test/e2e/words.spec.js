// Tables and words: the aggregation sorted by count alone, its shares to one
// decimal; the table opening on useful columns, sized to fit; a loading log
// that adds up; files that can't be read saying so, and Launch waiting; a New
// dialog that says what it does; Save's formats by name; hover text without
// typos; one name for each thing; one pattern for dialog buttons; a View menu
// that lines up; and settings named for what they do.
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { watchErrors, open, loadNetwork, launchView, waitForModal } = require('./helpers');

test.describe.configure({ mode: 'serial' });

let page, errors;
test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  errors = watchErrors(page);
  await loadNetwork(page);
});
test.afterAll(() => page.close());

const set = (key, value) => page.evaluate(([key, value]) => MT.settings.set(key, value), [key, value]);
async function opened(view) {
  await page.evaluate(view => {
    const item = layout.contentItems.find(i => i.componentType == view);
    if (item) item.parent.setActiveComponentItem(item, true);
  }, view);
  if (!(await page.evaluate(view => layout.contentItems.some(i => i.componentType == view), view))) await launchView(page, view);
}
const titles = selector => page.locator(selector).evaluateAll(els => els.map(el => el.getAttribute('title')));

test('the aggregation sorts by count alone, its shares to one decimal, right-aligned', async () => {
  await opened('aggregation');
  const table = page.locator('.lm_content:has(.aggregation-tables) .tabulator').first();
  await expect(table.locator('.tabulator-row').first()).toBeVisible();
  const sorted = await table.locator('.tabulator-col[aria-sort]:not([aria-sort="none"])').allTextContents();
  expect(sorted.map(t => t.trim())).toEqual(['Number of Nodes']);
  const rows = await table.evaluate(el => {
    const t = Tabulator.findTable(el).pop();
    return t.getRows('active').map(r => r.getData());
  });
  const counts = rows.map(r => r.n);
  expect(counts).toEqual(counts.slice().sort((a, b) => b - a));
  expect(rows.every(r => /^\d+\.\d%$/.test(r.percent))).toBe(true);
  const cell = table.locator('.tabulator-row').first().locator('.tabulator-cell').nth(2);
  expect(await cell.evaluate(el => getComputedStyle(el).textAlign)).toBe('right');
});

test('the table opens without its internal index, columns sized to fit, lists comma-separated', async () => {
  await opened('table');
  const view = page.locator('.lm_content:has(.table-grid)').first();
  const headers = view.locator('.tabulator-col .tabulator-col-title');
  await expect(headers.first()).toBeVisible();
  const names = await headers.allTextContents();
  expect(names).not.toContain('Index');
  // Columns as wide as their contents: Origin's file names need more room than Degree
  const width = name => view.locator('.tabulator-col', { hasText: new RegExp('^' + name + '$') }).evaluate(el => el.getBoundingClientRect().width);
  expect(await width('Origin')).toBeGreaterThan(await width('Degree') + 40);
  const origin = await view.locator('.tabulator-row').first().locator('.tabulator-cell[tabulator-field="origin"]').textContent();
  expect(origin).toMatch(/\.\w+, \w/);
  // The text size slider starts at the size shown
  const shown = await view.locator('.table-grid').evaluate(el => Math.round(parseFloat(getComputedStyle(el).fontSize)));
  expect(+(await view.locator('.table-font-size').inputValue())).toBe(shown);
});

test('the loading log counts a node file’s rows, and says how many links are within the threshold', async () => {
  const messages = await page.evaluate(() => session.messages.join('\n'));
  const rows = fs.readFileSync(path.join(__dirname, 'fixtures', 'nodes.csv'), 'utf8').trim().split('\n').length - 1;
  expect(messages).toMatch(new RegExp(`Parsed \\d+ New, ${rows} Total Nodes from Node CSV`));
  const within = await page.evaluate(() => {
    const t = parseFloat(session.style.widgets['link-threshold']);
    let n = 0;
    session.data.graph.forEachValue('distance', v => { if (v <= t) n++; });
    return n;
  });
  expect(messages).toContain(`${within.toLocaleString()} links are within the link threshold`);
});

test('a file that can’t be read as a link list says so, and Launch waits', async ({ browser }) => {
  const fresh = await browser.newPage();
  await open(fresh);
  const notes = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mt-')), 'notes.txt');
  fs.writeFileSync(notes, 'These are some notes about the outbreak, not a table.\nThey go on for a second line.\n');
  await fresh.setInputFiles('#data-files', notes);
  const row = fresh.locator('.file-table-row').first();
  await expect(row.locator('.file-problem')).toBeVisible();
  await expect(row.locator('.file-problem')).toContainText('No columns');
  await expect(fresh.locator('#launch')).toBeDisabled();
  await expect(fresh.locator('#launch')).not.toHaveAttribute('title', /Please select/);
  await fresh.close();
});

test('File › New asks to start a new session, says what goes, and offers to save first', async () => {
  await page.locator('nav .dropdown-toggle', { hasText: 'File' }).click();
  await page.click('#NewTab');
  await waitForModal(page, '#exit-modal');
  const dialog = page.locator('#exit-modal');
  await expect(dialog.locator('.modal-title')).toHaveText('Start a new session?');
  await expect(dialog.locator('.modal-body')).toContainText('data and settings');
  await expect(dialog.locator('#exit-button')).toHaveText('Start New Session');
  await dialog.locator('button', { hasText: 'Save First…' }).click();
  await waitForModal(page, '#session-save-modal');
  // Save names its formats, under a label
  const save = page.locator('#session-save-modal');
  await expect(save.locator('label[for="save-file-format"]')).toHaveText('Format');
  expect(await save.locator('#save-file-format option').allTextContents()).toEqual(['MicrobeTrace session', 'HIV-TRACE', 'Style only']);
  expect(await save.locator('#save-file-format').inputValue()).toBe('microbetrace');
  await save.locator('.btn-close').click();
  await expect(save).toBeHidden();
  // Export formats read as names too
  await opened('table');
  const formats = await page.locator('.lm_content:has(.table-grid) [name="export-filetype"] option').first().textContent();
  expect(formats).toBe('CSV');
});

test('hover text reads right', async () => {
  const all = await page.evaluate(() => Array.from(document.querySelectorAll('[title]'), el => el.getAttribute('title')).join('\n'));
  for (const typo of ['Shoul ', 'nodes be colored', 'for your \n', 'should Microbe use', 'Highlight a node', 'Please select a Network']) {
    expect([typo, all.includes(typo)]).toEqual([typo, false]);
  }
  await opened('network');
  const row = label => page.locator('.lm_content:has(.network-view) .left-pane .form-group.row', { has: page.locator('.col-4', { hasText: new RegExp('^' + label + '$') }) }).first().getAttribute('title');
  expect(await row('Gridlines')).toMatch(/gridlines/i);
  expect(await row('Polygons')).toMatch(/shape|polygon/i);
});

test('each thing has one name', async () => {
  await opened('geo_map');
  expect(await titles('.lm_content:has(.map-canvas) .view-controls button')).toEqual(expect.arrayContaining(['Map Settings', 'Export Map']));
  await opened('phylogenetic_tree');
  expect(await titles('.lm_content:has(.tree) .view-controls button')).toEqual(expect.arrayContaining(['Phylogenetic Tree Settings', 'Export Phylogenetic Tree']));
  // Every settings button is "<View> Settings"
  const settings = await titles('.settings-toggle');
  expect(settings.every(t => /^[A-Z][\w ]+ Settings$/.test(t) && !t.startsWith('Toggle'))).toBe(true);
  expect(await page.locator('label[for="link-threshold"]').first().textContent()).toBe('Link Threshold');
  expect(await page.evaluate(() => Array.from(document.querySelectorAll('.sequence-controls-button, #sequence-controls-title'), el => el.textContent.trim()))).not.toContain('Sequence Controls');
});

test('dialogs’ main actions are blue, and settings dialogs close with Done', async () => {
  expect(await page.locator('#recall-load-stash').getAttribute('class')).toContain('btn-primary');
  const dialogs = await page.evaluate(() => Array.from(document.querySelectorAll('.modal-footer .btn-success'), b => b.textContent.trim()));
  expect(dialogs).toEqual([]);
  const words = await page.evaluate(() => Array.from(document.querySelectorAll('.modal-footer button'), b => b.textContent.trim()));
  expect(words).not.toContain('Confirm');
  expect(words).not.toContain('OK');
});

test('the View menu has the network above two lined-up columns', async () => {
  await page.locator('nav .dropdown-toggle', { hasText: 'View' }).click();
  const menu = page.locator('.view-menu.show');
  await expect(menu).toBeVisible();
  const headings = await menu.locator('.dropdown-header').allTextContents();
  expect(headings).not.toContain('Sequences');
  const tops = await menu.locator(':scope > div:not(.view-menu-top) > .dropdown-header:first-child').evaluateAll(hs => hs.map(h => h.getBoundingClientRect().top));
  expect(tops.length).toBe(2);
  expect(Math.abs(tops[0] - tops[1])).toBeLessThan(2);
  await page.keyboard.press('Escape');
});

test('settings are named for what they do, and the tree’s menus turn labels and tooltips off', async () => {
  await opened('bubbles');
  expect(await page.locator('.lm_content:has(svg.bubbles) .left-pane .nav-link').allTextContents()).toContain('Layout');
  await opened('histogram');
  expect(await page.locator('.lm_content:has(.histogram-plot) [data-setting="histogram-variable"] option').allTextContents()).toContain('Link Distance');
  await opened('phylogenetic_tree');
  const pane = page.locator('.lm_content:has(.tree) .left-pane');
  await expect(pane.locator('[data-setting="tree-leaf-label-show"], [data-setting="tree-tooltip-show"]')).toHaveCount(0);
  await set('tree-leaf-label-variable', 'state');
  await expect.poll(() => page.evaluate(() => session.style.widgets['tree-leaf-label-show'])).toBe(true);
  await set('tree-leaf-label-variable', 'None');
  await expect.poll(() => page.evaluate(() => session.style.widgets['tree-leaf-label-show'])).toBe(false);
  await set('tree-leaf-tooltip-variable', 'None');
  await expect.poll(() => page.evaluate(() => session.style.widgets['tree-tooltip-show'])).toBe(false);
  await set('tree-leaf-tooltip-variable', '_id');
  expect(errors).toEqual([]);
});
