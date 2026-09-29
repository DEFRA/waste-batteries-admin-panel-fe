import { signOutController } from './controller.js'

/**
 * Sets up the auth routes.
 * These routes are registered in src/server/plugins/router.js.
 */
export const authRoutes = {
  plugin: {
    name: 'auth-routes',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/auth/sign-out',
          options: { auth: { strategy: 'session', mode: 'try' } },
          handler: signOutController
        }
      ])
    }
  }
}
