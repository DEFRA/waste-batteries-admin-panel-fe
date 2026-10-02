import { randomUUID } from 'node:crypto'
import escape from 'lodash/escape.js'

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
  if (request.auth.isAuthenticated) {
    await request.server.app.cache.drop(request.auth.credentials.sessionId)
  }
  request.cookieAuth.clear()
  return h.redirect('/')
}
