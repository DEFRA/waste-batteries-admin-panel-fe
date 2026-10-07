import { test, expect } from '@playwright/test'

/**
 * Manual checklist phase 0 — environment up.
 */
test.describe('Environment', { tag: '@auth' }, () => {
  test('the app is up and serving its health check', async ({ request }) => {
    const response = await request.get('/health')

    expect(response.status()).toBe(200)
  })
})
