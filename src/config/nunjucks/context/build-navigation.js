export function buildNavigation(request) {
  return [
    {
      text: 'Home',
      href: '/',
      current: request?.path === '/'
    },
    {
      text: 'About',
      href: '/about',
      current: request?.path === '/about'
    },
    {
      text: 'Auth test',
      href: '/auth-test',
      current: request?.path === '/auth-test'
    }
  ]
}
