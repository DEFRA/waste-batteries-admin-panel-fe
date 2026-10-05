export function logAuthEvent(request, event, outcome) {
  // No request bindings: callback URLs, referrers and provider errors can hold
  // credentials. The server logger's existing mixin supplies the trace ID.
  request.server.logger.info(
    { event, outcome, requestId: request.info.id },
    'Authentication event'
  )
}
