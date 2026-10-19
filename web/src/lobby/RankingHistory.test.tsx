import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import RankingView from './RankingView'
import { clearRemoteStatsCache } from './useRemoteStats'
import { setLanguage } from '../i18n'
import type { UsersView } from '../net/types'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

const PUBLISHED = {
  generatedAt: '2026-10-19T10:00:00Z',
  players: [
    { username: 'alice', constructed: 1820, limited: 800, general: 1800, matches: 40, tourneys: 0, lastSeen: '2026-10-18T09:00:00Z' },
    { username: 'bob', constructed: 1210, limited: 1300, general: 1250, matches: 25, tourneys: 0, lastSeen: null },
    { username: 'carol', constructed: 0, limited: 0, general: 0, matches: 0, tourneys: 0, lastSeen: null },
  ],
}

const ROOM: UsersView[] = [
  {
    userName: 'roomie',
    flagName: 'es',
    constructedRating: 1500,
    matchHistory: '1-1',
    infoGames: '',
    matchQuitRatio: 0,
    tourneyHistory: '',
    tourneyQuitRatio: 0,
    infoPing: '',
    generalRating: 1500,
    limitedRating: 1500,
  },
]

describe('RankingView historical source', () => {
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

  it('does not fetch the published ranking until the history tab is opened', () => {
    render(<RankingView users={ROOM} currentUsername="roomie" onInspectUser={vi.fn()} />)

    expect(fetchMock).not.toHaveBeenCalled()
    expect(document.querySelector('.leaderboard-row')).not.toBeNull()
  })

  it('shows the published players with their peak and matches, unrated last', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, PUBLISHED))
    render(<RankingView users={ROOM} currentUsername="roomie" onInspectUser={vi.fn()} />)

    fireEvent.click(screen.getByRole('tab', { name: 'History' }))

    await waitFor(() => expect(screen.getByText('alice')).toBeDefined())
    const names = Array.from(document.querySelectorAll('.leaderboard-table tbody tr .leaderboard-user-name')).map((el) => el.textContent)
    expect(names).toEqual(['alice', 'bob', 'carol'])
    expect(screen.getByText('1820')).toBeDefined()
    expect(screen.queryByText('Peak')).toBeNull()
    expect(screen.getByText('—', { selector: '.pos-cell' })).toBeDefined()
  })

  it('switches the published table to the limited rating with the format tabs', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse(200, PUBLISHED)))
    render(<RankingView users={ROOM} currentUsername="roomie" onInspectUser={vi.fn()} />)

    fireEvent.click(screen.getByRole('tab', { name: 'History' }))
    await waitFor(() => expect(screen.getByText('alice')).toBeDefined())
    fireEvent.click(screen.getByRole('tab', { name: 'Limited (Draft/Sealed)' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.getByText('bob')).toBeDefined())
    const names = Array.from(document.querySelectorAll('.leaderboard-table tbody .leaderboard-user-name')).map((el) => el.textContent)
    expect(names).toEqual(['bob', 'alice', 'carol'])
    expect(String(fetchMock.mock.calls[1][0])).toMatch(/^\/ranking\.json$/)
  })

  it('shows an error with a retry when the published ranking cannot be loaded', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    render(<RankingView users={ROOM} currentUsername="roomie" onInspectUser={vi.fn()} />)

    fireEvent.click(screen.getByRole('tab', { name: 'History' }))

    expect(await screen.findByRole('alert')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeDefined()
  })
})
