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

describe('CMB-15: a pile in the declare step', () => {
  afterEach(() => {
    setState({ game: null, gameId: null })
    cleanup()
  })

  const goblins = (n: number) =>
    Object.fromEntries(
      Array.from({ length: n }, (_, i) => [
        `t-${i}`,
        { id: `t-${i}`, name: 'Goblin Token', isToken: true, cardTypes: ['Creature'], power: '1', toughness: '1', counters: [] },
      ]),
    )

  const seat = (battlefield: Record<string, unknown>) =>
    makePlayer({ playerId: 'p1', name: 'Alice', controlled: true, battlefield: battlefield as never })

  it('CMB-15: every copy that can be picked stays in the pile, so the board does not break apart', () => {
    const player = seat(goblins(6))
    setState({ game: makeGameView({ players: [player] }) as never })
    const ids = Object.keys(goblins(6))
    const { container } = render(<BoardZone player={player} combatSelectable={ids} onCardClick={() => {}} />)

    expect(container.querySelectorAll('.stack-group')).toHaveLength(1)
    expect(container.querySelector('.stack-group')?.getAttribute('data-count')).toBe('6')
  })

  it('CMB-15: a click on the pile picks one copy, and a picked one leaves it', () => {
    const player = seat(goblins(6))
    setState({ game: makeGameView({ players: [player] }) as never })
    const ids = Object.keys(goblins(6))
    const picked: string[] = []
    const { container, rerender } = render(
      <BoardZone player={player} combatSelectable={ids} onCardClick={(id) => picked.push(id)} />,
    )

    const pile = container.querySelector('.stack-group[data-picking]') as HTMLElement
    expect(pile, 'the pile is what takes the click').not.toBeNull()
    pile.click()
    expect(picked).toHaveLength(1)
    expect(ids).toContain(picked[0])

    rerender(<BoardZone player={player} combatSelectable={ids} combatChosen={[picked[0]]} onCardClick={() => {}} />)
    expect(container.querySelector('.stack-group')?.getAttribute('data-count')).toBe('5')
  })
})
