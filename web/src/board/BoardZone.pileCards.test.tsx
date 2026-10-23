// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import BoardZone from './BoardZone'
import { makeGameView, makePlayer } from '../__fixtures__/gameViews'
import { setState } from '../state/store'

const CHIP_SELECTOR = '.library-chip, .graveyard-chip, .exile-chip, .library-stack, .graveyard-stack, .exile-stack'

describe('BoardZone pileCards', () => {
  afterEach(() => {
    setState({ game: null, gameId: null })
    cleanup()
  })

  const ownPlayer = () =>
    makePlayer({
      playerId: 'p1',
      name: 'Alice',
      controlled: true,
      libraryCount: 33,
      graveyard: { 'g-1': { id: 'g-1', name: 'Lightning Bolt', manaValue: 1 } as never },
      exile: {},
    })

  it('BRD-12: pileCards moves the piles from the status row to the corner', () => {
    const player = ownPlayer()
    setState({ game: makeGameView({ players: [player] }) as never })
    const { container } = render(<BoardZone player={player} pileCards />)

    const corner = container.querySelector('[data-testid="pile-corner"]')!
    expect(corner).not.toBeNull()
    expect(corner.querySelectorAll('[data-testid^="pile-card-"]')).toHaveLength(3)
    expect(corner.querySelector('[data-testid="pile-card-library"]')?.getAttribute('data-count')).toBe('33')

    const statusRow = container.querySelector('.bz-status-row')!
    expect(statusRow.querySelector(CHIP_SELECTOR)).toBeNull()
    expect(statusRow.querySelector('[data-testid^="pile-card-"]')).toBeNull()
  })

  it('BRD-12: without pileCards the chips stay in the status row', () => {
    const player = ownPlayer()
    setState({ game: makeGameView({ players: [player] }) as never })
    const { container } = render(<BoardZone player={player} />)

    expect(container.querySelector('[data-testid="pile-corner"]')).toBeNull()
    expect(container.querySelector('.bz-status-row')!.querySelector(CHIP_SELECTOR)).not.toBeNull()
  })
})
