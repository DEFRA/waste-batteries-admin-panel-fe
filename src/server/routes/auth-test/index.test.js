import { createServer } from '#/server/server.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

describe('#authTest', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  const asUser = (scope) => ({
    method: 'GET',
    url: '/auth-test',
    auth: {
      strategy: 'session',
      credentials: {
        sessionId: 'sid',
        displayName: 'Test Admin',
        email: 'test@example.com',
        scope
      }
    }
  })

  test('Should send a signed-out user to sign in', async () => {
    const { statusCode, headers } = await server.inject('/auth-test')

    expect(statusCode).toBe(302)
    expect(headers.location).toBe('/auth/sign-in?redirect=%2Fauth-test')
  })

  test('Should show the page to a user with the required role', async () => {
    const { statusCode, result } = await server.inject(asUser(['admin']))

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toContain('Test Admin (test@example.com) with roles: admin')
  })

  test('Should refuse a user without the required role', async () => {
    const { statusCode } = await server.inject(asUser([]))

    expect(statusCode).toBe(statusCodes.forbidden)
  })
})
