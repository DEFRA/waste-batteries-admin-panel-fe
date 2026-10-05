import { config } from '#/config/config.js'

// Where Entra sends the user after signing them out. Entra only accepts a
// post_logout_redirect_uri that is registered as a redirect URI on the App
// Registration, so <APP_BASE_URL>/ must be registered alongside the callback.
export const postSignOutPath = '/'

let endSessionEndpoint

// @defra/hapi-auth-oidc has no sign-out, and keeps its discovered config to
// itself, so read end_session_endpoint from the discovery document directly.
// Cached for the life of the process, like the endpoint itself.
async function getEndSessionEndpoint() {
  if (!endSessionEndpoint) {
    const response = await fetch(config.get('auth.oidc.discoveryUri'))
    if (!response.ok) {
      throw new Error(`OIDC discovery failed: HTTP ${response.status}`)
    }
    const { end_session_endpoint: endpoint } = await response.json()
    if (!endpoint) {
      throw new Error('OIDC discovery has no end_session_endpoint')
    }
    endSessionEndpoint = endpoint
  }
  return endSessionEndpoint
}

/**
 * The Entra URL that ends the user's Entra session (RP-initiated logout) and
 * then returns them to postSignOutPath.
 */
export async function buildEndSessionUrl(idToken) {
  const { clientId, externalBaseUrl } = config.get('auth.oidc')
  const url = new URL(await getEndSessionEndpoint())

  url.searchParams.set('client_id', clientId)
  url.searchParams.set(
    'post_logout_redirect_uri',
    new URL(postSignOutPath, externalBaseUrl).toString()
  )
  // Without the hint Entra asks the user which account to sign out of
  if (idToken) {
    url.searchParams.set('id_token_hint', idToken)
  }

  return url.toString()
}

// Tests only
export function resetEndSessionEndpoint() {
  endSessionEndpoint = undefined
}
