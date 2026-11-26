import { describe, expect, it } from 'vitest'
import { isOpeningHandDecision, openingHandHeld, openingHandKey } from './openingHand'
import type { GameView } from '../net/types'
import type { FeedbackPrompt } from '../game/feedback'

const preGame = { turn: 1, phase: null, step: null, myHand: { a: {}, b: {} } } as unknown as GameView
const dealtAgain = { turn: 1, phase: null, step: null, myHand: { c: {}, d: {} } } as unknown as GameView
const firstHand = openingHandKey(preGame)
const running = { turn: 1, phase: 'PRECOMBAT_MAIN', step: 'PRECOMBAT_MAIN', myHand: { a: {} } } as unknown as GameView

const ask = (over: Partial<FeedbackPrompt>) => ({ method: 'GAME_ASK', message: '', ...over }) as FeedbackPrompt

describe('HND-14: the hand in the pre-game', () => {
  it('HND-14: is held while the pre-game has asked nothing about it', () => {
    expect(openingHandHeld(preGame, null, null)).toBe(true)
    expect(openingHandHeld(preGame, ask({ isMulligan: false }), null)).toBe(true)
  })

  it('HND-14: shows as soon as the keep-or-mulligan question is on screen', () => {
    expect(openingHandHeld(preGame, ask({ isMulligan: true }), null)).toBe(false)
  })

  it('HND-14: shows while the London cards are being put back', () => {
    expect(openingHandHeld(preGame, ask({ isMulligan: true, isMulliganLondon: true }), null)).toBe(false)
  })

  it('HND-14: stays once the question has been asked about this hand, so a keep does not empty the bar', () => {
    expect(openingHandHeld(preGame, null, firstHand)).toBe(false)
  })

  it('HND-14: a mulligan deals another hand, which waits for its own question', () => {
    expect(openingHandHeld(dealtAgain, null, firstHand)).toBe(true)
    expect(openingHandHeld(dealtAgain, ask({ isMulligan: true }), firstHand)).toBe(false)
  })

  it('HND-14: never holds the hand of a game that is already running', () => {
    expect(openingHandHeld(running, null, null)).toBe(false)
    expect(openingHandHeld(null, null, null)).toBe(false)
  })

  it('HND-14: reads both halves of the opening decision as the decision', () => {
    expect(isOpeningHandDecision(ask({ isMulligan: true }))).toBe(true)
    expect(isOpeningHandDecision(ask({ isMulligan: true, isMulliganLondon: true }))).toBe(true)
    expect(isOpeningHandDecision(ask({}))).toBe(false)
    expect(isOpeningHandDecision(null)).toBe(false)
  })
})
