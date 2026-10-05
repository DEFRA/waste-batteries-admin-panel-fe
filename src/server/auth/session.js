// Maps a token set from @defra/hapi-auth-oidc onto the cached session.
// Claims and the ID token come from the ID token, which a refresh may not
// return — so they are only set when present, and the caller keeps the old ones.
export function toSession({ accessToken, refreshToken, idToken, claims }) {
  return {
    accessToken,
    refreshToken,
    // Sent as id_token_hint on sign-out, so Entra ends the right session
    ...(idToken && { idToken }),
    ...(claims && {
      id: claims.oid,
      displayName: claims.name,
      email: claims.email ?? claims.preferred_username,
      // hapi route authorisation reads credentials.scope; Entra app roles
      // assigned to the user arrive in the roles claim
      scope: claims.roles ?? []
    })
  }
}
