import { randomUUID } from 'node:crypto'
import nunjucks from 'nunjucks'
import Boom from '@hapi/boom'

import { buildEndSessionUrl, postSignOutPath } from '../../auth/end-session.js'
import { getSafeRedirect } from '../../auth/get-safe-redirect.js'
import { toSession } from '../../auth/session.js'
import {
  logAuthEvent,
  withAuthErrorLogging
} from '../../auth/log-auth-event.js'

const LOGIN_EVENT = 'auth.login'
const LOGOUT_EVENT = 'auth.logout'
const SUCCEEDED = 'succeeded'
// yar flash key: where to send the user once sign-in completes
const REDIRECT_KEY = 'redirect'

export async function signInController(request, h) {
  // yar-backed so it survives the round trip to Entra
  request.yar.flash(REDIRECT_KEY, getSafeRedirect(request.query.redirect))
  try {
    const response = await withAuthErrorLogging(request, LOGIN_EVENT, () =>
      request.login(h)
    )
    logAuthEvent(request, LOGIN_EVENT, 'started')
    return response
  } catch {
    throw Boom.unauthorized()
  }
}

export async function callbackController(request, h) {
  // Throws a 401 (rendered as "We could not sign you in") on any failure,
  // including the user cancelling at Entra
  let credentials
  try {
    credentials = await withAuthErrorLogging(request, LOGIN_EVENT, () =>
      request.callback(h)
    )
  } catch {
    throw Boom.unauthorized()
  }
  const sessionId = randomUUID() // fresh id on every sign-in — prevents fixation
  const session = {
    ...toSession(credentials),
    sessionId,
    createdAt: new Date().toISOString()
  }

  await request.server.app.cache.set(sessionId, session)
  request.cookieAuth.set({ sessionId })
  logAuthEvent(request, LOGIN_EVENT, SUCCEEDED)

  // A meta refresh rather than a 302: with form_post the browser arrives here
  // on a cross-site POST, and the next request must be same-site for the Lax
  // session cookie to go with it
  // HTML-escape for the attribute below (nunjucks' own autoescape function)
  const redirect = nunjucks.lib.escape(
    getSafeRedirect(request.yar.flash(REDIRECT_KEY)?.at(0) ?? '/')
  )
  return h
    .response(
      `<!doctype html><html lang="en"><head><meta http-equiv="refresh" content="0;url=${redirect}"></head><body></body></html>`
    )
    .type('text/html')
}

export async function signOutController(request, h) {
  request.cookieAuth.clear()

  if (!request.auth.isAuthenticated) {
    logAuthEvent(request, LOGOUT_EVENT, SUCCEEDED)
    return h.redirect(postSignOutPath)
  }

  const { sessionId, idToken } = request.auth.credentials
  await request.server.app.cache.drop(sessionId)

  // Signed out of the service either way; ending the Entra session as well
  // stops the next sign-in going straight through without a prompt
  try {
    const response = h.redirect(await buildEndSessionUrl(idToken))
    logAuthEvent(request, LOGOUT_EVENT, SUCCEEDED)
    return response
  } catch {
    logAuthEvent(request, LOGOUT_EVENT, 'local_only')
    return h.redirect(postSignOutPath)
  }
}
