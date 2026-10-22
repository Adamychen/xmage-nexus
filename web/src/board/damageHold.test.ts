import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CardView, GameView } from '../net/types'
import { detectAndAnimateTransitions } from './gameTransitionEngine'
import { clearCardPositionRegistry, recordCardPosition } from './cardPositionRegistry'
import { clearFlights } from './flightManager'
import { useDisplayedGame } from './damageHold'
import { clearStackHold } from './stackHold'

const rect = (left: number, top: number): DOMRect =>
  ({ left, top, width: 80, height: 112, right: left + 80, bottom: top + 112, x: left, y: top, toJSON: () => {} } as DOMRect)

const bolt = { id: 'bolt-1', name: 'Lightning Bolt', targets: ['p1'] } as unknown as CardView

function game(life: number, stack: Record<string, CardView>): GameView {
  return {
    turn: 1,
    activePlayerId: 'p1',
    activePlayerName: 'Alice',
    players: [{ playerId: 'p1', name: 'Alice', life, battlefield: {}, graveyard: {}, exile: {}, isActive: true }],
    stack,
    combat: [],
  } as unknown as GameView
}

describe('useDisplayedGame', () => {
  beforeEach(() => {
    vi.useRealTimers()
    clearStackHold()
    clearFlights()
    clearCardPositionRegistry()
    document.body.innerHTML = '<div class="player-info-bar" data-player-id="p1" data-player-name="Alice"></div>'
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('FX-6: keeps the life from before a spell hit until its projectile lands', async () => {
    recordCardPosition('bolt-1', rect(1000, 500), 'stack-zone')
    const prev = game(20, { 'bolt-1': bolt })
    const next = game(17, {})
    const { result, rerender } = renderHook(({ g }) => useDisplayedGame(g, 'hold-life', false), {
      initialProps: { g: prev },
    })

    rerender({ g: next })
    expect(result.current?.players?.[0].life).toBe(20)

    detectAndAnimateTransitions(prev, next)
    await act(() => new Promise((resolve) => setTimeout(resolve, 700)))
    expect(result.current?.players?.[0].life).toBe(17)
  })

  it('FX-6: shows the raw game when the view is frozen (rewind)', () => {
    const prev = game(20, { 'bolt-1': bolt })
    const next = game(17, {})
    const { result, rerender } = renderHook(({ g, frozen }) => useDisplayedGame(g, 'hold-frozen', frozen), {
      initialProps: { g: prev, frozen: false },
    })
    rerender({ g: next, frozen: false })
    expect(result.current?.players?.[0].life).toBe(20)
    rerender({ g: next, frozen: true })
    expect(result.current?.players?.[0].life).toBe(17)
  })
})
