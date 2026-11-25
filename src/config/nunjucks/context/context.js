import { readFileSync } from 'node:fs'
import path from 'node:path'

import { config } from '#/config/config.js'
import { createLogger } from '#/server/common/helpers/logging/logger.js'
import { buildNavigation } from './build-navigation.js'

const logger = createLogger()
const assetPath = config.get('assetPath')
const manifestPath = path.join(
  config.get('root'),
  '.public/.vite/manifest.json'
)

let viteManifest

// Mirrors static-assets.js: only local dev runs the Vite middleware, every
// other environment (including the e2e test server) serves the built files
const usesBuiltAssets = () => config.get('isProduction') || config.get('isTest')

// The session cookie strategy puts the whole cached session in credentials.
// Expose only what views need — never token contents.
function buildAuthContext(request) {
  if (!request?.auth?.isAuthenticated) {
    return { isAuthenticated: false }
  }

  const { displayName, email } = request.auth.credentials ?? {}

  return {
    isAuthenticated: true,
    displayName,
    email
  }
}

// Account menu for wrcHeader: an item without an href renders as plain text
function buildAccountNavigation(auth) {
  if (!auth.isAuthenticated) {
    return [{ text: 'Sign in', href: '/auth/sign-in' }]
  }

  return [
    {
      text: auth.displayName ?? auth.email,
      visuallyHiddenText: 'Signed in as '
    },
    { text: 'Sign out', href: '/auth/sign-out' }
  ]
}

export function context(request) {
  if (usesBuiltAssets() && !viteManifest) {
    try {
      viteManifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))
    } catch (error) {
      logger.error(`Vite ${path.basename(manifestPath)} not found`)
    }
  }

  const auth = buildAuthContext(request)

  return {
    assetPath: `${assetPath}/assets`,
    serviceName: config.get('serviceName'),
    serviceUrl: '/',
    auth,
    accountNavigation: buildAccountNavigation(auth),
    breadcrumbs: [],
    navigation: buildNavigation(request),
    getAssetPath(asset) {
      if (!usesBuiltAssets()) {
        return `${assetPath}/${asset}`
      }

      const viteAssetPath = viteManifest?.[asset]?.file
      return `${assetPath}/${viteAssetPath ?? asset}`
    }
  }
}
