import { config } from '#/config/config.js'

export const callbackPath = '/auth/callback'

// form_post returns the user from Entra by cross-site POST, which only
// carries SameSite=None cookies (and browsers require Secure alongside None)
export function getCallbackSameSite() {
  return config.get('auth.oidc.responseMode') === 'form_post' ? 'None' : 'Lax'
}

export function getOidcOptions() {
  const { oidc, clientSecret } = config.get('auth')
  if (!clientSecret) {
    throw new Error('ENTRA_CLIENT_SECRET must be set')
  }

  return {
    oidc: {
      ...oidc,
      useHttp: !config.get('isProduction'),
      loginCallbackUri: callbackPath,
      // The library's client secret provider shape: sent to Entra's token
      // endpoint as client_secret_post
      authProvider: {
        type: 'client_secret',
        getCredentials: async (_logger) => clientSecret
      }
    },
    cookieOptions: {
      password: config.get('session.cookie.password'),
      isSecure: config.get('session.cookie.secure'),
      isSameSite: getCallbackSameSite()
    }
  }
}
