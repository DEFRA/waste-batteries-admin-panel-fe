import { test, expect } from '@playwright/test'

import { redirectTarget } from '../../support/http.js'

/**
 * Manual checklist phase 4 — the server-wide auth default.
 *
 * Home and about are deliberately public, so this drives /e2e/protected: a
 * route registered by the test harness with no auth options at all, which is
 * exactly how a new application route would arrive.
 */
test.describe('Route protection', { tag: '@auth' }, () => {
  const protectedPath = '/e2e/protected'

  test('sends a signed-out visitor to sign in, remembering where they were going', async ({
    request
  }) => {
    const response = await request.get(protectedPath, { maxRedirects: 0 })

    expect(response.status()).toBe(302)
    expect(redirectTarget(response).pathname).toBe('/auth/sign-in')
    expect(redirectTarget(response).searchParams.get('redirect')).toBe(
      protectedPath
    )
  })
})
