/**
 * Avoid caching authenticated content and authentication responses. Suppress
 * callback referrers so codes cannot reach the next page's request logs.
 * Registered after catchAll so error pages get the header too.
 */
export function noStore(request, h) {
  const authResponse = request.path.startsWith('/auth/')
  if (!request.auth?.isAuthenticated && !authResponse) {
    return h.continue
  }

  const { response } = request
  if (response.isBoom) {
    response.output.headers['cache-control'] = 'no-store'
    if (authResponse) {
      response.output.headers['referrer-policy'] = 'no-referrer'
    }
  } else {
    response.header('cache-control', 'no-store')
    if (authResponse) {
      response.header('referrer-policy', 'no-referrer')
    }
  }

  return h.continue
}
