// Browser regression tests: `npm run test:e2e` (see test/e2e/README.md)
const { defineConfig } = require('@playwright/test');

const port = process.env.E2E_PORT || 5057;
const ci = !!process.env.CI;

module.exports = defineConfig({
  testDir: 'test/e2e',
  timeout: 90000, // slowest test today is ~24 s (failing ones wait out a 20 s expect)
  expect: { timeout: 20000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: ci,
  retries: ci ? 1 : 0,
  reporter: ci ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: `http://localhost:${port}`,
    viewport: { width: 1400, height: 900 },
    acceptDownloads: true,
    // The service worker has its own spec (service-worker.spec.js); elsewhere it
    // would only add a first-load precache of every file to each test
    serviceWorkers: 'block',
    trace: 'on-first-retry',
    actionTimeout: 20000,
    launchOptions: {
      // A Chromium other than Playwright's own, e.g. a preinstalled one
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
      // WebGL (the 2D, 3D and Pixi views) without a GPU
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
    }
  },
  webServer: {
    // A fresh clone has no dist/ or sw.js: build them first (#325)
    command: 'node scripts/ensure-built.js && node server.js',
    env: { PORT: String(port) },
    url: `http://localhost:${port}/index.html`,
    reuseExistingServer: !process.env.CI,
    timeout: 240000 // the first start bundles dist/
  }
});
