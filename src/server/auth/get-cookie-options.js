import { config } from '#/config/config.js'

export function getCookieOptions() {
  return {
    cookie: {
      name: 'userSession',
      password: config.get('session.cookie.password'),
      path: '/',
      ttl: config.get('session.cookie.ttl'),
      isSecure: config.get('session.cookie.secure'),
      // Lax, not Strict — the cookie must survive the redirect back from the IdP
      isSameSite: 'Lax'
    },
    keepAlive: true,
    redirectTo: (request) =>
      `/auth/sign-in?redirect=${encodeURIComponent(request.url.pathname + request.url.search)}`,
    validate: async function (request, session) {
      const cached = await request.server.app.cache.get(session.sessionId)
      if (!cached) {
        return { isValid: false }
      }

      // Absolute cap from sign-in — cookie keepAlive is rolling, so without
      // this a session could live indefinitely. Fails closed on a
      // missing/invalid createdAt.
      const ageMs = Date.now() - Date.parse(cached.createdAt)
      if (Number.isNaN(ageMs) || ageMs > config.get('session.absoluteTtl')) {
        await request.server.app.cache.drop(session.sessionId)
        return { isValid: false }
      }

      // ponytail: no token refresh, so the session ends with the access token.
      // Fails closed on a missing/invalid expiresAt
      if (!(Date.parse(cached.expiresAt) > Date.now())) {
        await request.server.app.cache.drop(session.sessionId)
        return { isValid: false }
      }

      return { isValid: true, credentials: cached }
    }
  }
}
