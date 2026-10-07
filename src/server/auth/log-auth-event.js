// Records sign-in, refresh and sign-out outcomes for auditing. The server
// logger's mixin supplies the trace ID.
export function logAuthEvent(request, event, outcome) {
  request.server.logger.info(
    { event, outcome, requestId: request.info.id },
    'Authentication event'
  )
}
