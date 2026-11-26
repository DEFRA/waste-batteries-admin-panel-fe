import { renderComponent } from '#/test-helpers/component-helpers.js'

describe('WRC Header Component', () => {
  test('Should render a link for an item with an href', () => {
    const $header = renderComponent('wrc-header', {
      navigation: [{ text: 'Sign in', href: '/auth/sign-in' }]
    })

    expect($header('a[href="/auth/sign-in"]').text()).toBe('Sign in')
  })

  test('Should render an item without an href as plain text', () => {
    const $header = renderComponent('wrc-header', {
      navigation: [
        { text: 'Jo Bloggs', visuallyHiddenText: 'Signed in as ' },
        { text: 'Sign out', href: '/auth/sign-out' }
      ]
    })

    const items = $header('.defra-internal-header__account-menu li')
    expect(items.first().find('a')).toHaveLength(0)
    expect(items.first().text()).toBe('Signed in as Jo Bloggs')
    expect($header('a[href="/auth/sign-out"]').text()).toBe('Sign out')
  })

  test('Should hide the account menu with no navigation', () => {
    const $header = renderComponent('wrc-header', {})

    expect($header('.defra-internal-header__account-menu')).toHaveLength(0)
  })
})
