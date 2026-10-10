import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import PingBadge, { parsePing } from './PingBadge'

// The formats below are the ones the server really sends (User.getPingInfo):
// `pingInfo + " " + connectionDuration`. Captured 2026-10-09 through the proxy,
// the first one from a desktop client on beta.xmage.today, the last from our own
// session (the proxy path never fills pingInfo).
const DESKTOP_PING = '42ms (avg: 40ms)  (online: 3:02; seen: 9 sec ago)'
const SLOW_PING = '153ms (avg: 154ms)  (online: 2:04; seen: 3 sec ago)'
const UNMEASURED = '  (online: 0:00; seen: 4 sec ago)'

describe('PingBadge component & parsePing', () => {
  it('parses the ping of a client that measures it', () => {
    expect(parsePing('45ms')).toEqual({ ms: 45, avg: null, status: 'good', label: '45ms' })
    expect(parsePing(DESKTOP_PING)).toEqual({ ms: 42, avg: 40, status: 'good', label: '42ms' })
    expect(parsePing('1ms (avg: <1ms)')).toEqual({ ms: 1, avg: 1, status: 'good', label: '1ms' })
    expect(parsePing(SLOW_PING)).toEqual({ ms: 153, avg: 154, status: 'medium', label: '153ms' })
    expect(parsePing('250ms')).toEqual({ ms: 250, avg: null, status: 'slow', label: '250ms' })
    expect(parsePing(' (discon. 2m)')).toEqual({
      ms: null,
      avg: null,
      status: 'disconnected',
      label: 'Disconnected',
    })
  })

  it('reads the latency in the head, not in the connection tail', () => {
    // A duration of `3:02` or a `seen: 4 sec ago` is not a measurement: taking
    // the first `N ms` of the whole string used to pair them with a latency.
    expect(parsePing(UNMEASURED)).toEqual({ ms: null, avg: null, status: 'unknown', label: '—' })
    expect(parsePing('')).toEqual({ ms: null, avg: null, status: 'unknown', label: '—' })
    expect(parsePing('<no ping>')).toEqual({ ms: null, avg: null, status: 'unknown', label: '—' })
    expect(parsePing(' Offline')).toEqual({
      ms: null,
      avg: null,
      status: 'disconnected',
      label: 'Disconnected',
    })
  })

  it('renders nothing when nobody measured the connection', () => {
    const { container } = render(<PingBadge infoPing={UNMEASURED} />)
    expect(container.querySelector('.ping-badge')).toBeNull()
  })

  it('renders the latency a peer reports, and its average in the tooltip', () => {
    render(<PingBadge infoPing={DESKTOP_PING} />)
    expect(screen.getByText('42ms')).toBeDefined()
  })

  it('renders compact ping badge', () => {
    const { container } = render(<PingBadge infoPing="90ms" compact />)
    expect(container.querySelector('.ping-compact')).toBeDefined()
  })

  it('localizes the tooltip instead of hardcoding Spanish (AUDIT)', () => {
    const { container } = render(<PingBadge infoPing="1ms (avg: <1ms)" />)
    const badge = container.querySelector('.ping-badge')
    expect(badge?.getAttribute('title')).toBe('Latencia: 1ms (media 1ms)')
  })

  it('keeps the average out of the connection slot of the tooltip', () => {
    const { container } = render(<PingBadge infoPing={DESKTOP_PING} />)
    const badge = container.querySelector('.ping-badge')
    expect(badge?.getAttribute('title')).toBe('Latencia: 42ms (media 40ms)')
    expect(badge?.getAttribute('title')).not.toContain('conectado')
  })

  it('says the player is disconnected without calling it a latency', () => {
    const { container } = render(<PingBadge infoPing=" (discon. 2m)" />)
    const badge = container.querySelector('.ping-badge')
    expect(badge?.textContent).toBe('Desconectado')
    expect(badge?.getAttribute('title')).toBe('Desconectado')
  })
})
