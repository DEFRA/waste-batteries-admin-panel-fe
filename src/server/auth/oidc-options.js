import { WebIdentityTokenProvider } from '@defra/hapi-auth-oidc'

import { config } from '#/config/config.js'
import { createLocalMockProvider } from './local-mock-provider.js'

export const callbackPath = '/auth/callback'

// form_post returns the user from Entra by cross-site POST, which only
// carries SameSite=None cookies (and browsers require Secure alongside None)
export function getCallbackSameSite() {
  return config.get('auth.oidc.responseMode') === 'form_post' ? 'None' : 'Lax'
}

export function getOidcOptions() {
  const { oidc, federatedCredentials } = config.get('auth')

  return {
    oidc: {
      ...oidc,
      useHttp: !config.get('isProduction'),
      loginCallbackUri: callbackPath,
      // CDP: an AWS STS web identity token, as the federated credentials docs
      // describe. Local and CI only: a fake one the Entra stub accepts
      authProvider: federatedCredentials.enableMocking
        ? createLocalMockProvider({
            clientId: oidc.clientId,
            audience: federatedCredentials.audience
          })
        : new WebIdentityTokenProvider({
            audience: federatedCredentials.audience
          })
    },
    cookieOptions: {
      password: config.get('session.cookie.password'),
      isSecure: config.get('session.cookie.secure'),
      isSameSite: getCallbackSameSite()
    }
  }
}
