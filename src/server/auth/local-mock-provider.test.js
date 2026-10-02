import { MockProvider } from '@defra/hapi-auth-oidc'

import {
  buildLocalClientAssertion,
  createLocalMockProvider
} from './local-mock-provider.js'

const decode = (part) => JSON.parse(Buffer.from(part, 'base64url').toString())

describe('#createLocalMockProvider', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  test('Should be the documented MockProvider, federated type', async () => {
    const provider = createLocalMockProvider({
      clientId: 'client-id',
      audience: 'api://AzureADTokenExchange'
    })

    expect(provider).toBeInstanceOf(MockProvider)
    expect(provider.type).toBe('federated')
    expect(await provider.getCredentials()).toBe(provider.token)
  })

  test('Should refuse to run in a CDP environment', () => {
    vi.stubEnv('CDP_JWT_ISSUER', 'https://example.tokens.sts.global.api.aws')

    expect(() =>
      createLocalMockProvider({ clientId: 'client-id', audience: 'aud' })
    ).toThrow('ENTRA_FEDERATED_MOCKING is on in a CDP environment')
  })
})

describe('#buildLocalClientAssertion', () => {
  test('Should be a JWT the Entra stub accepts as a client assertion', () => {
    const [header, payload, signature] = buildLocalClientAssertion(
      'client-id',
      'api://AzureADTokenExchange'
    ).split('.')

    expect(decode(header)).toEqual({ alg: 'RS256', typ: 'JWT' })
    expect(decode(payload)).toMatchObject({
      iss: 'client-id',
      sub: 'client-id',
      aud: 'api://AzureADTokenExchange'
    })
    expect(decode(payload).exp).toBeGreaterThan(Date.now() / 1000)
    expect(signature).toBeTruthy()
  })
})
