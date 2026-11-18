// Browser support is checked by feature (#232): a browser without WebAssembly or
// Web Workers gets the "Sorry!" message naming what it lacks, and a capable one
// gets no message at all.
const { test, expect } = require('@playwright/test');

test('a browser with every feature gets no unsupported-browser message', async ({ page }) => {
  await page.goto('/index.html');
  await expect(page.locator('#unsupported-browser')).toHaveCount(0);
});

for (const [global, label] of [['WebAssembly', 'WebAssembly'], ['Worker', 'Web Workers']]) {
  test(`a browser without ${label} is told so`, async ({ page }) => {
    await page.addInitScript(name => { delete window[name]; }, global);
    await page.goto('/index.html');
    const box = page.locator('#unsupported-browser');
    await expect(box).toHaveClass(/shown/);
    await expect(box).toContainText(`(it lacks ${label})`);
    await expect(box).toContainText('Sorry!');
  });
}
