// Keyboard and assistive-technology access to the chrome around the views:
// the menus are buttons (File > Open included), a skip link leads to the main
// region, the node search is a combobox, toasts can be dismissed and acted on
// from the keyboard, icon-only buttons are named and show their name on
// focus, and search and selection changes are announced.
const { test, expect } = require('@playwright/test');
const { watchErrors, loadNetwork, launchView } = require('./helpers');

test.describe.configure({ mode: 'serial' });

let page, errors;
test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  errors = watchErrors(page);
  await loadNetwork(page);
});
test.afterAll(async () => {
  expect(errors).toEqual([]);
  await page.close();
});

const status = () => page.locator('#mt-status');

test('menu actions are buttons, and File > Open can be reached and used from the keyboard', async () => {
  expect(await page.locator('nav a[href="#"]').count()).toBe(0);
  expect(await page.locator('nav .dropdown-menu button.dropdown-item').count()).toBeGreaterThan(8);
  await page.locator('nav .dropdown-toggle', { hasText: 'File' }).focus();
  await page.keyboard.press('Enter');
  const open = page.locator('#OpenButton');
  await expect(open).toBeVisible();
  await open.focus();
  await expect(open).toBeFocused();
  // Enter on it asks the file input for its picker...
  await page.evaluate(() => {
    window.pickerAsked = 0;
    const click = HTMLInputElement.prototype.click;
    HTMLInputElement.prototype.click = function () { if (this.id === 'OpenTab') window.pickerAsked++; };
    window.restoreClick = () => { HTMLInputElement.prototype.click = click; };
  });
  await page.keyboard.press('Enter');
  expect(await page.evaluate(() => { window.restoreClick(); return window.pickerAsked; })).toBe(1);
  // ...and the picker opens
  await page.locator('nav .dropdown-toggle', { hasText: 'File' }).click();
  const chooser = page.waitForEvent('filechooser');
  await open.click();
  expect((await chooser).isMultiple()).toBe(false);
  await page.keyboard.press('Escape');
});

test('a skip link leads to the main region, which has a heading', async () => {
  // (It is the first thing in the tab order: the one before the menu bar's first item)
  await page.locator('nav .dropdown-toggle', { hasText: 'File' }).focus();
  await page.keyboard.press('Shift+Tab');
  const skip = page.locator('#skip-link');
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.locator('main#main-panel')).toBeFocused();
  await expect(page.locator('h1.visually-hidden')).toHaveText('MicrobeTrace');
  expect(await page.evaluate(() => location.hash)).toBe('');
});

test('the search is a combobox over its suggestions, driven by the arrow keys', async () => {
  const search = page.locator('#search');
  await expect(search).toHaveAttribute('role', 'combobox');
  await expect(search).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#search-results')).toHaveAttribute('role', 'listbox');
  await search.click();
  await search.fill('S1');
  await expect(search).toHaveAttribute('aria-expanded', 'true');
  const options = page.locator('#search-results [role=option]');
  const count = await options.count();
  expect(count).toBeGreaterThan(1);
  // The count is announced, with the selection it made
  await expect(status()).toContainText(`${count} suggestions`, { timeout: 5000 });
  await expect(status()).toContainText('selected');
  // Arrow keys move through the options, wrapping round
  await page.keyboard.press('ArrowDown');
  await expect(search).toHaveAttribute('aria-activedescendant', 'search-option-0');
  await expect(options.first()).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('ArrowDown');
  await expect(search).toHaveAttribute('aria-activedescendant', 'search-option-1');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  await expect(search).toHaveAttribute('aria-activedescendant', 'search-option-' + (count - 1));
  await page.keyboard.press('ArrowDown');
  const chosen = (await options.first().textContent()).trim();
  // Enter takes the active one, and focus stays in the box
  await page.keyboard.press('Enter');
  await expect(search).toHaveValue(chosen);
  await expect(search).toBeFocused();
  await expect(search).toHaveAttribute('aria-expanded', 'false');
  // (Choosing a value selects the nodes whose value contains it)
  const selected = await page.evaluate(() => session.data.nodes.filter(d => d.selected).map(d => d._id));
  expect(selected).toContain(chosen);
  await expect(status()).toContainText(`${selected.length} nodes selected`);
  // Escape closes the suggestions without changing the search
  await search.fill('S1');
  await expect(search).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape');
  await expect(search).toHaveAttribute('aria-expanded', 'false');
  await expect(search).toHaveValue('S1');
  // No matches is announced too
  await search.fill('nothing-is-called-this');
  await expect(status()).toContainText('No matches', { timeout: 5000 });
  await search.fill('');
});

test('selecting nodes elsewhere is announced', async () => {
  await page.evaluate(() => { session.data.nodes.slice(0, 3).forEach(d => d.selected = true); MT.events.emit('node-selected'); });
  await expect(status()).toHaveText('3 nodes selected', { timeout: 5000 });
  await page.evaluate(() => { session.data.nodes.forEach(d => d.selected = false); MT.events.emit('node-selected'); });
  await expect(status()).toHaveText('No nodes selected', { timeout: 5000 });
});

