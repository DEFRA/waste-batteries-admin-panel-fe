import { randomUUID } from 'node:crypto'
import escape from 'lodash/escape.js'

import { buildEndSessionUrl, postSignOutPath } from '../../auth/end-session.js'
import { getSafeRedirect } from '../../auth/get-safe-redirect.js'
import { toSession } from '../../auth/session.js'

export function signInController(request, h) {
  // yar-backed so it survives the round trip to Entra
  request.yar.flash('redirect', getSafeRedirect(request.query.redirect))
  return request.login(h)
}

export async function callbackController(request, h) {
  // Throws a 401 (rendered as "We could not sign you in") on any failure,
  // including the user cancelling at Entra
  const credentials = await request.callback(h)
  const sessionId = randomUUID() // fresh id on every sign-in — prevents fixation
  const session = {
    ...toSession(credentials),
    sessionId,
    createdAt: new Date().toISOString()
  }

  await request.server.app.cache.set(sessionId, session)
  request.cookieAuth.set({ sessionId })
  request.logger.info(`User authenticated (oid ${session.id})`)

  // A meta refresh rather than a 302: with form_post the browser arrives here
  // on a cross-site POST, and the next request must be same-site for the Lax
  // session cookie to go with it
  const redirect = escape(request.yar.flash('redirect')?.at(0) ?? '/')
  return h
    .response(
      `<!doctype html><html lang="en"><head><meta http-equiv="refresh" content="0;url=${redirect}"></head><body></body></html>`
    )
    .type('text/html')
}

export async function signOutController(request, h) {
  request.cookieAuth.clear()

  if (!request.auth.isAuthenticated) {
    return h.redirect(postSignOutPath)
  }

  const { sessionId, idToken } = request.auth.credentials
  await request.server.app.cache.drop(sessionId)

  // Signed out of the service either way; ending the Entra session as well
  // stops the next sign-in going straight through without a prompt
  try {
    return h.redirect(await buildEndSessionUrl(idToken))
  } catch (error) {
    request.logger.error(
      `Could not end the Entra session, signed out locally only: ${error.message}`
    )
    return h.redirect(postSignOutPath)
  }
}
