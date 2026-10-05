import { test, expect } from '@playwright/test'

import { entraStub, signInAtStub, users } from '../../support/entra-stub.js'
import { expectNoTokensInBrowser } from '../../support/invariants.js'
import { expectSignedInAs, expectSignedOut } from '../../support/journeys.js'

/**
 * Signing in through the real sign-in and callback routes, against the local
 * Entra ID stub. Everything on the app side is what runs in CDP; only the
 * identity provider and the client assertion are stand-ins.
 */
test.describe('Sign in', { tag: '@auth' }, () => {
  test('signs in from the header and shows who is signed in', async ({
    page
  }) => {
    await page.goto('/')
    await expectSignedOut(page)

    await page.getByRole('link', { name: 'Sign in' }).click()
    await signInAtStub(page, users.admin)

    await expect(page).toHaveURL('/')
    await expectSignedInAs(page, users.admin.claims.name)
    await expectNoTokensInBrowser(page)
  })

  test('returns to the protected page the user was heading for', async ({
    page
  }) => {
    await page.goto('/e2e/protected?tab=details')
    await signInAtStub(page, users.admin)

    await expect(page).toHaveURL('/e2e/protected?tab=details')
    await expect(page.getByTestId('e2e-page-heading')).toHaveText(
      'Protected page'
    )
  })

  test('a malformed return URL stays inside the app', async ({ page }) => {
    await page.goto(
      `/auth/sign-in?redirect=${encodeURIComponent('/\t/evil.example')}`
    )
    await signInAtStub(page, users.admin)

    await expect(page).toHaveURL('/')
    await expectSignedInAs(page, users.admin.claims.name)
  })

  test('a cancelled authorization response shows the recovery page without signing in', async ({
    page
  }) => {
    const authorization = page.waitForRequest((request) => {
      const url = new URL(request.url())
      return (
        url.origin === entraStub.origin && url.pathname === '/entra/authorize'
      )
    })
    await page.goto('/auth/sign-in')
    const parameters = new URL((await authorization).url()).searchParams
    const callback = new URL(parameters.get('redirect_uri'))
    callback.searchParams.set('state', parameters.get('state'))
    callback.searchParams.set('error', 'access_denied')
    callback.searchParams.set(
      'error_description',
      'fake-private-error-description'
    )

    // The stub has no cancellation button; simulate its OAuth error redirect
    // while retaining the real browser correlation cookie and state.
    const response = await page.goto(callback.toString())
    expect(response.status()).toBe(401)
    await expect(
      page.getByRole('heading', { name: 'We could not sign you in' })
    ).toBeVisible()
    await expect(
      page.getByRole('link', { name: 'Try signing in again' })
    ).toBeVisible()
    expect(await page.content()).not.toContain('fake-private-error-description')
    await page.goto('/')
    await expectSignedOut(page)
  })

  test('signs out of the app and Entra, and protected pages need signing in again', async ({
    page
  }) => {
    await page.goto('/auth/sign-in')
    await signInAtStub(page, users.admin)
    await expectSignedInAs(page, users.admin.claims.name)

    const endSession = page.waitForRequest(
      new RegExp(`^${entraStub.origin}/entra/endsession`)
    )
    await page.getByRole('link', { name: 'Sign out' }).click()

    const endSessionUrl = new URL((await endSession).url())
    expect(endSessionUrl.searchParams.get('id_token_hint')).toBeTruthy()
    await expect(page).toHaveURL('/')
    await expectSignedOut(page)
    await page.goto('/e2e/protected')
    await expect(page).toHaveURL(/^http:\/\/localhost:3210\/entra\//)
  })
})

test.describe('App roles', { tag: '@auth' }, () => {
  const adminOnlyPath = '/e2e/admin-only'

  test('needs the required role on routes with no auth options', async ({
    page
  }) => {
    await page.goto('/e2e/protected')
    await signInAtStub(page, users.noRoles)

    await expect(
      page.getByRole('heading', {
        name: 'You do not have access to this service'
      })
    ).toBeVisible()
  })

  test('lets a user with the Admin role in', async ({ page }) => {
    await page.goto(adminOnlyPath)
    await signInAtStub(page, users.admin)

    await expect(page).toHaveURL(adminOnlyPath)
    await expect(page.getByTestId('e2e-page-heading')).toHaveText('Admin page')
  })

  test('shows the no-access page to a user without it', async ({ page }) => {
    await page.goto(adminOnlyPath)
    await signInAtStub(page, users.noRoles)

    await expect(
      page.getByRole('heading', {
        name: 'You do not have access to this service'
      })
    ).toBeVisible()
    await expectSignedInAs(page, users.noRoles.claims.name)
  })
})
