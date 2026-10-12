import { getSafeRedirect } from './get-safe-redirect.js'

describe('#getSafeRedirect', () => {
  test('Should allow relative single-slash paths', () => {
    expect(getSafeRedirect('/some/path')).toBe('/some/path')
    expect(getSafeRedirect('/some/path?q=1')).toBe('/some/path?q=1')
    expect(getSafeRedirect('/about?tab=details')).toBe('/about?tab=details')
    expect(getSafeRedirect('/about?next=https://example.test')).toBe(
      '/about?next=https://example.test'
    )
  })

  test('Should never pass control characters on', () => {
    expect(getSafeRedirect('/about\u0000')).toBe('/about')
    expect(getSafeRedirect('/ab\u0000out')).toBe('/ab%00out')
  })

  test.each([
    ['//evil.example'],
    ['//redirect.invalid/about'],
    ['/x/..//evil.example'],
    ['/..//redirect.invalid//evil.example'],
    ['/\\evil.example'],
    ['/\t/evil.example'],
    ['/\n/evil.example'],
    ['/\r/evil.example'],
    ['https://evil.example'],
    ['evil.example'],
    ['/auth/callback'],
    ['/auth/sign-in?redirect=/'],
    ['/auth'],
    ['/x/../auth/sign-in'],
    ['/x/%2e%2e/auth/callback'],
    ['/%61uth/sign-in'],
    ['/auth%2fcallback'],
    ['/AUTH/sign-in'],
    ['/%zz'],
    [''],
    [undefined],
    [null],
    [42]
  ])('Should fall back to "/" for %s', (value) => {
    expect(getSafeRedirect(value)).toBe('/')
  })
})
