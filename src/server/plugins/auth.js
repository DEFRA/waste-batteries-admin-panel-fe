import cookie from '@hapi/cookie'

import { getCookieOptions } from '../auth/get-cookie-options.js'

/**
 * Registers the session (cookie) auth strategy: cookie-backed session
 * validation against the server-side session cache.
 *
 * Every route registered after this plugin is authenticated by default —
 * public routes must opt out explicitly (auth: false or mode: 'try').
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
