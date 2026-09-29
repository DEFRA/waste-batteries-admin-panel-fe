export async function signOutController(request, h) {
  if (request.auth.isAuthenticated) {
    await request.server.app.cache.drop(request.auth.credentials.sessionId)
  }
  request.cookieAuth.clear()
  return h.redirect('/')
}
