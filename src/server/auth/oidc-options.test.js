import { MockProvider, WebIdentityTokenProvider } from '@defra/hapi-auth-oidc'

import { config } from '#/config/config.js'
import { getCallbackSameSite, getOidcOptions } from './oidc-options.js'

describe('#getOidcOptions', () => {
  afterEach(() => {
    config.set('auth.federatedCredentials.enableMocking', true)
    config.set('auth.oidc.responseMode', null)
  })

  test('Should use the mock client assertion when mocking is enabled', () => {
    expect(getOidcOptions().oidc.authProvider).toBeInstanceOf(MockProvider)
  })

  test('Should use an AWS STS web identity token otherwise', () => {
    config.set('auth.federatedCredentials.enableMocking', false)

    const { authProvider } = getOidcOptions().oidc

    expect(authProvider).toBeInstanceOf(WebIdentityTokenProvider)
    expect(authProvider.audience).toEqual(['api://AzureADTokenExchange'])
  })

  test('Should need SameSite=None cookies only for form_post', () => {
    expect(getCallbackSameSite()).toBe('Lax')

    config.set('auth.oidc.responseMode', 'form_post')

    expect(getCallbackSameSite()).toBe('None')
    expect(getOidcOptions().cookieOptions.isSameSite).toBe('None')
  })
})
