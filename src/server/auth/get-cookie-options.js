import { config } from '#/config/config.js'
import { toSession } from './session.js'
import { logAuthEvent } from './log-auth-event.js'

export function getCookieOptions() {
  return {
    cookie: {
      name: 'userSession',
      password: config.get('session.cookie.password'),
      path: '/',
      ttl: config.get('session.cookie.ttl'),
      isSecure: config.get('session.cookie.secure'),
      // Lax, not Strict — the callback redirects back into the service with a
      // meta refresh, and Strict would still drop the cookie on that first hop
      isSameSite: 'Lax'
    },
    keepAlive: true,
    redirectTo: (request) =>
      `/auth/sign-in?redirect=${encodeURIComponent(request.url.pathname + request.url.search)}`,
    validate: async function (request, session) {
      const cache = request.server.app.cache
      const cached = await cache.get(session.sessionId)
      if (!cached) {
        return { isValid: false }
      }

      // Absolute cap from sign-in — token refresh and cookie keepAlive are
      // both rolling, so without this a session could live as long as the
      // refresh token. Fails closed on a missing/invalid createdAt.
      const ageMs = Date.now() - Date.parse(cached.createdAt)
      if (Number.isNaN(ageMs) || ageMs > config.get('session.absoluteTtl')) {
        await cache.drop(session.sessionId)
        return { isValid: false }
      }

      try {
        // Returns the cached tokens untouched unless the access token is
        // within a minute of expiry
        const { token, refreshed } = await request.ensureValidToken(cached)
        if (!refreshed) {
          return { isValid: true, credentials: cached }
        }

        const updated = {
          ...cached,
          ...toSession(token),
          // Entra may not rotate the refresh token; keep the old one if it doesn't
          refreshToken: token.refreshToken ?? cached.refreshToken
        }
        await cache.set(session.sessionId, updated)
        logAuthEvent(request, 'auth.refresh', 'succeeded')
        return { isValid: true, credentials: updated }
      } catch {
        logAuthEvent(request, 'auth.refresh', 'failed')
        await cache.drop(session.sessionId)
        return { isValid: false }
      }
    }
  }
}
