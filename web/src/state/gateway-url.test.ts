import { describe, expect, it } from 'vitest'
import { proxyUrl } from './gateway'

describe('proxyUrl', () => {
  it('brackets a bare IPv6 literal and uses the proxy port', () => {
    expect(proxyUrl('::1', 8787)).toBe('ws://[::1]:8787')
  })

  it('keeps a bracketed IPv6 literal, with or without its port', () => {
    expect(proxyUrl('[::1]', 8787)).toBe('ws://[::1]:8787')
    expect(proxyUrl('[::1]:9000', 8787)).toBe('ws://[::1]:9000')
  })

  it('uses the port written in a host:port value', () => {
    expect(proxyUrl('localhost:9000', 8787)).toBe('ws://localhost:9000')
  })

  it('appends the proxy port to a plain host', () => {
    expect(proxyUrl('example.com', 8787)).toBe('ws://example.com:8787')
  })

  it('keeps a full URL as it is', () => {
    expect(proxyUrl('ws://example.com', 8787)).toBe('ws://example.com')
    expect(proxyUrl('wss://nexus.example.com', 443)).toBe('wss://nexus.example.com')
  })
})
