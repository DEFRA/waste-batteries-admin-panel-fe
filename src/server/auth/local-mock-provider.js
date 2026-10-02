import { MockProvider } from '@defra/hapi-auth-oidc'

/**
 * LOCAL AND CI ONLY. Never used in a CDP environment.
 *
 * On CDP the service proves who it is to Entra with an AWS STS web identity
 * token (WebIdentityTokenProvider). There is no STS locally, so the CDP docs
 * say to use the library's MockProvider instead. Its default token is a random
 * UUID, which is fine for starting the app but cannot complete a sign-in: the
 * token endpoint rejects it as a client_assertion. Real Entra would reject
 * any fake, so locally we point at the Entra stub in compose.yml instead,
 * which parses the assertion (RFC 7523) but does not check its signature.
 *
 * So this is the documented MockProvider, still the federated type the docs
 * use, given a JWT-shaped token the stub accepts. The client authentication
 * the library sends (client_assertion, no client secret) is the same shape as
 * on CDP. See "Signing in locally and in CI" in the README.
 */
export function createLocalMockProvider({ clientId, audience }) {
  // CDP sets CDP_JWT_ISSUER in every environment (see the federated
  // credentials docs), so its presence means we are deployed
  if (process.env.CDP_JWT_ISSUER) {
    throw new Error(
      'ENTRA_FEDERATED_MOCKING is on in a CDP environment. It is for local development and CI only'
    )
  }

  return new MockProvider({
    token: buildLocalClientAssertion(clientId, audience)
  })
}

// The stub requires iss and sub to equal the client id, and an aud to be
// present; it does not verify the signature, so the signature is a placeholder
export function buildLocalClientAssertion(clientId, audience) {
  const now = Math.floor(Date.now() / 1000)
  const oneYear = 365 * 24 * 60 * 60

  return [
    { alg: 'RS256', typ: 'JWT' },
    {
      iss: clientId,
      sub: clientId,
      aud: audience,
      iat: now,
      exp: now + oneYear
    },
    'local-mock-not-signed'
  ]
    .map((part) =>
      Buffer.from(
        typeof part === 'string' ? part : JSON.stringify(part)
      ).toString('base64url')
    )
    .join('.')
}
