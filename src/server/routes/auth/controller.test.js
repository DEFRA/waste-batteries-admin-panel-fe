import Boom from '@hapi/boom'
import { vi } from 'vitest'

import { createServer } from '../../server.js'
import { resetEndSessionEndpoint } from '../../auth/end-session.js'

// Cookies from one response, as a Cookie header for the next request
function cookiesFrom(response) {
  return [response.headers['set-cookie'] ?? []]
    .flat()
    .map((cookie) => cookie.split(';')[0])
    .join('; ')
}

describe('auth routes', () => {
  let server
  let oidc

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
    // The request decorations call through these, so replacing them stands in
    // for Entra without any network
    oidc = server.plugins['hapi-auth-oidc'].oidc
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  beforeEach(() => {
    vi.spyOn(oidc, 'login').mockImplementation((_request, h) =>
      h.redirect('https://login.example/authorize').takeover()
    )
    vi.spyOn(oidc, 'ensureValidToken').mockImplementation(
      async (_request, token) => ({ token, refreshed: false })
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function signIn(redirect) {
    return server.inject({
      method: 'GET',
      url: `/auth/sign-in?redirect=${encodeURIComponent(redirect)}`
    })
  }

  describe('GET /auth/sign-in', () => {
    test('Should hand off to Entra', async () => {
      const { statusCode, headers } = await signIn('/about')

      expect(statusCode).toBe(302)
      expect(headers.location).toBe('https://login.example/authorize')
      expect(oidc.login).toHaveBeenCalled()
    })
  })

  describe('callback', () => {
    const credentials = {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresIn: 3600,
      claims: {
        oid: 'oid-1',
        name: 'Jo Bloggs',
        preferred_username: 'jo.bloggs@defra.gov.uk',
        roles: ['admin']
      }
    }

    test.each(['GET', 'POST'])(
      'Should create a session and return the user to where they were going (%s)',
      async (method) => {
        vi.spyOn(oidc, 'callback').mockResolvedValue(credentials)
        const signInResponse = await signIn('/about?tab=a&b=c')

        const response = await server.inject({
          method,
          url: '/auth/callback',
          headers: {
            cookie: cookiesFrom(signInResponse),
            ...(method === 'POST' && {
              'content-type': 'application/x-www-form-urlencoded'
            })
          },
          ...(method === 'POST' && { payload: 'code=abc&state=xyz' })
        })

        expect(response.statusCode).toBe(200)
        // Escaped, so the redirect path cannot break out of the attribute
        expect(response.result).toContain(
          '<meta http-equiv="refresh" content="0;url=/about?tab=a&amp;b=c">'
        )

        const sessionCookie = response.headers['set-cookie'].find((cookie) =>
          cookie.startsWith('userSession=')
        )
        expect(sessionCookie).toContain('HttpOnly')
        expect(sessionCookie).toContain('SameSite=Lax')

        const home = await server.inject({
          method: 'GET',
          url: '/',
          headers: { cookie: cookiesFrom(response) }
        })
        expect(home.result).toContain('Jo Bloggs')
        expect(home.result).toContain('jo.bloggs@defra.gov.uk')
      }
    )

    test('Should never send the user back into /auth/', async () => {
      vi.spyOn(oidc, 'callback').mockResolvedValue(credentials)
      const signInResponse = await signIn('/auth/callback')

      const { result } = await server.inject({
        method: 'GET',
        url: '/auth/callback',
        headers: { cookie: cookiesFrom(signInResponse) }
      })

      expect(result).toContain('content="0;url=/"')
    })

    test('Should render the sign-in failure page when Entra refuses', async () => {
      vi.spyOn(oidc, 'callback').mockRejectedValue(
        Boom.unauthorized('access_denied')
      )

      const { statusCode, result, headers } = await server.inject({
        method: 'GET',
        url: '/auth/callback?error=access_denied&error_description=secret'
      })

      expect(statusCode).toBe(401)
      expect(result).toContain('We could not sign you in')
      expect(result).not.toContain('secret')
      expect(headers['set-cookie'] ?? []).not.toContainEqual(
        expect.stringMatching(/^userSession=/)
      )
    })
  })

  describe('GET /auth/sign-out', () => {
    const endSessionEndpoint = 'https://login.example/oauth2/v2.0/logout'

    beforeEach(() => {
      resetEndSessionEndpoint()
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        Response.json({ end_session_endpoint: endSessionEndpoint })
      )
    })

    function signOut(credentials) {
      return server.inject({
        method: 'GET',
        url: '/auth/sign-out',
        ...(credentials && { auth: { strategy: 'session', credentials } })
      })
    }

    test('Should redirect home when there is no session', async () => {
      const { statusCode, headers } = await signOut()

      expect(statusCode).toBe(302)
      expect(headers.location).toBe('/')
      expect(fetch).not.toHaveBeenCalled()
    })

    test('Should drop the session, clear the cookie and end the Entra session', async () => {
      await server.app.cache.set('session-1', { sessionId: 'session-1' })

      const { statusCode, headers } = await signOut({
        sessionId: 'session-1',
        idToken: 'id-token'
      })

      expect(statusCode).toBe(302)
      const location = new URL(headers.location)
      expect(`${location.origin}${location.pathname}`).toBe(endSessionEndpoint)
      expect(Object.fromEntries(location.searchParams)).toEqual({
        client_id: 'local-client-id',
        post_logout_redirect_uri: 'http://localhost:3000/',
        id_token_hint: 'id-token'
      })
      expect(await server.app.cache.get('session-1')).toBeNull()

      const sessionCookie = headers['set-cookie'].find((cookie) =>
        cookie.startsWith('userSession=')
      )
      expect(sessionCookie).toContain('Max-Age=0')
    })

    test('Should still sign out locally when Entra discovery fails', async () => {
      fetch.mockRejectedValue(new Error('fetch failed'))
      await server.app.cache.set('session-2', { sessionId: 'session-2' })

      const { statusCode, headers } = await signOut({ sessionId: 'session-2' })

      expect(statusCode).toBe(302)
      expect(headers.location).toBe('/')
      expect(await server.app.cache.get('session-2')).toBeNull()
    })
  })
})
