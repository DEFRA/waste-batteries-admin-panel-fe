/**
 * Shows the signed-in user's name, email and roles, to check Entra roles reach
 * the app. No auth options: it takes the server-wide default (signed in, with
 * ENTRA_REQUIRED_ROLE) like any new route, and the e2e journeys rely on that.
 */
export const authTest = {
  plugin: {
    name: 'auth-test',
    register(server) {
      server.route({
        method: 'GET',
        path: '/auth-test',
        handler(request, h) {
          const { displayName, email, scope } = request.auth.credentials
          return h.view('auth-test/index', {
            pageTitle: 'Auth test',
            heading: 'Auth test',
            displayName,
            email,
            roles: scope.join(', ')
          })
        }
      })
    }
  }
}
