// Maps a token set from @defra/hapi-auth-oidc onto the cached session.
// Claims come from the ID token, which a refresh may not return.
export function toSession({ accessToken, refreshToken, claims }) {
  return {
    accessToken,
    refreshToken,
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
