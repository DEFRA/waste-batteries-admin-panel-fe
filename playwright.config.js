import { defineConfig, devices } from '@playwright/test'

import { appInstances } from './e2e/support/app-instances.js'
import { entraStub } from './e2e/support/entra-stub.js'

/**
 * End-to-end tests.
 *
 * Specs are grouped by area under e2e/journeys — everything so far is
 * e2e/journeys/auth, tagged `@auth`. A new area gets a new folder and tag:
 *
 *   npm run test:e2e -- --grep @auth      just the auth journeys
 *   npm run test:e2e -- --grep-invert @auth   everything else
 *
 * The auth journeys drive the real app, started below, and sign in against
 * the local Entra ID stub from compose.yml. Playwright starts the stub with
 * `docker compose up` unless it is already running (CI starts it first).
 * See e2e/support/app-instances.js and e2e/support/entra-stub.js.
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

  webServer: [
    {
      // Needs Docker. Reused if already up, e.g. from `docker compose up -d`
      command: 'docker compose up entra-stub',
      url: entraStub.discoveryUri,
      reuseExistingServer: true,
      // The first run pulls the image
      timeout: 300000
    },
    ...Object.values(appInstances).map((instance) => ({
      // Logs go to a file, uploaded as a CI artefact on failure.
      // run-test-server.js does the redirect in Node so this works on Windows.
      command: 'node e2e/support/run-test-server.js',
      url: `${instance.url}/health`,
      reuseExistingServer: false,
      timeout: 60000,
      env: {
        ...instance.env,
        E2E_LOG_FILE: instance.logFile
      }
    }))
  ]
})
