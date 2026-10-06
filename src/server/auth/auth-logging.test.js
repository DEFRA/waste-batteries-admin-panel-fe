import { vi } from 'vitest'

import { createServer } from '../server.js'
import { config } from '#/config/config.js'
import { resetEndSessionEndpoint } from './end-session.js'

const { logLines } = vi.hoisted(() => ({ logLines: [] }))

// Capture real Pino output. Only the provider HTTP responses are fixtures; the
// library flows, cookies and cache are real.
vi.mock('../plugins/logger-options.js', async (importOriginal) => {
  const { loggerOptions } = await importOriginal()
  const { Writable } = await import('node:stream')
  return {
    loggerOptions: {
      ...loggerOptions,
      enabled: true,
      level: 'debug',
      transport: undefined,
      stream: new Writable({
        write(chunk, _encoding, done) {
          logLines.push(chunk.toString())
          done()
        }
      })
    }
  }
})

const issuer = 'http://localhost:3210/entra'
const userName = 'Fixture administrator'
const code = 'fake-private-authorization-code'
const providerDetail = 'fake-private-provider-error'
const authorization = 'Bearer fake-private-authorization-header'
const cookieValue = 'fake-private-cookie-value'

function jwt(claims) {
  return [{ alg: 'RS256', typ: 'JWT' }, claims, 'fake-signature']
    .map((part) =>
      Buffer.from(
        typeof part === 'string' ? part : JSON.stringify(part)
      ).toString('base64url')
    )
    .join('.')
}

function cookiesFrom(response) {
  return [response.headers['set-cookie'] ?? []]
    .flat()
    .map((cookie) => cookie.split(';')[0])
    .join('; ')
}

