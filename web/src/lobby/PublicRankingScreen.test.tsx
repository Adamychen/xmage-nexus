import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import PublicRankingScreen from './PublicRankingScreen'
import { clearRemoteStatsCache } from './useRemoteStats'
import { isPublicRankingHash } from './publicRankingRoute'
import { setLanguage } from '../i18n'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

const RANKING = {
  generatedAt: '2026-10-17T10:00:00Z',
  players: [
    { username: 'alice', constructed: 1820, limited: 800, general: 1800, matches: 40, tourneys: 0, lastSeen: null },
    { username: 'bob', constructed: 1210, limited: 800, general: 1200, matches: 25, tourneys: 0, lastSeen: null },
    { username: 'carol', constructed: 800, limited: 800, general: 800, matches: 0, tourneys: 0, lastSeen: null },
  ],
}

describe('PublicRankingScreen', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    setLanguage('en')
    clearRemoteStatsCache()
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    setLanguage('es')
  })

  it('renders the players returned by the ranking endpoint', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, RANKING))

    render(<PublicRankingScreen />)

    expect(await screen.findByText('alice')).toBeTruthy()
    expect(screen.getByText('bob')).toBeTruthy()
    expect(screen.getByText('1820')).toBeTruthy()
    expect(screen.getByText('carol')).toBeTruthy()
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/^\/ranking\.json/)
  })

  it('shows a retry state on 503 and reloads on retry', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(503, { error: 'not_ready' }))
      .mockResolvedValueOnce(jsonResponse(200, RANKING))

    render(<PublicRankingScreen />)

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('still being prepared')
    expect(screen.queryByText('alice')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

    expect(await screen.findByText('alice')).toBeTruthy()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('shows a generic error state without crashing on a network failure', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    render(<PublicRankingScreen />)

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('The ranking could not be loaded.'))
  })

  it('switches to the matches tab and requests the match history', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, RANKING))
      .mockResolvedValueOnce(jsonResponse(200, {
        updatedAt: '2026-10-17T10:00:00Z',
        matches: [{ tableId: 't1', matchId: 'm1', matchName: 'Friday Cube', players: 'alice, bob', result: 'alice won' }],
      }))

    render(<PublicRankingScreen />)
    await screen.findByText('alice')

    fireEvent.click(screen.getByRole('tab', { name: 'Matches' }))

    expect(await screen.findByText('Friday Cube')).toBeTruthy()
    expect(screen.getByText('alice won')).toBeTruthy()
    expect(String(fetchMock.mock.calls[1][0])).toBe('/api/matches?limit=50')
  })
})

describe('isPublicRankingHash', () => {
  it('matches only the public ranking route', () => {
    expect(isPublicRankingHash('#/ranking')).toBe(true)
    expect(isPublicRankingHash('#/ranking/')).toBe(true)
    expect(isPublicRankingHash('#/gallery')).toBe(false)
    expect(isPublicRankingHash('#/rankings')).toBe(false)
    expect(isPublicRankingHash('')).toBe(false)
  })
})
