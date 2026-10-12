import {
  callbackController,
  signInController,
  signOutController
} from './controller.js'
import { callbackPath } from '../../auth/oidc-options.js'

/**
 * Sets up the Entra ID auth routes.
 * These routes are registered in src/server/plugins/router.js.
 */
export const authRoutes = {
  plugin: {
    name: 'auth-routes',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/auth/sign-in',
          options: { auth: false },
          handler: signInController
        },
        {
          method: 'GET',
          path: callbackPath,
          options: { auth: false },
          handler: callbackController
        },
        {
          // form_post: Entra posts the code as a form, from its own origin, so
          // there is no crumb token to check
          method: 'POST',
          path: callbackPath,
          options: {
            auth: false,
            plugins: { crumb: false },
            payload: {
              parse: true,
              allow: 'application/x-www-form-urlencoded'
            }
          },
          handler: callbackController
        },
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
