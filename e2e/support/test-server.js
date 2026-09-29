/**
 * Entry point for the app instances the e2e suite drives.
 *
 * It is the real server — createServer() with nothing stubbed — plus, when
 * E2E_PROTECTED_ROUTES is set, a route the app does not have yet:
 *
 *   /e2e/protected       relies on the server-wide auth default, so it proves
 *                        the "everything is protected unless it opts out"
 *                        behaviour and the redirect-to-sign-in that goes with it
 *
 * The manual checklist gets this coverage by asking a human to delete the
 * `auth: { mode: 'try' }` line from a real route and put it back afterwards.
 * Adding the route here keeps the app's own routing honest.
 */
import process from 'node:process'

import { createServer } from '#/server/server.js'
import { config } from '#/config/config.js'

const server = await createServer()

if (process.env.E2E_PROTECTED_ROUTES === 'true') {
  server.route({
    method: 'GET',
    path: '/e2e/protected',
    // No auth options at all — inherits the server default
    handler: () => `<!doctype html>
<html lang="en"><head><title>Protected page</title></head>
<body><h1 data-testid="e2e-page-heading">Protected page</h1></body></html>`
  })
}

await server.start()
server.logger.info(`e2e app listening on port ${config.get('port')}`)

process.on('unhandledRejection', (error) => {
  server.logger.error(error)
  process.exitCode = 1
})
