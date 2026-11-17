// The service worker (#194): it registers and activates, caches everything it
// lists, serves the page with the network down, deletes old caches, and the
// server revalidates files rather than caching them for a year (#211).
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', '..', 'sw.js'), 'utf8');
const precache = JSON.parse(source.match(/const PRECACHE = (\[[\s\S]*?\]);\n/)[1].replace(/,\s*\]$/, ']'));
const cacheName = source.match(/const CACHE = "([^"]+)"/)[1];

test.use({ serviceWorkers: 'allow' });

test('the worker caches every listed file and the app loads offline', async ({ page, context }) => {
  await page.goto('/index.html');
  await page.evaluate(() => navigator.serviceWorker.ready);
  // Installing is done once the (claimed) worker controls the page
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);

  const cached = await page.evaluate(async name => {
    const cache = await caches.open(name);
    return (await cache.keys()).map(r => new URL(r.url).pathname.replace(/^\//, ''));
  }, cacheName);
  for (const file of precache) expect(cached, file).toContain(file);

  // Activating deletes the caches of other versions
  await page.evaluate(async () => {
    await caches.open('microbetrace-old');
    await (await navigator.serviceWorker.getRegistration()).unregister();
  });
  await page.reload();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect.poll(() => page.evaluate(() => caches.keys())).toEqual([cacheName]);

  // A navigation is answered from the cache even online (no new index.html with
  // old scripts): plant a marker in the cached page and see it served
  await page.evaluate(async name => {
    const cache = await caches.open(name);
    await cache.put(new URL('index.html', location.href).href,
      new Response('<title>from the cache</title>', { headers: { 'content-type': 'text/html' } }));
  }, cacheName);
  await page.reload();
  await expect(page).toHaveTitle('from the cache');
  await page.evaluate(async name => {
    const cache = await caches.open(name);
    await cache.put(new URL('index.html', location.href).href, await fetch('index.html?fresh=1', { cache: 'reload' }));
  }, cacheName);

  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('nav.navbar')).toBeVisible();
  await expect(page).toHaveTitle(/MicrobeTrace/);
  await context.setOffline(false);
});

test('files are revalidated, not cached for a year', async ({ request }) => {
  for (const url of ['/index.html', '/src/index.js', '/dist/bundle.primary.js', '/fonts/bootstrap-icons.woff2']) {
    const response = await request.get(url);
    const headers = response.headers();
    expect(headers['cache-control'], url).toBe('no-cache');
    expect(headers['cache-control']).not.toMatch(/immutable/);
    expect(headers.etag || headers['last-modified'], url).toBeTruthy();
  }
});
