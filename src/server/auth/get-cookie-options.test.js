import { vi } from 'vitest'

import { getCookieOptions } from './get-cookie-options.js'

function buildRequest(cached, ensureValidToken = vi.fn()) {
  return {
    server: {
      logger: { info: vi.fn() },
      app: {
        cache: {
          get: vi.fn().mockResolvedValue(cached),
          set: vi.fn(),
          drop: vi.fn()
        }
      }
    },
    ensureValidToken,
    info: { id: 'request-1' },
    logger: { info: vi.fn() }
  }
}

function freshSession(overrides = {}) {
  return {
    sessionId: 'sid',
    accessToken: 'old-access',
    refreshToken: 'old-refresh',
    displayName: 'Jo Bloggs',
    createdAt: new Date().toISOString(),
    ...overrides
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

    test('Should be valid without saving when the token needs no refresh', async () => {
      const cached = freshSession()
      const request = buildRequest(
        cached,
        vi.fn().mockResolvedValue({ token: cached, refreshed: false })
      )

      expect(await options.validate(request, { sessionId: 'sid' })).toEqual({
        isValid: true,
        credentials: cached
      })
      expect(request.ensureValidToken).toHaveBeenCalledWith(cached)
      expect(request.server.app.cache.set).not.toHaveBeenCalled()
    })

    test('Should save the refreshed tokens and profile', async () => {
      const request = buildRequest(
        freshSession(),
        vi.fn().mockResolvedValue({
          refreshed: true,
          token: {
            accessToken: 'new-access',
            // no refreshToken — Entra may not rotate it
            claims: { oid: 'oid-1', name: 'Jo Smith', roles: ['admin'] }
          }
        })
      )

      const result = await options.validate(request, { sessionId: 'sid' })

      expect(result.isValid).toBe(true)
      expect(result.credentials).toMatchObject({
        sessionId: 'sid',
        accessToken: 'new-access',
        refreshToken: 'old-refresh',
        displayName: 'Jo Smith',
        scope: ['admin']
      })
      expect(request.server.app.cache.set).toHaveBeenCalledWith(
        'sid',
        result.credentials
      )
    })

    test('Should keep the cached profile when the refresh returns no claims', async () => {
      const request = buildRequest(
        freshSession(),
        vi.fn().mockResolvedValue({
          refreshed: true,
          token: { accessToken: 'new-access', refreshToken: 'new-refresh' }
        })
      )

      const result = await options.validate(request, { sessionId: 'sid' })

      expect(result.credentials).toMatchObject({
        accessToken: 'new-access',
        refreshToken: 'new-refresh',
        displayName: 'Jo Bloggs'
      })
    })

    test('Should drop the session when refresh fails', async () => {
      const request = buildRequest(
        freshSession(),
        vi.fn().mockRejectedValue(new Error('invalid_grant'))
      )

      expect(await options.validate(request, { sessionId: 'sid' })).toEqual({
        isValid: false
      })
      expect(request.server.app.cache.drop).toHaveBeenCalledWith('sid')
    })

    test('Should drop the session once past the absolute session ttl', async () => {
      const request = buildRequest(
        freshSession({
          createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString()
        })
      )

      expect(await options.validate(request, { sessionId: 'sid' })).toEqual({
        isValid: false
      })
      expect(request.server.app.cache.drop).toHaveBeenCalledWith('sid')
      expect(request.ensureValidToken).not.toHaveBeenCalled()
    })

    test('Should treat a session without createdAt as expired', async () => {
      const request = buildRequest(freshSession({ createdAt: undefined }))

      expect(await options.validate(request, { sessionId: 'sid' })).toEqual({
        isValid: false
      })
      expect(request.server.app.cache.drop).toHaveBeenCalledWith('sid')
    })
  })
})
