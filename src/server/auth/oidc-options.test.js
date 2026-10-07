import { config } from '#/config/config.js'
import { getCallbackSameSite, getOidcOptions } from './oidc-options.js'

describe('#getOidcOptions', () => {
  afterEach(() => {
    config.set('auth.clientSecret', 'local-client-secret')
    config.set('auth.oidc.responseMode', null)
  })

  test('Should authenticate to Entra with the client secret', async () => {
    const { authProvider } = getOidcOptions().oidc

    expect(authProvider.type).toBe('client_secret')
    expect(await authProvider.getCredentials()).toBe('local-client-secret')
  })

  test('Should refuse to start without a client secret', () => {
    config.set('auth.clientSecret', null)

    expect(() => getOidcOptions()).toThrow('ENTRA_CLIENT_SECRET must be set')
  })

  test('Should need SameSite=None cookies only for form_post', () => {
    expect(getCallbackSameSite()).toBe('Lax')

    config.set('auth.oidc.responseMode', 'form_post')

    expect(getCallbackSameSite()).toBe('None')
    expect(getOidcOptions().cookieOptions.isSameSite).toBe('None')
  })
})
