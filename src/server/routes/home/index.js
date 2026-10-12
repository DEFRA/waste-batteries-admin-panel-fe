import { homeController } from './controller.js'

/**
 * Sets up the routes used in the home page.
 * These routes are registered in src/server/router.js.
 */
export const home = {
  plugin: {
    name: 'home',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/',
          // Public page — renders signed in or out, with or without the role.
          // Naming the strategy skips the default's role check
          options: { auth: { strategy: 'session', mode: 'try' } },
          ...homeController
        }
      ])
    }
  }
}
