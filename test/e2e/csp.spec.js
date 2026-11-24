// The content security policy allows no inline scripts (#208). Opening the page
// and every view must not break it, and anything that does (an inline script,
// an event-handler attribute, an eval) fails here by name, not as a vague error.
const { test, expect } = require('@playwright/test');
const { watchErrors, loadNetwork, launchView, closeView } = require('./helpers');

const views = ['network', 'table', 'heatmap', 'histogram', 'scatterplot', 'flow_diagram', 'crosstab', 'aggregation',
  'phylogenetic_tree', 'geo_map', 'globe', 'bubbles', 'gantt', 'timeline', 'waterfall', 'sequences', 'choropleth', 'conflicts', 'files'];

test('the policy has no unsafe-inline in script-src, in the header or the meta tag', async ({ request }) => {
  const response = await request.get('/index.html');
  const header = response.headers()['content-security-policy'];
  const meta = (await response.text()).match(/http-equiv="Content-Security-Policy" content="([^"]*)"/)[1];
  for (const policy of [header, meta]) {
    const script = policy.split(';').map(d => d.trim()).find(d => d.startsWith('script-src'));
    expect(script).toBeTruthy();
    expect(script).not.toContain("'unsafe-inline'");
    expect(script).not.toContain("'unsafe-eval'");
  }
});

test('opening the page and every view raises no policy violation', async ({ page }) => {
  test.setTimeout(240000);
  const errors = watchErrors(page);
  await page.addInitScript(() => {
    window.cspViolations = [];
    document.addEventListener('securitypolicyviolation', e => window.cspViolations.push(e.violatedDirective + ' ' + e.blockedURI + ' ' + e.sourceFile + ':' + e.lineNumber));
  });
  await loadNetwork(page);
  for (const view of views) {
    await launchView(page, view);
    await page.waitForFunction(view => {
      const item = layout.contentItems.find(i => i.componentType === view);
      return item && item.element && !item.ready;
    }, view);
    // A violation can be reported a moment after the view's first frame: wait for it
    await page.waitForTimeout(200);
    if (view !== 'network') await closeView(page, view);
  }
  expect(await page.evaluate(() => window.cspViolations)).toEqual([]);
  expect(errors.filter(e => /Content Security Policy/i.test(e))).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.getAttribute('data-bs-theme'))).toMatch(/^(light|dark)$/);
});
