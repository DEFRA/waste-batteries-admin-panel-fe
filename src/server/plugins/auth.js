import cookie from '@hapi/cookie'

import { getCookieOptions } from '../auth/get-cookie-options.js'

/**
 * Defra ID sign-in is disabled until Entra ID replaces it (EB-181). Only the
 * cookie session strategy is registered, so no IdP is contacted at startup.
 * Public routes still render; routes that need a session redirect to sign-in.
 */
export const auth = {
  plugin: {
    name: 'auth',
    register: async function (server) {
      await server.register(cookie)
      server.auth.strategy('session', 'cookie', getCookieOptions())
      server.auth.default('session')
    }
  }
}
