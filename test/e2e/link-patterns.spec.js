// Links and nodes told apart without color alone (#294): a link's dash pattern
// follows a variable, the link legend shows each pattern, the pattern is saved
// with the session, and a categorical node color with more than a few values
// is offered as shapes too, once per variable, in a toast the user can take or
// leave.
const { test, expect } = require('@playwright/test');
const { watchErrors, loadNetwork } = require('./helpers');

test.describe.configure({ mode: 'serial' });

let page, errors;
test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  errors = watchErrors(page);
  await loadNetwork(page);
  await page.waitForFunction(() => temp.network && temp.network.points.length > 0);
});
test.afterAll(() => page.close());

// The pattern each visible link is drawn with, by cosmos.gl's LinkStyle
// (0 solid, 1 dashed, 2 dotted)
const styles = () => page.evaluate(() => Array.from(temp.network.graph.getLinkStyles()));
const rows = () => page.evaluate(() => Array.from(document.querySelectorAll('.link-dash-table tr'), tr => ({
  cells: Array.from(tr.children, td => td.textContent),
  line: tr.querySelector('line') ? Object.fromEntries(Array.from(tr.querySelector('line').attributes, a => [a.name, a.value])) : null
})));

test('a link dash pattern by variable: each link is drawn with its value’s pattern, and the legend shows them', async () => {
  // Contact's values are (Empty), which most links have (as the color legend
  // has them too), and work: the first is solid, the second dashed
  await page.evaluate(() => MT.settings.set('link-dash-variable', 'contact'));
  await expect.poll(async () => (await styles()).includes(1)).toBe(true);
  const expected = await page.evaluate(() => temp.network.links.map(l => String(l.contact) === 'work' ? 1 : 0));
  expect(await styles()).toEqual(expected);
  const legend = await rows();
  expect(legend.map(r => r.cells[0])).toEqual(['Link Contact', '(Empty)', 'work']);
  expect(legend[1].line).not.toHaveProperty('stroke-dasharray');
  expect(legend[2].line['stroke-dasharray']).toBe('15, 15');
  await expect(page.locator('.link-dash-table-wrapper')).toBeVisible();
  // It's saved with the session, as the other widgets are
  expect(await page.evaluate(() => session.style.widgets['link-dash-variable'])).toBe('contact');
  // (The network's Links settings offer it)
  await expect(page.locator('select[data-setting="link-dash-variable"]')).toHaveValue('contact');
});

test('past three values the patterns repeat, and dotted links are drawn dotted', async () => {
  // tn93 has many values: the first three are solid, dashed and dotted
  await page.evaluate(() => MT.settings.set('link-dash-variable', 'tn93'));
  await expect.poll(async () => (await rows()).length).toBeGreaterThan(3);
  // (Row 0 is the heading: the values' rows 1, 2 and 3 are solid, dashed and dotted)
  const legend = await rows();
  expect(legend[1].line).not.toHaveProperty('stroke-dasharray');
  expect(legend[2].line['stroke-dasharray']).toBe('15, 15');
  expect(legend[3].line['stroke-linecap']).toBe('round');
  expect(new Set(await styles())).toEqual(new Set([0, 1, 2]));
  // Each link is drawn with the pattern of its value's row in the legend
  const matches = await page.evaluate(() => {
    const labels = Array.from(document.querySelectorAll('.link-dash-table td:first-child'), td => td.textContent);
    const drawn = temp.network.graph.getLinkStyles();
    return temp.network.links.every((l, i) => labels.indexOf(MT.valueLabel(String(l.tn93))) % 3 === drawn[i]);
  });
  expect(matches).toBe(true);
  await page.evaluate(() => MT.settings.set('link-dash-variable', 'None'));
  await expect(page.locator('.link-dash-table-wrapper')).toBeHidden();
  expect(new Set(await styles())).toEqual(new Set([0]));
  expect(errors).toEqual([]);
});

test('the link legend can be hidden, and comes back with its variable', async () => {
  await page.evaluate(() => MT.settings.set('link-dash-variable', 'contact'));
  await expect(page.locator('.link-dash-table-wrapper')).toBeVisible();
  await page.evaluate(() => MT.settings.set('link-dash-table-show', false));
  await expect(page.locator('.link-dash-table-wrapper')).toBeHidden();
  await page.evaluate(() => MT.settings.set('link-dash-table-show', true));
  await expect(page.locator('.link-dash-table-wrapper')).toBeVisible();
});

// The shape hint (#294): a node color with more than five values
// (Dismissed toasts stay in the page, hidden, so only the shown ones count)
const hint = () => page.locator('.toast:visible', { hasText: 'hard to tell apart by color alone' });

test('a categorical node color with more than a few values is offered as shapes, once', async () => {
  await page.evaluate(() => MT.settings.set('node-color-variable', 'state'));
  await page.waitForTimeout(400);
  // Six values (five states, and (Empty) for the node the file doesn't give one): no suggestion
  await expect(hint()).toHaveCount(0);
  // Latitude has 18 values: the suggestion is a toast with a button that shows them as shapes
  await page.evaluate(() => MT.settings.set('node-color-variable', 'lat'));
  await expect(hint()).toHaveCount(1);
  await expect(hint()).toContainText(/\d+ values of Lat are hard to tell apart by color alone/);
  const action = hint().locator('.toast-action');
  await expect(action).toHaveText('Show as shapes');
  // Keyboard: the button takes the focus and Enter takes the suggestion
  await action.focus();
  await page.keyboard.press('Enter');
  await expect(hint()).toHaveCount(0);
  expect(await page.evaluate(() => MT.settings.get('node-symbol-variable'))).toBe('lat');
  await expect(page.locator('select[data-setting="node-symbol-variable"]')).toHaveValue('lat');
  // Once per variable: choosing it again, after another, doesn't suggest it again
  await page.evaluate(() => MT.settings.set('node-color-variable', 'state'));
  await page.evaluate(() => MT.settings.set('node-symbol-variable', 'None'));
  await page.evaluate(() => MT.settings.set('node-color-variable', 'lat'));
  await page.waitForTimeout(400);
  await expect(hint()).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('the suggestion is not made when shapes already show a variable, and can be dismissed', async () => {
  await page.evaluate(() => {
    MT.settings.set('node-color-variable', 'None');
    MT.settings.set('node-symbol-variable', 'group');
  });
  await page.evaluate(() => MT.settings.set('node-color-variable', 'lat'));
  await page.waitForTimeout(400);
  await expect(hint()).toHaveCount(0);
  // Dismissed with its close button: nothing changes
  await page.evaluate(() => {
    MT.settings.set('node-symbol-variable', 'None');
    MT.settings.set('node-color-variable', 'None');
  });
  await page.evaluate(() => MT.settings.set('node-color-variable', 'date'));
  await expect(hint()).toHaveCount(1);
  await hint().locator('.toast-close').click();
  await expect(hint()).toHaveCount(0);
  expect(await page.evaluate(() => MT.settings.get('node-symbol-variable'))).toBe('None');
});
