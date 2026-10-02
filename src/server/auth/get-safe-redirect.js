// Only allow relative single-slash paths as post-sign-in redirects.
// "//evil.example" and "/\evil.example" are both absolute to a browser.
// Never back into /auth/: the callback can only be processed once, and
// sign-in would loop.
export function getSafeRedirect(value) {
  if (typeof value !== 'string') {
    return '/'
  }
  if (!value.startsWith('/')) {
    return '/'
  }
  if (value.startsWith('//') || value.startsWith('/\\')) {
    return '/'
  }
  if (value.startsWith('/auth/')) {
    return '/'
  }
  return value
}
