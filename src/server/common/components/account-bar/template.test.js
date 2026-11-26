import { renderComponent } from '#/test-helpers/component-helpers.js'

describe('Account Bar Component', () => {
  test('shows the email, user and sign-out link', () => {
    const $accountBar = renderComponent('account-bar', {
      email: 'jo.bloggs@example.com',
      name: 'Jo Bloggs'
    })

    expect($accountBar('.defra-account-bar').text()).toContain(
      'jo.bloggs@example.com'
    )
    expect($accountBar('.defra-account-bar').text()).toContain('Jo Bloggs')
    expect($accountBar('a[href="/auth/sign-out"]').text()).toBe('Sign out')
  })
})
