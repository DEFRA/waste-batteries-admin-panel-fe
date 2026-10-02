import { getSafeRedirect } from './get-safe-redirect.js'

describe('#getSafeRedirect', () => {
  test('Should allow relative single-slash paths', () => {
    expect(getSafeRedirect('/some/path')).toBe('/some/path')
    expect(getSafeRedirect('/some/path?q=1')).toBe('/some/path?q=1')
  })

  test.each([
    ['//evil.example'],
    ['/\\evil.example'],
    ['https://evil.example'],
    ['evil.example'],
    ['/auth/callback'],
    ['/auth/sign-in?redirect=/'],
    [''],
    [undefined],
    [null],
    [42]
  ])('Should fall back to "/" for %s', (value) => {
    expect(getSafeRedirect(value)).toBe('/')
  })
})
