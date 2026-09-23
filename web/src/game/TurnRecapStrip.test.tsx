import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import TurnRecapStrip, { RECAP_VISIBLE_MS, recapSummary, recapTitle } from './TurnRecapStrip'
import { getState, setState } from '../state/store'
import { makePermanent } from '../__fixtures__/gameViews'
import type { TurnRecap } from './turnRecap'
import { t } from '../i18n'

const wall = makePermanent({ id: 'w1', name: 'Wall', cardTypes: ['CREATURE'] })

const recap: TurnRecap = {
  key: 'g:3',
  turn: 3,
  turnsOf: ['Ana'],
  actors: [{ playerId: 'op', name: 'Ana', played: ['Llanowar Elves'], attackedWith: ['Grizzly Bears'] }],
  life: [
    { playerId: 'me', name: 'Me', mine: true, delta: -2 },
    { playerId: 'op', name: 'Ana', mine: false, delta: 3 },
  ],
  departures: [{ id: 'w1', card: wall, dest: 'graveyard', mine: true }],
  marks: { e1: 'new' },
}

describe('TurnRecapStrip', () => {
  afterEach(() => {
    cleanup()
    setState({ turnRecap: null })
    vi.useRealTimers()
  })

  it('builds the one-line summary and title', () => {
    expect(recapTitle(recap, t)).toBe(t('game', 'recap_turn_of', { player: 'Ana' }))
    expect(recapSummary(recap, t)).toBe(
      [
        `${t('game', 'recap_played', { cards: 'Llanowar Elves' })}, ${t('game', 'recap_attacked', { cards: 'Grizzly Bears' })}`,
        t('game', 'recap_you_lost', { n: 2 }),
        t('game', 'recap_player_gained', { player: 'Ana', n: 3 }),
      ].join(' · '),
    )
    expect(recapTitle({ ...recap, turnsOf: ['Ana', 'Bo'] }, t)).toBe(t('game', 'recap_since_last'))
  })

  it('renders departures and dismisses on close or after the timeout', () => {
    vi.useFakeTimers()
    setState({ turnRecap: recap })
    render(<TurnRecapStrip />)
    expect(screen.getByTestId('turn-recap-summary').textContent).toContain('Llanowar Elves')
    const departure = screen.getByTestId('turn-recap-departure')
    expect(departure.getAttribute('data-dest')).toBe('graveyard')
    act(() => {
      vi.advanceTimersByTime(RECAP_VISIBLE_MS)
    })
    expect(getState().turnRecap).toBeNull()
    expect(screen.queryByTestId('turn-recap')).toBeNull()

    act(() => setState({ turnRecap: { ...recap, key: 'g:5' } }))
    fireEvent.click(screen.getByRole('button', { name: t('game', 'recap_dismiss') }))
    expect(getState().turnRecap).toBeNull()
  })
})