describe('authentication events', () => {
  let server
  let tokens
  let secrets
  let tokenFailure
  let discoveryFailure

  beforeEach(async () => {
    resetEndSessionEndpoint()
    logLines.length = 0
    tokenFailure = false
    discoveryFailure = false
    const now = Math.floor(Date.now() / 1000)
    const claims = {
      iss: issuer,
      aud: config.get('auth.oidc.clientId'),
      sub: 'fixture-user',
      oid: 'fixture-object-id',
      name: userName,
      roles: [config.get('auth.requiredRole')],
      iat: now,
      exp: now + 3600
    }
    tokens = {
      access_token: jwt({ ...claims, marker: 'access-token' }),
      id_token: jwt({ ...claims, marker: 'id-token' }),
      refresh_token: 'fake-refresh-token',
      token_type: 'Bearer',
      expires_in: 3600
    }
    secrets = [
      code,
      providerDetail,
      authorization,
      cookieValue,
      tokens.access_token,
      tokens.id_token,
      tokens.refresh_token
    ]

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input, options) => {
        if (String(input).endsWith('/.well-known/openid-configuration')) {
          if (discoveryFailure) {
            throw new Error(`${providerDetail}: ${secrets.join(' ')}`)
          }
          return Response.json({
            issuer,
            authorization_endpoint: `${issuer}/authorize`,
            token_endpoint: `${issuer}/token`,
            end_session_endpoint: `${issuer}/endsession`,
            jwks_uri: `${issuer}/jwks`,
            response_types_supported: ['code'],
            subject_types_supported: ['public'],
            id_token_signing_alg_values_supported: ['RS256'],
            code_challenge_methods_supported: ['S256']
          })
        }
        expect(String(input)).toBe(`${issuer}/token`)
        const body = new URLSearchParams(options.body)
        for (const key of ['client_assertion', 'code_verifier']) {
          if (body.get(key)) secrets.push(body.get(key))
        }
        if (tokenFailure) {
          return Response.json(
            { error: 'invalid_grant', error_description: secrets.join(' ') },
            { status: 400 }
          )
        }
        return Response.json(tokens)
      })
    )
    server = await createServer()
    server.route({
      method: 'GET',
      path: '/logging/protected',
      handler: () => 'protected'
    })
    await server.initialize()
  })

  afterEach(async () => {
    await server.stop({ timeout: 0 })
    vi.unstubAllGlobals()
    const output = logLines.join('')
    for (const secret of secrets) expect(output).not.toContain(secret)
  })

  function expireAccessTokenSoon() {
    const claims = JSON.parse(
      Buffer.from(tokens.access_token.split('.')[1], 'base64url').toString()
    )
    tokens.access_token = jwt({
      ...claims,
      exp: Math.floor(Date.now() / 1000) + 10
    })
    secrets.push(tokens.access_token)
  }

  async function beginLogin() {
    const response = await server.inject({
      url: '/auth/sign-in',
      headers: { 'x-cdp-request-id': 'fixture-trace-id' }
    })
    expect(response.statusCode).toBe(302)
    const state = new URL(response.headers.location).searchParams.get('state')
    secrets.push(state)
    return {
      state,
      cookies: cookiesFrom(response)
    }
  }

  function finishLogin(login, method = 'GET') {
    const parameters = new URLSearchParams({ code, state: login.state })
    return server.inject({
      method,
      url: `/auth/callback${method === 'GET' ? `?${parameters}` : ''}`,
      headers: {
        cookie: login.cookies,
        ...(method === 'POST' && {
          'content-type': 'application/x-www-form-urlencoded'
        })
      },
      ...(method === 'POST' && { payload: parameters.toString() })
    })
  }

  async function signIn() {
    const response = await finishLogin(await beginLogin())
    expect(response.statusCode).toBe(200)
    return cookiesFrom(response)
  }

  function expectEvent(event, outcome) {
    const entries = logLines.map((line) => JSON.parse(line))
    expect(entries).toContainEqual(
      expect.objectContaining({ event, outcome, requestId: expect.any(String) })
    )
  }

  test.each(['GET', 'POST'])('sign-in (%s callback)', async (method) => {
    const response = await finishLogin(await beginLogin(), method)
    expect(response.statusCode).toBe(200)
    expect(response.headers['referrer-policy']).toBe('no-referrer')

    expectEvent('auth.login', 'started')
    expectEvent('auth.login', 'succeeded')
    expect(logLines.map((line) => JSON.parse(line))).toContainEqual(
      expect.objectContaining({
        event: 'auth.login',
        outcome: 'started',
        trace: { id: 'fixture-trace-id' }
      })
    )
  })

  test.each(['GET', 'POST'])(
    'failed token exchange (%s callback)',
    async (method) => {
      const login = await beginLogin()
      tokenFailure = true

      const response = await finishLogin(login, method)
      expect(response.statusCode).toBe(401)
      expect(response.payload).toContain('We could not sign you in')
      expect(response.payload).not.toContain(providerDetail)
      expectEvent('auth.login', 'failed')
    }
  )

  test('ordinary request logs redact query strings, referrers and credentials', async () => {
    const response = await server.inject({
      url: `/about?code=${code}&id_token_hint=${tokens.id_token}`,
      headers: {
        authorization,
        cookie: `sample=${cookieValue}`,
        referer: `http://localhost:3000/auth/callback?code=${code}`
      }
    })
    expect(response.statusCode).toBe(200)
    expect(logLines.join('')).toContain('[response] get /about')
  })

  test('failed discovery', async () => {
    discoveryFailure = true

    expect((await server.inject('/auth/sign-in')).statusCode).toBe(401)
    expectEvent('auth.login', 'failed')
  })

  test('refresh, without logging the user name', async () => {
    expireAccessTokenSoon()
    const cookie = await signIn()
    logLines.length = 0

    const response = await server.inject({
      url: '/logging/protected',
      headers: { cookie }
    })

    expect(response.statusCode).toBe(200)
    expectEvent('auth.refresh', 'succeeded')
    expect(logLines.join('')).not.toContain(userName)
  })

  test('failed refresh', async () => {
    expireAccessTokenSoon()
    const cookie = await signIn()
    tokenFailure = true

    const response = await server.inject({
      url: '/logging/protected',
      headers: { cookie }
    })

    expect(response.statusCode).toBe(302)
    expectEvent('auth.refresh', 'failed')
  })

  test.each([
    [false, 'succeeded'],
    [true, 'local_only']
  ])('sign-out (discovery failure=%s)', async (failure, outcome) => {
    const cookie = await signIn()
    discoveryFailure = failure

    const response = await server.inject({
      url: '/auth/sign-out',
      headers: { cookie }
    })

    expect(response.statusCode).toBe(302)
    if (failure) expect(response.headers.location).toBe('/')
    else {
      expect(
        new URL(response.headers.location).searchParams.get('id_token_hint')
      ).toBe(tokens.id_token)
    }
    expectEvent('auth.logout', outcome)
  })
})
