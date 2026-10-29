import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import TournamentBracketModal from './TournamentBracketModal'
import { switchLanguage } from '../i18n'
import type { TableView, TournamentView } from '../net/types'

const table = { tableId: 'table-m', tableName: 'Modern Swiss #7', isTournament: true, seats: [] } as unknown as TableView

function view(): TournamentView {
  const now = Date.now()
  return {
    tournamentName: 'Modern Swiss #7',
    tournamentType: 'Constructed Swiss / Constructed - Modern 3 rounds',
    tournamentState: 'Dueling',
    startTime: now - 3600_000,
    stepStartTime: now - 120_000,
    serverTime: now,
    constructionTime: 600,
    watchingAllowed: true,
    rounds: [],
    players: [{ name: 'alice', flagName: 'es', state: 'Dueling', points: 0, results: '', history: '', quit: false }],
  }
}

function modal(overrides: Partial<Parameters<typeof TournamentBracketModal>[0]> = {}) {
  return (
    <TournamentBracketModal
      table={table}
      view={view()}
      loading={false}
      error={null}
      onClose={() => {}}
      onRefresh={() => {}}
      {...overrides}
    />
  )
}

describe('TournamentBracketModal', () => {
  beforeEach(async () => {
    await switchLanguage('en')
  })
  afterEach(() => cleanup())

  it('TRN-15: the tournament name is the dialog title and appears only once', () => {
    render(modal())
    expect(screen.getAllByRole('heading', { name: 'Modern Swiss #7' })).toHaveLength(1)
    expect(screen.queryByTestId('tournament-name')).toBeNull()
    expect(screen.getByTestId('tournament-kicker').textContent).toBe('Swiss · Constructed · Modern')
  })

  it('TRN-15: the tournament name uses the shared dialog title element and style', () => {
    render(modal())
    const title = screen.getByRole('heading', { name: 'Modern Swiss #7' })
    expect(title.tagName).toBe('H2')
    expect(title.classList.contains('dlg-title')).toBe(true)
    expect(title.id).toBe('tournament-modal-title')
  })

  it('TRN-15: the modal passes the refresh time down so the bracket says Updated N s ago', () => {
    render(modal({ updatedAt: Date.now() - 5_000 }))
    expect(screen.getByTestId('tournament-updated').textContent).toBe('Updated 5 s ago')
  })

  it('TRN-16: the refresh button of the bracket asks the modal to refresh', () => {
    const onRefresh = vi.fn()
    render(modal({ onRefresh }))
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))
    expect(onRefresh).toHaveBeenCalledTimes(1)
  })

  it('TRN-15: while loading without a view the modal says loading, and an error is shown as it is', () => {
    const { unmount } = render(modal({ view: null, loading: true }))
    expect(screen.getByText('Loading…')).toBeDefined()
    unmount()
    cleanup()
    render(modal({ view: null, error: 'getTournament: t-1' }))
    expect(screen.getByTestId('tournament-modal-error').textContent).toBe('getTournament: t-1')
  })
})
