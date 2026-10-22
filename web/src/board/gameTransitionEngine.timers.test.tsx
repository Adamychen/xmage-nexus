import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useGameTransitions } from './gameTransitionEngine'
import { announceBanner } from './feedbackFx'
import { clearFlights } from './flightManager'
import { clearCardPositionRegistry } from './cardPositionRegistry'
import { makeGameView, makePlayer } from '../__fixtures__/gameViews'
import type { GameView } from '../net/types'

vi.mock('./feedbackFx', async (importOriginal) => {
  const mod = await importOriginal<typeof import('./feedbackFx')>()
  return { ...mod, announceBanner: vi.fn() }
})

function game(over: Partial<GameView>): GameView {
  return makeGameView({
    turn: 1,
    phase: 'PRECOMBAT_MAIN',
    step: null,
    activePlayerId: 'p1',
    players: [makePlayer({ playerId: 'p1', name: 'Alice', isActive: true, controlled: true })],
    ...over,
  } as Partial<GameView>)
}

const start = () => game({ phase: null, step: null })
const turnStart = () => game({ phase: 'BEGINNING', step: 'UNTAP' })

describe('useGameTransitions timers', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    clearFlights()
    clearCardPositionRegistry()
    vi.mocked(announceBanner).mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('FX-10: drops the banner of a finished game instead of firing it in the next one', () => {
    const { rerender } = renderHook(({ g, id }: { g: GameView | null; id: string | null }) => useGameTransitions(g, id), {
      initialProps: { g: null as GameView | null, id: null as string | null },
    })
    rerender({ g: start(), id: 'g1' })
    rerender({ g: turnStart(), id: 'g1' })
    rerender({ g: null, id: null })
    vi.advanceTimersByTime(10_000)
    expect(announceBanner).not.toHaveBeenCalled()
  })

  it('FX-10: drops the banner of the previous game when a new game id arrives', () => {
    const { rerender } = renderHook(({ g, id }: { g: GameView | null; id: string | null }) => useGameTransitions(g, id), {
      initialProps: { g: null as GameView | null, id: null as string | null },
    })
    rerender({ g: start(), id: 'g2' })
    rerender({ g: turnStart(), id: 'g2' })
    rerender({ g: start(), id: 'g-next' })
    vi.advanceTimersByTime(10_000)
    expect(announceBanner).not.toHaveBeenCalled()
  })

  it('FX-10: still announces the banner of a game that keeps running', () => {
    const { rerender } = renderHook(({ g, id }: { g: GameView | null; id: string | null }) => useGameTransitions(g, id), {
      initialProps: { g: null as GameView | null, id: null as string | null },
    })
    rerender({ g: start(), id: 'g3' })
    rerender({ g: turnStart(), id: 'g3' })
    vi.advanceTimersByTime(10_000)
    expect(announceBanner).toHaveBeenCalledTimes(1)
  })
})
