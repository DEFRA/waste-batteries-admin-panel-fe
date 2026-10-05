import { vi } from 'vitest'

import { createServer } from '../server.js'
import { config } from '#/config/config.js'
import { resetEndSessionEndpoint } from './end-session.js'

const { logLines } = vi.hoisted(() => ({ logLines: [] }))

// Capture real Pino output, including automatic request logs. Only the provider
// HTTP responses are fixtures; the library flows, cookies and cache are real.
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
const code = 'fake-authorization-code-must-not-be-logged'
const refreshToken = 'fake-refresh-token-must-not-be-logged'
const authorization = 'Bearer fake-authorization-header-must-not-be-logged'
const cookieSecret = 'fake-cookie-value-must-not-be-logged'
const providerError = 'fake-provider-error-with-private-credentials'

function jwt(claims) {
  return [
    { alg: 'RS256', typ: 'JWT' },
    claims,
    'fake-signature-for-the-code-flow-fixture'
  ]
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

describe('authentication logging', () => {
  let server
  let tokens
  let secrets
  let tokenFailure
  let discoveryFailure
  let refreshCalls

  beforeEach(async () => {
    resetEndSessionEndpoint()
    logLines.length = 0
    tokenFailure = false
    discoveryFailure = false
    refreshCalls = 0
    const now = Math.floor(Date.now() / 1000)
    const claims = {
      iss: issuer,
      aud: config.get('auth.oidc.clientId'),
      sub: 'fixture-user',
      oid: 'fixture-object-id',
      name: 'Fixture administrator',
      roles: [config.get('auth.requiredRole')],
      iat: now,
      exp: now + 3600
    }
    tokens = {
      access_token: jwt({ ...claims, marker: 'access-secret' }),
      id_token: jwt({ ...claims, marker: 'id-secret' }),
      refresh_token: refreshToken,
      token_type: 'Bearer',
      expires_in: 3600
    }
    secrets = [
      code,
      refreshToken,
      authorization,
      cookieSecret,
      providerError,
      tokens.access_token,
      tokens.id_token
    ]

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input, options) => {
        const url = String(input)
        if (url.endsWith('/.well-known/openid-configuration')) {
          if (discoveryFailure) {
            throw new Error(`${providerError}: ${secrets.join(' ')}`)
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
        expect(url).toBe(`${issuer}/token`)
        const body = new URLSearchParams(options.body)
        for (const key of ['client_assertion', 'code_verifier']) {
          if (body.get(key)) secrets.push(body.get(key))
        }
        if (body.get('grant_type') === 'refresh_token') refreshCalls++
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
  })

  function inject(options) {
    const request = typeof options === 'string' ? { url: options } : options
    return server.inject({
      ...request,
      headers: { 'x-cdp-request-id': 'fixture-trace-id', ...request.headers }
    })
  }

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
    const response = await inject('/auth/sign-in?redirect=%2Fabout')
    expect(response.statusCode).toBe(302)
    const state = new URL(response.headers.location).searchParams.get('state')
    secrets.push(state)
    return { state, cookies: cookiesFrom(response) }
  }

  async function finishLogin(login) {
    return inject({
      url: `/auth/callback?code=${code}&state=${login.state}`,
      headers: { cookie: login.cookies }
    })
  }

  function expectEvent(event, outcome) {
    const entries = logLines.map((line) => JSON.parse(line))
    expect(entries).toContainEqual(
      expect.objectContaining({
        event,
        outcome,
        requestId: expect.any(String),
        trace: { id: expect.any(String) }
      })
    )
  }

  function expectCleanLogs() {
    const output = logLines.join('')
    for (const secret of secrets) expect(output).not.toContain(secret)
  }

  test('successful login keeps codes, assertions, tokens and ordinary request bindings private', async () => {
    const response = await finishLogin(await beginLogin())
    expect(response.statusCode).toBe(200)
    expect(response.headers['referrer-policy']).toBe('no-referrer')
    await inject({
      url: `/about?code=${code}&id_token_hint=${tokens.id_token}`,
      headers: {
        authorization,
        cookie: `sample=${cookieSecret}`,
        referer: `http://localhost:3000/auth/callback?code=${code}`
      }
    })
    expectEvent('auth.login', 'started')
    expectEvent('auth.login', 'succeeded')
    expectCleanLogs()
  })

  test('token endpoint failure keeps raw error details private and retains the recovery page', async () => {
    const login = await beginLogin()
    tokenFailure = true
    const response = await finishLogin(login)
    expect(response.statusCode).toBe(401)
    expect(response.payload).toContain('We could not sign you in')
    expect(response.payload).not.toContain(providerError)
    expectEvent('auth.login', 'failed')
    expectCleanLogs()
  })

  test('discovery failure emits a sanitized sign-in failure', async () => {
    discoveryFailure = true
    const response = await inject('/auth/sign-in')
    expect(response.statusCode).toBe(401)
    expectEvent('auth.login', 'failed')
    expectCleanLogs()
  })

  test('refresh on an ordinary protected route emits a safe success event', async () => {
    expireAccessTokenSoon()
    const response = await finishLogin(await beginLogin())
    const protectedResponse = await inject({
      url: '/logging/protected',
      headers: { cookie: cookiesFrom(response) }
    })
    expect(protectedResponse.statusCode).toBe(200)
    expect(refreshCalls).toBe(1)
    expectEvent('auth.refresh', 'succeeded')
    expectCleanLogs()
  })

  test('refresh failure on an ordinary protected route drops the session without logging provider details', async () => {
    expireAccessTokenSoon()
    const response = await finishLogin(await beginLogin())
    tokenFailure = true
    const protectedResponse = await inject({
      url: '/logging/protected',
      headers: { cookie: cookiesFrom(response) }
    })
    expect(protectedResponse.statusCode).toBe(302)
    expect(refreshCalls).toBe(1)
    expectEvent('auth.refresh', 'failed')
    expectCleanLogs()
  })

  test.each([false, true])(
    'logout keeps the ID-token hint and discovery failures private (failure=%s)',
    async (failure) => {
      const response = await finishLogin(await beginLogin())
      discoveryFailure = failure
      const logout = await inject({
        url: '/auth/sign-out',
        headers: { cookie: cookiesFrom(response) }
      })
      expect(logout.statusCode).toBe(302)
      if (failure) expect(logout.headers.location).toBe('/')
      else {
        expect(
          new URL(logout.headers.location).searchParams.get('id_token_hint')
        ).toBe(tokens.id_token)
      }
      expectEvent('auth.logout', failure ? 'local_only' : 'succeeded')
      expectCleanLogs()
    }
  )
})
