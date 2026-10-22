import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { observeCoinFlip, forgetCoinFlip, startCoinFlip, clearCoinFlipFx, useCoinFlipFx, COIN_FLIP_MS } from './coinFlipFx'
import { soundManager } from '../audio/soundManager'
import { getState, setState } from '../state/state'
import { makeGameView, makePlayer } from '../__fixtures__/gameViews'
import type { GameView } from '../net/types'
import { detectAndAnimateTransitions } from './gameTransitionEngine'
import { clearFeedbackFx, getFeedbackFxState } from './feedbackFx'

const alice = makePlayer({ playerId: 'p-alice', name: 'Alice', controlled: true })
const bob = makePlayer({ playerId: 'p-bob', name: 'Bob' })

/** The mulligan views the server sends: turn 1, phase and step null, nobody active. */
function mulligan(): GameView {
  return makeGameView({ turn: 1, phase: null, step: null, activePlayerId: null, activePlayerName: '', players: [alice, bob] })
}

/** The first phased view of turn 1, as the server sends it after the mulligan is answered. */
function upkeep(activeId: string | null): GameView {
  return turn(1, activeId, { phase: 'BEGINNING', step: 'UPKEEP' })
}

function turn(n: number, activeId: string | null, extra: Partial<GameView> = {}): GameView {
  const active = activeId === 'p-alice' ? 'Alice' : 'Bob'
  return makeGameView({
    turn: n,
    activePlayerId: activeId,
    activePlayerName: active,
    players: [
      { ...alice, isActive: activeId === 'p-alice' },
      { ...bob, isActive: activeId === 'p-bob' },
    ],
    ...extra,
  })
}

let gameSeq = 0