test('a toast has a close button, and an action button when it offers one', async () => {
  await page.evaluate(() => MT.toast.info('Plain notice', 60));
  const plain = page.locator('.mt-toast-container .toast', { hasText: 'Plain notice' });
  await expect(plain).toBeVisible();
  await expect(plain).toHaveText('Plain notice');
  await expect(plain.locator('.toast-action')).toHaveCount(0);
  await plain.getByRole('button', { name: 'Dismiss notification' }).focus();
  await page.keyboard.press('Enter');
  await expect(plain).toBeHidden();

  // An offer stays until it is answered, and the callback is told which way
  await page.evaluate(() => {
    window.answers = [];
    MT.toast.warning('Two things differ.', 1, clicked => window.answers.push(clicked), { action: 'Review' });
  });
  const offer = page.locator('.mt-toast-container .toast', { hasText: 'Two things differ.' });
  await expect(offer).toBeVisible();
  // An offer has no timer: it should still be there after a timed notice would have gone
  await page.waitForTimeout(2000);
  await expect(offer).toBeVisible();
  const action = offer.getByRole('button', { name: 'Review' });
  await action.focus();
  await page.keyboard.press('Enter');
  await expect(offer).toBeHidden();
  expect(await page.evaluate(() => window.answers)).toEqual([true]);
  // ...and closing it is not taking it up
  await page.evaluate(() => MT.toast.warning('Another.', 0, clicked => window.answers.push(clicked)));
  const other = page.locator('.mt-toast-container .toast', { hasText: 'Another.' });
  await other.getByRole('button', { name: 'Dismiss notification' }).click();
  await expect(other).toBeHidden();
  expect(await page.evaluate(() => window.answers)).toEqual([true, false]);
});

test('a timed toast waits while the pointer or focus is in it', async () => {
  await page.evaluate(() => MT.toast.success('Held notice', 1));
  const toast = page.locator('.mt-toast-container .toast', { hasText: 'Held notice' });
  await expect(toast).toBeVisible();
  await toast.hover();
  // A timed notice (1 s) would be gone by now: this waits to see that the pointer keeps it
  await page.waitForTimeout(2500);
  await expect(toast).toBeVisible();
  await page.mouse.move(5, 5);
  await expect(toast).toBeHidden();

  await page.evaluate(() => MT.toast.success('Focused notice', 1));
  const focused = page.locator('.mt-toast-container .toast', { hasText: 'Focused notice' });
  await expect(focused).toBeVisible();
  await focused.getByRole('button', { name: 'Dismiss notification' }).focus();
  // As above, for focus: a timed notice (1 s) would be gone by now
  await page.waitForTimeout(2500);
  await expect(focused).toBeVisible();
  await page.evaluate(() => document.activeElement.blur());
  await expect(focused).toBeHidden();
});

test('icon-only buttons are named, show their name on keyboard focus, and are big enough', async () => {
  const view = page.locator('.lm_content:has(button[title="Export Network"])').first();
  const gear = view.locator('button[title="Network Settings"]');
  await expect(gear).toHaveAttribute('aria-label', 'Network Settings');
  await expect(gear).toHaveAttribute('title', 'Network Settings');
  await expect(gear.locator('.bi').first()).toHaveAttribute('aria-hidden', 'true');
  await page.keyboard.press('Escape');
  await gear.focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await expect(gear).toBeFocused();
  const tip = page.locator('#mt-focus-tip');
  await expect(tip).toBeVisible();
  await expect(tip).toHaveText('Network Settings');
  await page.keyboard.press('Escape');
  await expect(tip).toBeHidden();
  // Every icon-only button, in this view and the menu bar's search options, is at least 24 by 24 px
  const small = await page.evaluate(() => Array.from(document.querySelectorAll('[data-mt-name]'))
    .filter(el => el.offsetParent)
    .map(el => [el.dataset.mtName, el.getBoundingClientRect()])
    .filter(([, box]) => box.width < 24 || box.height < 24)
    .map(([name, box]) => `${name}: ${box.width}x${box.height}`));
  expect(small).toEqual([]);
  expect(await page.locator('[data-mt-name]').count()).toBeGreaterThan(3);
});

test('every view\'s icon-only buttons are named and at least 24 by 24 px', async () => {
  const views = ['table', 'aggregation', 'crosstab', 'graph', 'heatmap', 'gantt', 'bubbles',
    'sankey_diagram', 'geo_map', 'phylogenetic_tree', 'waterfall', 'sequences', 'conflicts'];
  for (const view of views) await launchView(page, view);
  // Lets each view finish laying out its toolbar before the sizes are read; no
  // event marks that
  await page.waitForTimeout(1500);
  const problems = await page.evaluate(() => {
    const found = [];
    document.querySelectorAll('button, a[role=button]').forEach(el => {
      if (!el.offsetParent || el.closest('.modal:not(.show)')) return;
      const box = el.getBoundingClientRect();
      if (!box.width) return;
      const name = el.getAttribute('aria-label') || el.textContent.trim() || el.getAttribute('title');
      if (!el.getAttribute('aria-label') && !el.textContent.trim() && !el.getAttribute('aria-labelledby')) found.push('no name: ' + el.outerHTML.slice(0, 100));
      if (el.dataset.mtName && (box.width < 24 || box.height < 24)) found.push(`small: ${name} ${box.width}x${box.height}`);
    });
    return found;
  });
  expect(problems).toEqual([]);
});
