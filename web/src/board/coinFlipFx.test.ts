import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { observeCoinFlip, forgetCoinFlip, startCoinFlip, clearCoinFlipFx, COIN_FLIP_MS } from './coinFlipFx'
import { soundManager } from '../audio/soundManager'
import { getState, setState } from '../state/state'
import { makeGameView, makePlayer } from '../__fixtures__/gameViews'
import type { GameView } from '../net/types'
import type { FeedbackPrompt } from '../game/feedback'
import { detectAndAnimateTransitions } from './gameTransitionEngine'
import { getFeedbackFxState } from './feedbackFx'

const alice = makePlayer({ playerId: 'p-alice', name: 'Alice', controlled: true })
const bob = makePlayer({ playerId: 'p-bob', name: 'Bob' })

function preGame(): GameView {
  return makeGameView({ turn: 0, activePlayerId: null, activePlayerName: '', players: [alice, bob] })
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

const mulliganPrompt = { isMulligan: true, isMulliganLondon: false, gameId: 'g1' } as unknown as FeedbackPrompt

let gameSeq = 0

describe('coin flip trigger', () => {
  let g1 = ''
  let g2 = ''

  beforeEach(() => {
    g1 = `game-${++gameSeq}`
    g2 = `game-${++gameSeq}`
    clearCoinFlipFx()
    setState({ feedback: null })
    vi.spyOn(soundManager, 'play').mockImplementation(() => {})
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    clearCoinFlipFx()
    vi.restoreAllMocks()
  })

  it('fires once when turn 1 follows the pre-game view, and returns the coin duration', () => {
    observeCoinFlip(preGame(), g1)
    const ms = observeCoinFlip(turn(1, 'p-bob'), g1)
    expect(ms).toBe(COIN_FLIP_MS)
    expect(soundManager.play).toHaveBeenCalledTimes(1)
  })

  it('does not fire again on later updates of the same turn or on later turns', () => {
    observeCoinFlip(preGame(), g1)
    observeCoinFlip(turn(1, 'p-bob'), g1)
    expect(observeCoinFlip(turn(1, 'p-bob'), g1)).toBe(0)
    expect(observeCoinFlip(turn(1, 'p-alice'), g1)).toBe(0)
    expect(observeCoinFlip(turn(2, 'p-alice'), g1)).toBe(0)
    expect(soundManager.play).toHaveBeenCalledTimes(1)
  })

  it('does not fire while the mulligan prompt is open, and fires once it closes', () => {
    observeCoinFlip(preGame(), g1)
    setState({ feedback: mulliganPrompt })
    expect(observeCoinFlip(turn(1, 'p-alice'), g1)).toBe(0)
    expect(soundManager.play).not.toHaveBeenCalled()
    setState({ feedback: null })
    expect(observeCoinFlip(turn(1, 'p-alice'), g1)).toBe(COIN_FLIP_MS)
    expect(soundManager.play).toHaveBeenCalledTimes(1)
  })

  it('does not fire on a reconnect that lands mid-game (first view already at turn 1)', () => {
    expect(observeCoinFlip(turn(3, 'p-alice'), g1)).toBe(0)
    expect(observeCoinFlip(turn(1, 'p-bob'), g1)).toBe(0)
    expect(soundManager.play).not.toHaveBeenCalled()
  })

  it('does not fire again for the same game after a reconnect replays turn 1', () => {
    observeCoinFlip(preGame(), g1)
    observeCoinFlip(turn(1, 'p-bob'), g1)
    expect(observeCoinFlip(turn(1, 'p-bob'), g1)).toBe(0)
    expect(soundManager.play).toHaveBeenCalledTimes(1)
  })

  it('tracks each game id on its own', () => {
    observeCoinFlip(preGame(), g1)
    observeCoinFlip(turn(1, 'p-bob'), g1)
    observeCoinFlip(preGame(), g2)
    expect(observeCoinFlip(turn(1, 'p-alice'), g2)).toBe(COIN_FLIP_MS)
  })

  it('forgetCoinFlip re-arms the game (used by the gallery replay)', () => {
    observeCoinFlip(preGame(), g1)
    observeCoinFlip(turn(1, 'p-bob'), g1)
    forgetCoinFlip(g1)
    observeCoinFlip(preGame(), g1)
    expect(observeCoinFlip(turn(1, 'p-bob'), g1)).toBe(COIN_FLIP_MS)
  })

  it('ignores views without a game id', () => {
    observeCoinFlip(preGame(), null)
    expect(observeCoinFlip(turn(1, 'p-bob'), null)).toBe(0)
    expect(soundManager.play).not.toHaveBeenCalled()
  })

  it('plays the coin sound once at the toss', () => {
    observeCoinFlip(preGame(), g1)
    observeCoinFlip(turn(1, 'p-bob'), g1)
    expect(vi.mocked(soundManager.play)).toHaveBeenCalledWith('coin_flip', 'game')
    expect(vi.mocked(soundManager.play).mock.calls.filter(([key]) => key === 'coin_flip')).toHaveLength(1)
  })

  it('the turn banner waits for the coin before it shows', () => {
    const prev = preGame()
    const next = turn(1, 'p-bob')
    observeCoinFlip(prev, g1)
    const ms = observeCoinFlip(next, g1)
    expect(ms).toBe(COIN_FLIP_MS)
    detectAndAnimateTransitions(prev, next, ms)
    expect(getFeedbackFxState().banner).toBeNull()
    vi.advanceTimersByTime(COIN_FLIP_MS)
    expect(getFeedbackFxState().banner?.text).toContain('Bob')
  })

  it('startCoinFlip plays the toss sound once and returns 0 when effects are off', () => {
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
