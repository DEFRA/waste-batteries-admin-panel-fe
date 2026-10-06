const origin = 'https://redirect.invalid'

// A same-site path to return to after sign-in, or '/'. Parsing against a fixed
// origin catches anything that would leave the site (//evil, /\evil, tabs the
// URL parser strips). The auth routes are excluded so sign-in cannot loop.
export function getSafeRedirect(value) {
  if (
    typeof value !== 'string' ||
    !value.startsWith('/') ||
    value.startsWith('//')
  ) {
    return '/'
  }
  try {
    const url = new URL(value, origin)
    const pathname = decodeURIComponent(url.pathname)
    if (
      url.origin === origin &&
      !url.pathname.startsWith('//') &&
      !/^\/auth(\/|$)/i.test(pathname)
    ) {
      return url.pathname + url.search
    }
  } catch {}
  return '/'
}
