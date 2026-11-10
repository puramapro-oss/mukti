import { defineConfig } from '@playwright/test'

const browserName = process.env.AURORA_BROWSER === 'chromium' ? 'chromium' : 'firefox'

export default defineConfig({
  testDir: '.',
  testMatch: 'ritual.browser.spec.ts',
  timeout: 120000,
  expect: { timeout: 15000 },
  workers: 1,
  maxFailures: 1,
  reporter: 'list',
  outputDir: '../test-results',
  use: { baseURL: 'http://127.0.0.1:4178', browserName, channel: browserName === 'chromium' ? 'chromium' : undefined, headless: true, screenshot: 'only-on-failure' },
  webServer: {
    command: 'npm run dev:browser',
    url: 'http://127.0.0.1:4178',
    reuseExistingServer: false,
    timeout: 120000,
  },
})
