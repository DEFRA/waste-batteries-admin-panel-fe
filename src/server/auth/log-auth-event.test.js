import {
  describeAuthError,
  logAuthEvent,
  withAuthErrorLogging
} from './log-auth-event.js'

function fakeRequest() {
  const info = vi.fn()
  return {
    info,
    request: {
      info: { id: 'request-id' },
      logger: 'original-logger',
      server: { logger: { info } }
    }
  }
}

describe('#describeAuthError', () => {
  test('Should keep only codes from an Entra error response', () => {
    expect(
      describeAuthError({
        error: 'invalid_client',
        error_description:
          'AADSTS7000215: Invalid client secret provided. Trace ID: abc',
        code: 'OAUTH_RESPONSE_BODY_ERROR',
        status: 401
      })
    ).toBe('invalid_client, AADSTS7000215, OAUTH_RESPONSE_BODY_ERROR, HTTP 401')
  })

  test('Should name the claim when ID token validation fails', () => {
    expect(
      describeAuthError({
        code: 'OAUTH_JWT_CLAIM_COMPARISON_FAILED',
        claim: 'aud'
      })
    ).toBe('OAUTH_JWT_CLAIM_COMPARISON_FAILED, claim aud')
  })

  test('Should fall back to the error name, never the message', () => {
    expect(describeAuthError(new TypeError('secret-ish detail'))).toBe(
      'TypeError'
    )
  })

  test('Should cope with nothing being logged', () => {
    expect(describeAuthError(undefined)).toBeUndefined()
  })
})

describe('#logAuthEvent', () => {
  test('Should put the event, outcome and reason in the message', () => {
    const { request, info } = fakeRequest()

    logAuthEvent(request, 'auth.login', 'failed', 'invalid_client')

    expect(info).toHaveBeenCalledWith(
      { event: 'auth.login', outcome: 'failed', requestId: 'request-id' },
      'Authentication event: auth.login failed (invalid_client)'
    )
  })
})

describe('#withAuthErrorLogging', () => {
  test('Should return the result and restore the request logger', async () => {
    const { request, info } = fakeRequest()

    const result = await withAuthErrorLogging(request, 'auth.login', () => {
      request.logger.debug('ignored')
      request.logger.info('ignored')
      request.logger.warn('ignored')
      return 'ok'
    })

    expect(result).toBe('ok')
    expect(request.logger).toBe('original-logger')
    expect(info).not.toHaveBeenCalled()
  })

  test('Should log why it failed, then rethrow', async () => {
    const { request, info } = fakeRequest()
    const failure = new Error('boom')

    await expect(
      withAuthErrorLogging(request, 'auth.login', () => {
        request.logger.error({ error: 'invalid_grant', status: 400 })
        throw failure
      })
    ).rejects.toBe(failure)

    expect(info).toHaveBeenCalledWith(
      expect.anything(),
      'Authentication event: auth.login failed (invalid_grant, HTTP 400)'
    )
    expect(request.logger).toBe('original-logger')
  })
})