describe('coin flip trigger', () => {
  let g1 = ''
  let g2 = ''

  beforeEach(() => {
    g1 = `game-${++gameSeq}`
    g2 = `game-${++gameSeq}`
    clearCoinFlipFx()
    clearFeedbackFx()
    setState({ feedback: null })
    vi.spyOn(soundManager, 'play').mockImplementation(() => {})
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    clearCoinFlipFx()
    vi.restoreAllMocks()
  })

  it('FX-9: does not fire on the mulligan view (turn 1, phase and step null) and does not consume the once guard', () => {
    expect(observeCoinFlip(mulligan(), g1)).toBe(0)
    expect(soundManager.play).not.toHaveBeenCalled()
    expect(observeCoinFlip(upkeep('p-bob'), g1)).toBe(COIN_FLIP_MS)
    expect(soundManager.play).toHaveBeenCalledTimes(1)
  })

  it('FX-9: fires on the first phased turn-1 view with the active player as the first player', () => {
    observeCoinFlip(mulligan(), g1)
    const { result } = renderHook(() => useCoinFlipFx())
    act(() => {
      expect(observeCoinFlip(upkeep('p-bob'), g1)).toBe(COIN_FLIP_MS)
    })
    expect(result.current?.name).toBe('Bob')
    expect(soundManager.play).toHaveBeenCalledTimes(1)
  })

  it('FX-9: falls back to the isActive player when activePlayerId is missing', () => {
    const { result } = renderHook(() => useCoinFlipFx())
    const view = upkeep(null)
    view.players = (view.players ?? []).map((p) => ({ ...p, isActive: p.playerId === 'p-alice' }))
    act(() => {
      expect(observeCoinFlip(view, g1)).toBe(COIN_FLIP_MS)
    })
    expect(result.current?.name).toBe('Alice')
  })

  it('FX-9: does not fire again for later views of the same game', () => {
    observeCoinFlip(mulligan(), g1)
    observeCoinFlip(upkeep('p-bob'), g1)
    expect(observeCoinFlip(upkeep('p-bob'), g1)).toBe(0)
    expect(observeCoinFlip(turn(1, 'p-alice', { phase: 'MAIN', step: 'PRECOMBAT_MAIN' }), g1)).toBe(0)
    expect(observeCoinFlip(turn(2, 'p-alice', { phase: 'BEGINNING', step: 'UPKEEP' }), g1)).toBe(0)
    expect(soundManager.play).toHaveBeenCalledTimes(1)
  })

  it('FX-9: tracks each game id on its own', () => {
    observeCoinFlip(mulligan(), g1)
    observeCoinFlip(upkeep('p-bob'), g1)
    observeCoinFlip(mulligan(), g2)
    expect(observeCoinFlip(upkeep('p-alice'), g2)).toBe(COIN_FLIP_MS)
    expect(soundManager.play).toHaveBeenCalledTimes(2)
  })

  it('FX-9: does not fire when the first view a client sees is mid-game (reconnect or spectator)', () => {
    expect(observeCoinFlip(turn(20, 'p-bob', { phase: 'MAIN', step: 'PRECOMBAT_MAIN' }), g1)).toBe(0)
    expect(soundManager.play).not.toHaveBeenCalled()
  })

  it('FX-9: does not fire when the step is null even if the phase is set', () => {
    expect(observeCoinFlip(turn(1, 'p-bob', { phase: 'BEGINNING', step: null }), g1)).toBe(0)
    expect(soundManager.play).not.toHaveBeenCalled()
  })

  it('forgetCoinFlip re-arms the game (used by the gallery replay)', () => {
    observeCoinFlip(mulligan(), g1)
    observeCoinFlip(upkeep('p-bob'), g1)
    forgetCoinFlip(g1)
    observeCoinFlip(mulligan(), g1)
    expect(observeCoinFlip(upkeep('p-bob'), g1)).toBe(COIN_FLIP_MS)
  })

  it('ignores views without a game id', () => {
    expect(observeCoinFlip(upkeep('p-bob'), null)).toBe(0)
    expect(soundManager.play).not.toHaveBeenCalled()
  })

  it('FX-9: plays the coin sound once at the toss', () => {
    observeCoinFlip(mulligan(), g1)
    observeCoinFlip(upkeep('p-bob'), g1)
    expect(vi.mocked(soundManager.play)).toHaveBeenCalledWith('coin_flip', 'game')
    expect(vi.mocked(soundManager.play).mock.calls.filter(([key]) => key === 'coin_flip')).toHaveLength(1)
  })

  it('FX-1, FX-9: does not fire when effects are off, and does not run the coin on the phased view', () => {
    const prev = getState().settings
    setState({ settings: { ...prev, effects: false } })
    try {
      observeCoinFlip(mulligan(), g1)
      expect(observeCoinFlip(upkeep('p-bob'), g1)).toBe(0)
      expect(soundManager.play).not.toHaveBeenCalled()
    } finally {
      setState({ settings: prev })
    }
  })

  it('FX-10: the turn-1 banner waits for the coin after the mulligan view', () => {
    const prev = mulligan()
    const next = upkeep('p-bob')
    observeCoinFlip(prev, g1)
    const ms = observeCoinFlip(next, g1)
    expect(ms).toBe(COIN_FLIP_MS)
    detectAndAnimateTransitions(prev, next, ms)
    expect(getFeedbackFxState().banner).toBeNull()
    vi.advanceTimersByTime(COIN_FLIP_MS)
    expect(getFeedbackFxState().banner?.text).toContain('Bob')
  })

  it('FX-10: a turn banner is not delayed when no coin runs for that view', () => {
    const turnOne = upkeep('p-bob')
    const turnTwo = turn(2, 'p-alice', { phase: 'BEGINNING', step: 'UPKEEP' })
    observeCoinFlip(mulligan(), g1)
    observeCoinFlip(turnOne, g1)
    const ms = observeCoinFlip(turnTwo, g1)
    expect(ms).toBe(0)
    detectAndAnimateTransitions(turnOne, turnTwo, ms)
    expect(getFeedbackFxState().banner?.text).toContain('Alice')
  })

  it('FX-10: the turn banner is not announced for the mulligan view (turn 1, phase null)', () => {
    const pregame = turn(0, null, { phase: 'MAIN', step: 'PRECOMBAT_MAIN' })
    detectAndAnimateTransitions(pregame, mulligan(), 0)
    expect(getFeedbackFxState().banner).toBeNull()
  })

  it('FX-1: startCoinFlip plays the toss sound once and returns 0 when effects are off', () => {
    const prev = getState().settings
    setState({ settings: { ...prev, effects: false } })
    try {
      expect(startCoinFlip('Alice', 'var(--seat-0)')).toBe(0)
      expect(soundManager.play).not.toHaveBeenCalled()
    } finally {
      setState({ settings: prev })
    }
  })
})
