import { defineConfig, devices } from '@playwright/test'
import { ADMIN_STORAGE_STATE } from './tests/e2e/global-setup'

const baseUrl = process.env.PLAYWRIGHT_BASE_URL

if (!baseUrl) {
  throw new Error('PLAYWRIGHT_BASE_URL fehlt. Tests werden ohne eindeutiges Ziel nicht gestartet.')
}

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30_000,
  expect: { timeout: 8_000 },
  forbidOnly: Boolean(process.env.CI),
  outputDir: 'test-results/artifacts',
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }],
  ],
  use: {
    baseURL: baseUrl,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    storageState: ADMIN_STORAGE_STATE,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
