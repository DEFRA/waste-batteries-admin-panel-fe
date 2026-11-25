import { expect } from '@playwright/test'

/**
 * The user-facing steps of the auth journeys, written the way the manual
 * checklist describes them.
 */

export async function expectSignedInAs(page, name) {
  await expect(page.getByRole('banner')).toContainText(`Signed in as ${name}`)
  await expect(page.getByRole('link', { name: 'Sign in' })).toHaveCount(0)
}

export async function expectSignedOut(page) {
  await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Sign out' })).toHaveCount(0)
}
