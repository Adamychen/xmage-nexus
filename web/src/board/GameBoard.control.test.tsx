// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import GameBoard from './GameBoard'
import { getState, setState } from '../state/store'
import { makeCard, makeGameView, makePermanent, makePlayer } from '../__fixtures__/gameViews'
import type { GameView } from '../net/types'

const SIM_NAME = 'sim-000040'

function controlledGame(): GameView {
  return makeGameView({
    players: [
      makePlayer({
        playerId: 'p1',
        name: 'Alice',
        controlled: true,
        handCount: 1,
        battlefield: { 'my-land': makePermanent({ name: 'Mountain', parentId: 'my-land', controlled: true, cardTypes: ['Land'] }) },
      }),
      makePlayer({
        playerId: 'p2',
        name: SIM_NAME,
        isActive: true,
        hasPriority: true,
        handCount: 1,
        battlefield: {
          'opp-perm': makePermanent({ name: 'Mox Jet', parentId: 'opp-perm', cardTypes: ['Artifact'] }),
          'opp-chosen': makePermanent({ name: 'Island', parentId: 'opp-chosen', cardTypes: ['Land'] }),
        },
      }),
    ],
    myPlayerId: 'p1',
    myHand: { 'my-hand': makeCard({ name: 'Counterspell', parentId: 'my-hand' }) },
    opponentHands: { [SIM_NAME]: { 'sim-hand-1': { id: 'sim-hand-1', name: 'Lightning Bolt' } } },
    activePlayerId: 'p2',
    activePlayerName: SIM_NAME,
    priorityPlayerName: SIM_NAME,
    turn: 3,
  })
}

describe('GameBoard bajo control del turno ajeno (Mindslaver)', () => {
  beforeEach(() => {
    setState({ game: null, gameId: null, switchedHandKey: null })
  })
  afterEach(() => {
    setState({ game: null, gameId: null, switchedHandKey: null })
    cleanup()
  })

  it('marca los objetos jugables del controlado y despacha su click', () => {
    setState({ game: controlledGame(), gameId: 'g-1' })
    const onPlayableClick = vi.fn()
    const onCombatClick = vi.fn()
    const { container } = render(
      <GameBoard game={getState().game} playableIds={['opp-perm']} onPlayableClick={onPlayableClick} />,
    )
    const perm = container.querySelector('.opponent-zone [data-card-id="opp-perm"]')
    expect(perm).not.toBeNull()
    expect(perm!.className).toContain('playable')

    fireEvent.click(perm!)
    expect(onPlayableClick).toHaveBeenCalledWith('opp-perm')
    expect(onCombatClick).not.toHaveBeenCalled()
  })

  it('aplica los props de combate del controlado (selectable/chosen)', () => {
    setState({ game: controlledGame(), gameId: 'g-1' })
    const onCombatClick = vi.fn()
    const { container } = render(
      <GameBoard
        game={getState().game}
        combatSelectable={['opp-perm']}
        combatChosen={['opp-chosen']}
        combatMode="attack"
        onCombatClick={onCombatClick}
      />,
    )
    const chosen = container.querySelector('.opponent-zone [data-card-id="opp-chosen"]')
    expect(chosen).not.toBeNull()
    expect(chosen!.className).toContain('chosen')

    fireEvent.click(container.querySelector('.opponent-zone [data-card-id="opp-perm"]')!)
    expect(onCombatClick).toHaveBeenCalledWith('opp-perm')
  })

  it('la barra de mano muestra la mano controlada al activar Switch Hands y su click envía el id', () => {
    setState({ game: controlledGame(), gameId: 'g-1' })
    const onPlayableClick = vi.fn()
    const { getByTestId, container } = render(
      <GameBoard game={getState().game} playableIds={['sim-hand-1']} onPlayableClick={onPlayableClick} />,
    )
    expect(container.querySelector('[data-testid="hand-bar"] [data-card-id="my-hand"]')).not.toBeNull()

    const switchBtn = getByTestId('hand-switch-btn')
    expect(switchBtn.parentElement?.classList.contains('board-shell')).toBe(true)
    fireEvent.click(switchBtn)
    expect(getState().switchedHandKey).toBe(SIM_NAME)
    const bar = container.querySelector('[data-testid="hand-bar"]')
    expect(bar!.querySelector('[data-card-id="sim-hand-1"]')).not.toBeNull()
    expect(bar!.querySelector('[data-card-id="my-hand"]')).toBeNull()

    fireEvent.click(bar!.querySelector('[data-card-id="sim-hand-1"]')!)
    expect(onPlayableClick).toHaveBeenCalledWith('sim-hand-1')

    fireEvent.click(getByTestId('hand-switch-btn'))
    expect(getState().switchedHandKey).toBeNull()
    expect(container.querySelector('[data-testid="hand-bar"] [data-card-id="my-hand"]')).not.toBeNull()
  })
})
