import cookie from '@hapi/cookie'
import { hapiAuthOidcPlugin } from '@defra/hapi-auth-oidc'

import { getCookieOptions } from '../auth/get-cookie-options.js'
import { getOidcOptions } from '../auth/oidc-options.js'

/**
 * Registers Entra ID sign-in and the session auth strategy:
 * - hapi-auth-oidc: decorates the request with login, callback and
 *   ensureValidToken (federated credentials, no client secret)
 * - session (cookie): cookie-backed session validation with token refresh
 *
 * Every route registered after this plugin is authenticated by default —
 * public routes must opt out explicitly (auth: false or mode: 'try').
 */
export const auth = {
  plugin: {
    name: 'auth',
    register: async function (server) {
      await server.register([
        cookie,
        { plugin: hapiAuthOidcPlugin, options: getOidcOptions() }
      ])
      server.auth.strategy('session', 'cookie', getCookieOptions())
      server.auth.default('session')
    }
  }
}
