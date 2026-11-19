import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { forgetPreviousView, useGameTransitions } from './gameTransitionEngine'
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

describe('FX-15: two unrelated views are never diffed', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    clearFlights()
    clearCardPositionRegistry()
    vi.mocked(announceBanner).mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const run = () => renderHook(({ g, id }: { g: GameView | null; id: string | null }) => useGameTransitions(g, id), {
    initialProps: { g: null as GameView | null, id: null as string | null },
  })

  it('FX-15: the next view of the same game is diffed as always', () => {
    const { rerender } = run()
    rerender({ g: start(), id: 'g1' })
    rerender({ g: turnStart(), id: 'g1' })
    vi.advanceTimersByTime(10_000)
    expect(announceBanner).toHaveBeenCalled()
  })

  it('FX-15: a view the screen was told to forget the previous one for is drawn, not diffed', () => {
    const { rerender } = run()
    rerender({ g: start(), id: 'g1' })
    vi.mocked(announceBanner).mockClear()
    forgetPreviousView()
    rerender({ g: turnStart(), id: 'g1' })
    vi.advanceTimersByTime(10_000)
    expect(announceBanner).not.toHaveBeenCalled()
  })

  it('FX-15: the view after the forgotten one is diffed again, it is one swap and not a mode', () => {
    const { rerender } = run()
    rerender({ g: start(), id: 'g1' })
    forgetPreviousView()
    rerender({ g: start(), id: 'g1' })
    vi.mocked(announceBanner).mockClear()
    rerender({ g: turnStart(), id: 'g1' })
    vi.advanceTimersByTime(10_000)
    expect(announceBanner).toHaveBeenCalled()
  })
})
