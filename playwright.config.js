// Browser regression tests: `npm run test:e2e` (see test/e2e/README.md)
const { defineConfig } = require('@playwright/test');

const port = process.env.E2E_PORT || 5057;

module.exports = defineConfig({
  testDir: 'test/e2e',
  timeout: 180000,
  expect: { timeout: 20000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${port}`,
    viewport: { width: 1400, height: 900 },
    acceptDownloads: true,
    actionTimeout: 20000,
    launchOptions: {
      // A Chromium other than Playwright's own, e.g. a preinstalled one
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
      // WebGL (the 2D, 3D and Pixi views) without a GPU
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
    }
  },
  webServer: {
    command: 'node server.js',
    env: { PORT: String(port) },
    url: `http://localhost:${port}/index.html`,
    reuseExistingServer: !process.env.CI
  }
});
