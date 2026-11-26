import { describe, expect, it } from 'vitest'
import { isOpeningHandDecision, openingHandHeld } from './openingHand'
import type { GameView } from '../net/types'
import type { FeedbackPrompt } from '../game/feedback'

const preGame = { turn: 1, phase: null, step: null } as unknown as GameView
const running = { turn: 1, phase: 'PRECOMBAT_MAIN', step: 'PRECOMBAT_MAIN' } as unknown as GameView

const ask = (over: Partial<FeedbackPrompt>) => ({ method: 'GAME_ASK', message: '', ...over }) as FeedbackPrompt

describe('HND-14: the hand in the pre-game', () => {
  it('HND-14: is held while the pre-game has asked nothing about it', () => {
    expect(openingHandHeld(preGame, null, false)).toBe(true)
    expect(openingHandHeld(preGame, ask({ isMulligan: false }), false)).toBe(true)
  })

  it('HND-14: shows as soon as the keep-or-mulligan question is on screen', () => {
    expect(openingHandHeld(preGame, ask({ isMulligan: true }), false)).toBe(false)
  })

  it('HND-14: shows while the London cards are being put back', () => {
    expect(openingHandHeld(preGame, ask({ isMulligan: true, isMulliganLondon: true }), false)).toBe(false)
  })

  it('HND-14: stays once the question has been asked in this game, so a keep does not empty the bar', () => {
    expect(openingHandHeld(preGame, null, true)).toBe(false)
  })

  it('HND-14: never holds the hand of a game that is already running', () => {
    expect(openingHandHeld(running, null, false)).toBe(false)
    expect(openingHandHeld(null, null, false)).toBe(false)
  })

  it('HND-14: reads both halves of the opening decision as the decision', () => {
    expect(isOpeningHandDecision(ask({ isMulligan: true }))).toBe(true)
    expect(isOpeningHandDecision(ask({ isMulligan: true, isMulliganLondon: true }))).toBe(true)
    expect(isOpeningHandDecision(ask({}))).toBe(false)
    expect(isOpeningHandDecision(null)).toBe(false)
  })
})
