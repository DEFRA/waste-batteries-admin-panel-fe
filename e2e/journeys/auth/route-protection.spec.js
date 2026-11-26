import { test, expect } from '@playwright/test'

import { redirectTarget } from '../../support/http.js'

/**
 * The server-wide auth default. /auth-test has no auth options at all, which
 * is exactly how a new application route arrives.
 */
test.describe('Route protection', { tag: '@auth' }, () => {
  const protectedPath = '/auth-test'

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
