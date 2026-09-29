import { createServer } from '../../server.js'

describe('auth routes', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  describe('GET /auth/sign-out', () => {
    test('Should redirect home when there is no session', async () => {
      const { statusCode, headers } = await server.inject({
        method: 'GET',
        url: '/auth/sign-out'
      })

      expect(statusCode).toBe(302)
      expect(headers.location).toBe('/')
    })

    test('Should drop the session, clear the cookie and redirect home', async () => {
      await server.app.cache.set('session-1', { sessionId: 'session-1' })

      const { statusCode, headers } = await server.inject({
        method: 'GET',
        url: '/auth/sign-out',
        auth: {
          strategy: 'session',
          credentials: { sessionId: 'session-1' }
        }
      })

      expect(statusCode).toBe(302)
      expect(headers.location).toBe('/')
      expect(await server.app.cache.get('session-1')).toBeNull()

      const sessionCookie = headers['set-cookie'].find((cookie) =>
        cookie.startsWith('userSession=')
      )
      expect(sessionCookie).toContain('Max-Age=0')
    })
  })
})
