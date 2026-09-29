import { defineConfig, devices } from '@playwright/test'

import { appInstances } from './e2e/support/app-instances.js'

/**
 * End-to-end tests.
 *
 * Specs are grouped by area under e2e/journeys — everything so far is
 * e2e/journeys/auth, tagged `@auth`. A new area gets a new folder and tag:
 *
 *   npm run test:e2e -- --grep @auth      just the auth journeys
 *   npm run test:e2e -- --grep-invert @auth   everything else
 *
 * The auth journeys drive the real app, started below. There is no identity
 * provider yet, so they only cover signed-out behaviour.
 * See e2e/support/app-instances.js.
 */
export default defineConfig({
  testDir: './e2e/journeys',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 60000,
  expect: { timeout: 10000 },

  use: {
    ...devices['Desktop Chrome'],
    // The instance a spec gets unless it declares another with test.use
    baseURL: appInstances.app.url,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ignoreHTTPSErrors: false
  },

  webServer: Object.values(appInstances).map((instance) => ({
    // Logs go to a file, uploaded as a CI artefact on failure
    command: `mkdir -p e2e/.logs && node e2e/support/test-server.js > ${instance.logFile} 2>&1`,
    url: `${instance.url}/health`,
    reuseExistingServer: false,
    timeout: 60000,
    env: instance.env
  }))
})
