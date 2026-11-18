// The default palette is colour-blind safe (Okabe-Ito), and a variable with
// more values than the palette has colours gets distinct shades, not repeats,
// and a warning (#183). A session that saved its own colours keeps them.
const { test, expect } = require('@playwright/test');
const { watchErrors, loadNetwork } = require('./helpers');

test.describe.configure({ mode: 'serial' });

let page, errors;
test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  errors = watchErrors(page);
  await loadNetwork(page);
});
test.afterAll(() => page.close());

test('the default node and link palettes are Okabe-Ito', async () => {
  const palettes = await page.evaluate(() => ({ node: session.style.nodeColors, link: session.style.linkColors, ok: MT.COLOR_BLIND_SAFE }));
  expect(palettes.node).toEqual(palettes.ok);
  expect(palettes.link).toEqual(palettes.ok);
  expect(palettes.ok).toContain('#0072b2');
  expect(palettes.ok).not.toContain('#2ca02c');
});

test('a palette stretched past its colours has no repeats, and says so once', async () => {
  const result = await page.evaluate(() => {
    const base = MT.COLOR_BLIND_SAFE;
    const before = document.querySelectorAll('.toast').length;
    const out = MT.extendPalette(base, 30, 'node', 'palette-test');
    MT.extendPalette(base, 30, 'node', 'palette-test');
    return { out, base, same: MT.extendPalette(base, 5), toasts: document.querySelectorAll('.toast').length - before };
  });
  expect(result.out).toHaveLength(30);
  expect(new Set(result.out).size).toBe(30);
  expect(result.out.slice(0, 8)).toEqual(result.base);
  expect(result.same).toEqual(result.base);
  expect(result.toasts).toBe(1);
});

test('a session that saved its own colours keeps them', async () => {
  const kept = await page.evaluate(() => {
    session.style.nodeColorsTable = { cluster: ['#1f77b4', '#ff7f0e', '#2ca02c'] };
    session.style.widgets['node-color-variable'] = 'cluster';
    MT.createNodeColorMap();
    return session.style.nodeColorsTable.cluster.slice(0, 3);
  });
  expect(kept).toEqual(['#1f77b4', '#ff7f0e', '#2ca02c']);
});

test('no errors', () => expect(errors).toEqual([]));
