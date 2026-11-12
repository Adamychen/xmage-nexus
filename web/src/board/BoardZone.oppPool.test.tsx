// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import BoardZone from './BoardZone'
import { makeGameView, makePlayer } from '../__fixtures__/gameViews'
import { initialState, setState } from '../state/state'

const EMPTY = { white: 0, blue: 0, black: 0, red: 0, green: 0, colorless: 0 }

describe('BoardZone opponent floating mana (v2)', () => {
  afterEach(() => {
    setState({ game: null, gameId: null, settings: { ...initialState.settings } })
    cleanup()
  })

  const show = (manaPool: typeof EMPTY) => {
    const opp = makePlayer({ playerId: 'p2', name: 'Bob', controlled: false, manaPool })
    setState({ game: makeGameView({ players: [opp] }) as never, settings: { ...initialState.settings, gameUi: 'v2' } })
    return render(<BoardZone player={opp} position="top" />)
  }

  it('MNA-11: an opponent with floating mana shows it in their panel, not clickable', () => {
    const { container } = show({ ...EMPTY, red: 2, colorless: 1 })
    const pool = container.querySelector('[data-testid="pp-pool"]')!
    expect(pool).not.toBeNull()
    expect(pool.querySelector('[data-side="opp"]')).not.toBeNull()
    expect(pool.querySelectorAll('.mana-inline-pip')).toHaveLength(2)
    expect(pool.querySelector('.mana-inline-pip.mana-r .mana-inline-count')?.textContent).toBe('2')
    expect(pool.querySelector('button')).toBeNull()
  })

  it('MNA-11: an opponent with an empty pool shows no pool section', () => {
    const { container } = show(EMPTY)
    expect(container.querySelector('[data-testid="pp-pool"]')).toBeNull()
  })
})
