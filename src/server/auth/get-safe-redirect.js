const redirectOrigin = 'https://redirect.invalid'

// Validate against a fixed origin, never a caller-supplied Host header.
export function getSafeRedirect(value) {
  if (
    typeof value !== 'string' ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    [...value].some(
      (character) =>
        character === '\\' ||
        character.charCodeAt(0) < 32 ||
        character.charCodeAt(0) === 127
    )
  ) {
    return '/'
  }
  try {
    const url = new URL(value, redirectOrigin)
    const pathname = decodeURIComponent(url.pathname).toLowerCase()
    if (
      url.origin !== redirectOrigin ||
      pathname === '/auth' ||
      pathname.startsWith('/auth/')
    ) {
      return '/'
    }
    return value
  } catch {
    return '/'
  }
}
