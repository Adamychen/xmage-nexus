import { describe, expect, it } from 'vitest'
import { linkBanner } from './linkBanner'

const base = { connecting: false, wsAlive: true, link: 'ok' as const, linkAttempt: 0 }

describe('linkBanner', () => {
  it('is hidden while the session is healthy', () => {
    expect(linkBanner(base)).toBeNull()
  })

  it('shows the socket reconnect while the proxy is unreachable, also mid-game', () => {
    expect(linkBanner({ ...base, connecting: true, wsAlive: false })?.key).toBe('reconnecting')
    expect(linkBanner({ ...base, wsAlive: false, link: 'ws-down' })?.key).toBe('reconnecting')
  })

  it('shows the session restore and its retries', () => {
    expect(linkBanner({ ...base, link: 'relogging' })?.key).toBe('relogging')
    expect(linkBanner({ ...base, link: 'relogin-retry', linkAttempt: 2 })).toEqual({ key: 'relogin_retry', n: 2 })
  })

  it('shows the proxy logging in again after losing the XMage server', () => {
    expect(linkBanner({ ...base, link: 'server-lost', linkAttempt: 3 })).toEqual({ key: 'server_link_lost', n: 3 })
  })
})
