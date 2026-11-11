import { defineConfig, devices } from '@playwright/test'
import { fileURLToPath } from 'node:url'
const here = (path: string) => fileURLToPath(new URL(path, import.meta.url))
const extraArgs: unknown = process.env.MUKTI_TEST_CHROMIUM_ARGS
  ? JSON.parse(process.env.MUKTI_TEST_CHROMIUM_ARGS) : []
if (!Array.isArray(extraArgs) || !extraArgs.every(value => typeof value === 'string')) {
  throw new Error('MUKTI_TEST_CHROMIUM_ARGS must be a JSON array of Chromium arguments.')
}
export default defineConfig({
  testDir: here('.'), testMatch: ['ui.spec.ts', 'ritual.browser.spec.ts', 'widget.browser.spec.ts'], fullyParallel: false, workers: 1, retries: 0,
  timeout: 45_000, expect: { timeout: 10_000 },
  outputDir: here('./test-results'),
  reporter: [['list'], ['json', { outputFile: here('./test-results/results.json') }]],
  use: {
    ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:4173',
    permissions: ['microphone'], serviceWorkers: 'block',
    trace: 'retain-on-failure', screenshot: 'only-on-failure',
    launchOptions: {
      ...(process.env.MUKTI_TEST_CHROMIUM_PATH ? { executablePath: process.env.MUKTI_TEST_CHROMIUM_PATH } : {}),
      args: [...extraArgs, '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
    },
  },
  webServer: {
    command: 'node ../node_modules/vite/bin/vite.js --config vite.config.ts',
    cwd: here('.'), url: 'http://127.0.0.1:4173', reuseExistingServer: false, timeout: 90_000,
  },
})
