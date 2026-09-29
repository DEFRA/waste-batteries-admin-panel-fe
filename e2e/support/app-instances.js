/**
 * The app instances Playwright starts, and the environment each one runs with.
 */

const port = 3100

export const appInstances = {
  /** Default configuration: memory-backed sessions, production-like windows. */
  app: {
    port,
    url: `http://localhost:${port}`,
    logFile: `e2e/.logs/app-${port}.log`,
    env: {
      // NODE_ENV=test skips the in-process Vite dev server and keeps cookies
      // non-secure over plain http
      NODE_ENV: 'test',
      LOG_ENABLED: 'true',
      LOG_FORMAT: 'ecs',
      LOG_LEVEL: 'info',
      SESSION_COOKIE_SECURE: 'false',
      // The app has no protected route of its own yet — home and about are
      // deliberately public — so the harness adds one. See test-server.js
      E2E_PROTECTED_ROUTES: 'true',
      PORT: String(port)
    }
  }
}
