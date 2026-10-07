import { vi } from 'vitest'

import { buildEndSessionUrl, resetEndSessionEndpoint } from './end-session.js'

describe('#buildEndSessionUrl', () => {
  beforeEach(() => {
    resetEndSessionEndpoint()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function mockDiscovery(response) {
    return vi.spyOn(globalThis, 'fetch').mockResolvedValue(response)
  }

  test('Should build the Entra logout URL from discovery', async () => {
    mockDiscovery(
      Response.json({ end_session_endpoint: 'https://login.example/logout' })
    )

    const url = new URL(await buildEndSessionUrl('id-token'))

    expect(url.origin + url.pathname).toBe('https://login.example/logout')
    expect(url.searchParams.get('client_id')).toBe('local-client-id')
    expect(url.searchParams.get('post_logout_redirect_uri')).toBe(
      'http://localhost:3000/'
    )
    expect(url.searchParams.get('id_token_hint')).toBe('id-token')
  })

  test('Should leave out the hint when there is no ID token', async () => {
    mockDiscovery(
      Response.json({ end_session_endpoint: 'https://login.example/logout' })
    )

    const url = new URL(await buildEndSessionUrl())

    expect(url.searchParams.has('id_token_hint')).toBe(false)
  })

  test('Should only fetch discovery once', async () => {
    const fetch = mockDiscovery(
      Response.json({ end_session_endpoint: 'https://login.example/logout' })
    )

    await buildEndSessionUrl()
    await buildEndSessionUrl()

    expect(fetch).toHaveBeenCalledTimes(1)
  })

  test('Should throw when discovery fails', async () => {
    mockDiscovery(new Response('', { status: 503 }))

    await expect(buildEndSessionUrl()).rejects.toThrow('HTTP 503')
  })

  test('Should throw when there is no end_session_endpoint', async () => {
    mockDiscovery(Response.json({}))

    await expect(buildEndSessionUrl()).rejects.toThrow(
      'no end_session_endpoint'
    )
  })
})
