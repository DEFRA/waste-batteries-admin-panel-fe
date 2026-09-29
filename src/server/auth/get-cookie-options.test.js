import { vi } from 'vitest'

import { getCookieOptions } from './get-cookie-options.js'

function buildRequest(cached) {
  return {
    server: {
      app: {
        cache: {
          get: vi.fn().mockResolvedValue(cached),
          drop: vi.fn()
        }
      }
    }
  }
}

describe('#getCookieOptions', () => {
  const options = getCookieOptions()

  test('Should use a Lax session cookie', () => {
    expect(options.cookie.isSameSite).toBe('Lax')
    expect(options.cookie.name).toBe('userSession')
  })

  test('Should redirect to sign-in with the original path preserved', () => {
    const request = { url: { pathname: '/tasks/42', search: '?tab=all' } }

    expect(options.redirectTo(request)).toBe(
      '/auth/sign-in?redirect=%2Ftasks%2F42%3Ftab%3Dall'
    )
  })

  describe('validate', () => {
    test('Should be invalid when the session is not in the cache', async () => {
      const request = buildRequest(null)

      expect(await options.validate(request, { sessionId: 'gone' })).toEqual({
        isValid: false
      })
    })

    test('Should be valid before the access token expires', async () => {
      const cached = {
        sessionId: 'sid',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString()
      }
      const request = buildRequest(cached)

      expect(await options.validate(request, { sessionId: 'sid' })).toEqual({
        isValid: true,
        credentials: cached
      })
    })

    test('Should drop the session once the access token has expired', async () => {
      const cached = {
        sessionId: 'sid',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() - 1000).toISOString()
      }
      const request = buildRequest(cached)

      expect(await options.validate(request, { sessionId: 'sid' })).toEqual({
        isValid: false
      })
      expect(request.server.app.cache.drop).toHaveBeenCalledWith('sid')
    })

    test('Should treat a session without expiresAt as expired', async () => {
      const cached = { sessionId: 'sid', createdAt: new Date().toISOString() }
      const request = buildRequest(cached)

      expect(await options.validate(request, { sessionId: 'sid' })).toEqual({
        isValid: false
      })
      expect(request.server.app.cache.drop).toHaveBeenCalledWith('sid')
    })

    test('Should drop the session once past the absolute session ttl', async () => {
      const cached = {
        sessionId: 'sid',
        createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString()
      }
      const request = buildRequest(cached)

      expect(await options.validate(request, { sessionId: 'sid' })).toEqual({
        isValid: false
      })
      expect(request.server.app.cache.drop).toHaveBeenCalledWith('sid')
    })

    test('Should treat a session without createdAt as expired', async () => {
      const cached = {
        sessionId: 'sid',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString()
      }
      const request = buildRequest(cached)

      expect(await options.validate(request, { sessionId: 'sid' })).toEqual({
        isValid: false
      })
      expect(request.server.app.cache.drop).toHaveBeenCalledWith('sid')
    })
  })
})
