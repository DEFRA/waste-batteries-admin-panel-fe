import { expect } from '@playwright/test'

/**
 * The local Entra ID stub (navikt/mock-oauth2-server, the `entra-stub` service
 * in compose.yml). The app is pointed at it instead of real Entra, and it
 * issues tokens with whatever claims the sign-in form is given.
 * See "Signing in locally and in CI" in the README.
 */

export const entraStub = {
  origin: 'http://localhost:3210',
  discoveryUri: 'http://localhost:3210/entra/.well-known/openid-configuration'
}

/**
 * Users the journeys sign in as. The claims are the ones Entra puts in this
 * app's ID token: `roles` holds the Entra app roles assigned to the user.
 */
export const users = {
  admin: {
    username: 'e2e-admin',
    claims: {
      oid: 'e2e00000-0000-0000-0000-000000000001',
      name: 'E2E Admin',
      preferred_username: 'e2e.admin@defra.onmicrosoft.com',
      roles: ['Admin']
    }
  },
  noRoles: {
    username: 'e2e-no-roles',
    claims: {
      oid: 'e2e00000-0000-0000-0000-000000000002',
      name: 'E2E No Roles',
      preferred_username: 'e2e.no-roles@defra.onmicrosoft.com',
      roles: []
    }
  }
}

/** Completes the stub's sign-in form. The page must already be on it. */
export async function signInAtStub(page, user) {
  await expect(page).toHaveURL(new RegExp(`^${entraStub.origin}/entra/`))
  await page.getByLabel('Username').fill(user.username)
  await page
    .getByLabel('ID token claims (JSON)')
    .fill(JSON.stringify(user.claims))
  await page.getByRole('button', { name: 'Sign in' }).click()
}
