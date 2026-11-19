// With prefers-reduced-motion, the interface's transitions and looping
// animations stop, and the bubbles settle at once instead of drifting (#191).
const { test, expect } = require('@playwright/test');
const { watchErrors, loadNetwork, launchView } = require('./helpers');

test.describe.configure({ mode: 'serial' });

let page, errors;
test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  errors = watchErrors(page);
  await loadNetwork(page);
});
test.afterAll(() => page.close());

const style = (selector, property) => page.evaluate(([selector, property]) => {
  const el = document.querySelector(selector);
  return getComputedStyle(el)[property];
}, [selector, property]);

test('by default the main panel transitions and the loader loops', async () => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  expect(await page.evaluate(() => MT.reducedMotion())).toBe(false);
  expect(await style('#main-panel', 'transitionDuration')).toBe('0.5s');
  expect(await page.evaluate(() => {
    const el = document.createElement('div');
    el.className = 'ele';
    document.body.appendChild(el);
    const s = getComputedStyle(el);
    const out = [s.animationName, s.animationIterationCount];
    el.remove();
    return out;
  })).toEqual(['run', 'infinite']);
});

test('with reduced motion there are no transitions or looping animations', async () => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await page.evaluate(() => MT.reducedMotion())).toBe(true);
  expect(parseFloat(await style('#main-panel', 'transitionDuration'))).toBeLessThan(0.001);
  expect(await page.evaluate(() => {
    const el = document.createElement('div');
    el.className = 'ele';
    document.body.appendChild(el);
    const s = getComputedStyle(el);
    const out = [s.animationName, s.animationIterationCount];
    el.remove();
    return out;
  })).toEqual(['none', '1']);
});

test('the bubbles are settled as soon as they are drawn', async () => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await launchView(page, 'bubbles');
  const circles = page.locator('svg.bubbles circle, .bubbles circle');
  await expect(circles.first()).toBeVisible();
  const positions = () => circles.evaluateAll(els => els.slice(0, 20).map(e => e.getAttribute('cx') + ',' + e.getAttribute('cy')).join(';'));
  const first = await positions();
  // Waits to see that nothing moves: with reduced motion the bubbles don't animate
  await page.waitForTimeout(700);
  expect(await positions()).toBe(first);
});

test('no errors', () => expect(errors).toEqual([]));
