import cookie from '@hapi/cookie'
import { hapiAuthOidcPlugin } from '@defra/hapi-auth-oidc'

import { config } from '#/config/config.js'
import { getCookieOptions } from '../auth/get-cookie-options.js'
import { getOidcOptions } from '../auth/oidc-options.js'

/**
 * Registers Entra ID sign-in and the session auth strategy:
 * - hapi-auth-oidc: decorates the request with login, callback and
 *   ensureValidToken, authenticating to Entra with the client secret
 * - session (cookie): cookie-backed session validation with token refresh
 *
 * Every route registered after this plugin requires a signed-in user with the
 * required Entra app role by default. Public routes must opt out explicitly
 * with auth: false, or auth: { strategy: 'session', mode: 'try' } — naming the
 * strategy stops hapi merging in the default's role check.
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
      server.auth.default({
        strategy: 'session',
        access: { scope: [config.get('auth.requiredRole')] }
      })
    }
  }
}
