// src/binder.js on every control type it supports, against the real settings
// store.
const { test, expect } = require('@playwright/test');
const { watchErrors, open } = require('./helpers');

test.describe.configure({ mode: 'serial' });

let page, errors;
test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  errors = watchErrors(page);
  await open(page);
  await page.evaluate(() => {
    Object.assign(session.style.widgets, { 't-select': 'b', 't-range': 7, 't-check': true, 't-flag': false });
    const root = document.createElement('div');
    root.id = 'binder-test';
    root.style.cssText = 'position: fixed; top: 0; left: 0; z-index: 100000; background: #fff; padding: 8px;';
    root.innerHTML = `
      <select data-setting="t-select"><option>a</option><option>b</option><option>c</option></select>
      <input type="range" data-setting="t-range" min="0" max="10">
      <input type="number" data-setting="t-number" value="3">
      <input type="text" data-setting="t-text" value="hello">
      <input type="checkbox" data-setting="t-check">
      <div class="btn-group btn-group-toggle" data-toggle="buttons">
        <label class="btn btn-light active" id="on"><input type="radio" name="t-flag" data-setting="t-flag" value="true" checked> On</label>
        <label class="btn btn-light" id="off"><input type="radio" name="t-flag" data-setting="t-flag" value="false"> Off</label>
      </div>`;
    document.body.prepend(root);
    window.unbindTest = MTBind(root, MT.settings);
  });
});
test.afterAll(() => page.close());

const widget = key => page.evaluate(key => session.style.widgets[key], key);
const root = () => page.locator('#binder-test');

test('controls show the stored values', async () => {
  await expect(root().locator('select')).toHaveValue('b');
  await expect(root().locator('input[type=range]')).toHaveValue('7');
  await expect(root().locator('input[type=checkbox]')).toBeChecked();
  // t-flag is false: Off is checked and its label active, despite the markup
  await expect(root().locator('input[value=false]')).toBeChecked();
  await expect(root().locator('#off')).toHaveClass(/active/);
  await expect(root().locator('#on')).not.toHaveClass(/active/);
});

test('settings with no stored value take the control\'s initial value', async () => {
  expect(await widget('t-number')).toBe(3);
  expect(await widget('t-text')).toBe('hello');
});

test('user changes are stored with their types', async () => {
  await root().locator('select').selectOption('c');
  expect(await widget('t-select')).toBe('c');
  await root().locator('input[type=range]').fill('4');
  expect(await widget('t-range')).toBe(4);
  await root().locator('input[type=number]').fill('12');
  expect(await widget('t-number')).toBe(12);
  await root().locator('input[type=text]').fill('world');
  expect(await widget('t-text')).toBe('world');
  await root().locator('input[type=checkbox]').uncheck();
  expect(await widget('t-check')).toBe(false);
  await root().locator('#on').click();
  expect(await widget('t-flag')).toBe(true);
  await expect(root().locator('#on')).toHaveClass(/active/);
  await expect(root().locator('#off')).not.toHaveClass(/active/);
});

test('settings changed elsewhere show in the controls', async () => {
  await page.evaluate(() => { MT.settings.set('t-select', 'a'); MT.settings.set('t-flag', false); MT.settings.set('t-check', true); });
  await expect(root().locator('select')).toHaveValue('a');
  await expect(root().locator('input[value=false]')).toBeChecked();
  await expect(root().locator('#off')).toHaveClass(/active/);
  await expect(root().locator('input[type=checkbox]')).toBeChecked();
});

test('unbinding disconnects controls and settings', async () => {
  await page.evaluate(() => window.unbindTest());
  await root().locator('select').selectOption('b');
  expect(await widget('t-select')).toBe('a');
  await page.evaluate(() => MT.settings.set('t-select', 'c'));
  await expect(root().locator('select')).toHaveValue('b');
  expect(errors).toEqual([]);
});
