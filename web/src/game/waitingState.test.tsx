// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ActionButton from './ActionButton'
import { LONG_WAIT_SECS, formatElapsed, waitingState } from './waitingState'
import { makeCard, makeGameView, makePlayer } from '../__fixtures__/gameViews'
import { setLanguage } from '../i18n'
import { setState } from '../state/state'
import { UNLIMITED_TIME } from '../utils/timer'
import type { FeedbackPrompt } from './feedback'
import type { GameView } from '../net/types'

const me = (hasPriority = false) => makePlayer({ playerId: 'me', name: 'Me', controlled: true, hasPriority })
const ana = (hasPriority = false, priorityTimeLeftSecs = 0) => makePlayer({ playerId: 'a', name: 'Ana', hasPriority, priorityTimeLeftSecs })
const bo = (hasPriority = false) => makePlayer({ playerId: 'b', name: 'Bo', hasPriority })

function renderButton(game: GameView) {
  return render(<ActionButton game={game} feedback={null} gameId="g" canPass={false} onPass={vi.fn()} onSkip={vi.fn()} />)
}

describe('waitingState', () => {
  beforeEach(() => setLanguage('en'))
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('names the player who actually holds priority in multiplayer', () => {
    const game = makeGameView({ players: [me(), ana(), bo(true)], turn: 3, step: 'UPKEEP' })
    expect(waitingState(game, null)).toMatchObject({ playerId: 'b', name: 'Bo', timeLeftSecs: null })
  })

  it('falls back to priorityPlayerName and ignores own decisions', () => {
    const byName = makeGameView({ players: [me(), ana()], priorityPlayerName: 'Ana' })
    expect(waitingState(byName, null)?.name).toBe('Ana')
    expect(waitingState(makeGameView({ players: [me(true), ana()] }), null)).toBeNull()
    const fb = { method: 'GAME_ASK', gameId: 'g', title: '', message: '', mode: 'boolean', options: [], min: 0, max: 0 } as FeedbackPrompt
    expect(waitingState(makeGameView({ players: [me(), ana(true)] }), fb)).toBeNull()
  })

  it('keeps only a real countdown and keys on step and stack', () => {
    expect(waitingState(makeGameView({ players: [me(), ana(true, 95)] }), null)?.timeLeftSecs).toBe(95)
    expect(waitingState(makeGameView({ players: [me(), ana(true, UNLIMITED_TIME)] }), null)?.timeLeftSecs).toBeNull()
    const a = waitingState(makeGameView({ players: [me(), ana(true)], step: 'UPKEEP' }), null)!.key
    const b = waitingState(makeGameView({ players: [me(), ana(true)], step: 'DRAW' }), null)!.key
    const c = waitingState(makeGameView({ players: [me(), ana(true)], step: 'DRAW', stack: { s1: makeCard({ id: 's1', name: 'Opt' }) } }), null)!.key
    expect(new Set([a, b, c]).size).toBe(3)
  })

  it('explains the mulligan phase instead of an unexplained wait', () => {
    const pregame = makeGameView({ players: [me(), ana()], turn: 1, step: null, phase: null } as never)
    expect(waitingState(pregame, null)).toMatchObject({ preGame: true, name: '' })
    expect(waitingState(pregame, null, 'Ana')).toMatchObject({ preGame: true, playerId: 'a', name: 'Ana' })
    expect(waitingState(pregame, null, 'Me')).toMatchObject({ preGame: true, name: '' })
    expect(waitingState(makeGameView({ players: [me(), ana()], step: 'UPKEEP', phase: 'BEGINNING' } as never), null)).toBeNull()
  })

  it('labels the action button with the mulligan wait', () => {
    const pregame = makeGameView({ players: [me(), ana()], turn: 1, step: null, phase: null } as never)
    setState({ waitingFor: null })
    const first = renderButton(pregame)
    expect(first.getByRole('button', { name: /Mulligan — waiting for other players/ })).not.toBeNull()
    first.unmount()
    setState({ waitingFor: 'Ana' })
    const second = renderButton(pregame)
    expect(second.getByRole('button', { name: /Mulligan — waiting for Ana/ })).not.toBeNull()
    setState({ waitingFor: null })
  })

  it('formats elapsed time', () => {
    expect(formatElapsed(0)).toBe('0:00')
    expect(formatElapsed(83)).toBe('1:23')
  })

  it('shows waiting instead of Resolve while the opponent holds priority over a stack', () => {
    const game = makeGameView({ players: [me(), ana(true)], stack: { s1: makeCard({ id: 's1', name: 'Shock' }) } })
    const { getByRole } = renderButton(game)
    expect(getByRole('button', { name: /Waiting for Ana/ })).not.toBeNull()
  })

  it('ticks the thinking clock, counts down the timer and flags long waits', () => {
    vi.useFakeTimers()
    const game = makeGameView({ players: [me(), ana(true, 300)], step: 'UPKEEP' })
    const { getByTestId, rerender } = renderButton(game)
    act(() => {
      vi.advanceTimersByTime(23_000)
    })
    const clock = getByTestId('waiting-clock')
    expect(clock.textContent).toContain('thinking 0:23')
    expect(clock.textContent).toContain('04:37 left')
    expect(clock.classList.contains('is-long')).toBe(false)
    act(() => {
      vi.advanceTimersByTime((LONG_WAIT_SECS - 23) * 1000)
    })
    expect(getByTestId('waiting-clock').classList.contains('is-long')).toBe(true)

    rerender(<ActionButton game={makeGameView({ players: [me(), ana(true, 300)], step: 'DRAW' })} feedback={null} gameId="g" canPass={false} onPass={vi.fn()} onSkip={vi.fn()} />)
    expect(getByTestId('waiting-clock').textContent).toContain('thinking 0:00')
  })
})
