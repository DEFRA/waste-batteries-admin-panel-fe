// Records sign-in, refresh and sign-out outcomes for auditing. The server
// logger's mixin supplies the trace ID. The event and outcome are repeated in
// the message because CDP's log index drops fields it does not map.
export function logAuthEvent(request, event, outcome, reason) {
  request.server.logger.info(
    { event, outcome, requestId: request.info.id },
    `Authentication event: ${event} ${outcome}${reason ? ` (${reason})` : ''}`
  )
}

// Entra error codes (AADSTS…) identify a failure without the free text around
// them, which can echo request values
const aadstsCode = (text) => String(text ?? '').match(/AADSTS\d+/)?.[0]

/**
 * The parts of a hapi-auth-oidc / openid-client error that are safe to log:
 * error codes and the HTTP status, never descriptions, payloads or tokens.
 */
export function describeAuthError(err) {
  return (
    [
      err?.error, // OAuth error, e.g. invalid_client
      aadstsCode(err?.error_description),
      err?.code, // openid-client check, e.g. OAUTH_JWT_CLAIM_COMPARISON_FAILED
      err?.claim && `claim ${err.claim}`,
      err?.status && `HTTP ${err.status}`
    ]
      .filter(Boolean)
      .join(', ') || err?.name
  )
}

/**
 * hapi-pino gives /auth/ requests a no-op logger (see request-logger.js), so
 * hapi-auth-oidc's own error logs go nowhere. Runs `fn` with a logger that
 * records why sign-in failed, using describeAuthError only.
 */
export async function withAuthErrorLogging(request, event, fn) {
  const original = request.logger
  let reason
  request.logger = {
    debug() {},
    info() {},
    warn() {},
    error(err) {
      reason = describeAuthError(err)
    }
  }
  try {
    return await fn()
  } catch (err) {
    logAuthEvent(request, event, 'failed', reason)
    throw err
  } finally {
    request.logger = original
  }
}
