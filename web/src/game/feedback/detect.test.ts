import { describe, expect, it } from 'vitest'
import {
  booleanValueOf,
  detectPlaneswalkerChoice,
  isDiscardMessage,
  isLondonBottoming,
  isMulliganAsk,
  isStartingPlayerMessage,
  isVotingAsk,
} from './detect'
import { parseFeedback } from './parse'
import type { FeedbackTextFn } from './types'

describe('feedback detectors (pure, no i18n)', () => {
  it('matches mulligan asks in English and Spanish', () => {
    expect(isMulliganAsk('Keep your hand or mulligan?')).toBe(true)
    expect(isMulliganAsk('Mulligan?')).toBe(true)
    expect(isMulliganAsk('Pay 2 life?')).toBe(false)
  })

  it('matches starting-player prompts in English and Spanish', () => {
    expect(isStartingPlayerMessage('Choose who goes first')).toBe(true)
    expect(isStartingPlayerMessage('Elige quién empieza')).toBe(true)
    expect(isStartingPlayerMessage('Choose a target')).toBe(false)
  })

  it('matches voting prompts via message or question', () => {
    expect(isVotingAsk('Vote, step 1 of 2')).toBe(true)
    expect(isVotingAsk('Elige', 'vote for a player')).toBe(true)
    expect(isVotingAsk('Choose a target')).toBe(false)
  })

  it('matches discard prompts in English and Spanish', () => {
    expect(isDiscardMessage('Choose a card for them to discard')).toBe(true)
    expect(isDiscardMessage('Elige una carta para descartar')).toBe(true)
    expect(isDiscardMessage('Choose a target')).toBe(false)
  })

  it('matches London bottoming prompts (exact server phrasing)', () => {
    expect(isLondonBottoming('Select a card to put on the bottom of your library')).toBe(true)
    expect(isLondonBottoming('Select a card to put on the bottom of the library')).toBe(true)
    expect(isLondonBottoming('Put a card on the bottom')).toBe(false)
  })

  it('detects planeswalker loyalty options with deltas', () => {
    const { isPW, deltas } = detectPlaneswalkerChoice(
      [
        { id: 'a1', label: '+2: Scry 1', value: 'a1' },
        { id: 'a2', label: '-3: Draw 2', value: 'a2' },
      ],
      'Activate an ability',
    )
    expect(isPW).toBe(true)
    expect(deltas).toEqual([2, -3])
    expect(detectPlaneswalkerChoice([{ id: 'a', label: 'Triggered ability', value: 'a' }], 'Choose').isPW).toBe(false)
  })

  it('maps boolean labels positionally with keyword overrides', () => {
    expect(booleanValueOf('Mulligan', 1)).toBe('true')
    expect(booleanValueOf('Keep hand', 0)).toBe('false')
    expect(booleanValueOf('Yes, go ahead', 2)).toBe('true')
    expect(booleanValueOf('No, thank you', 1)).toBe('false')
    expect(booleanValueOf('Maybe', 0)).toBe('true')
    expect(booleanValueOf('Never mind', 3)).toBe('false')
  })
})

describe('parseFeedback with injected display strings (no i18n)', () => {
  const stub: FeedbackTextFn = (ns, key, params) =>
    params ? `[${ns}.${key} ${JSON.stringify(params)}]` : `[${ns}.${key}]`

  it('parses structure identically with stub strings', () => {
    const prompt = parseFeedback('GAME_CHOOSE_MODE', 'game-7', { message: 'Choose a mode' }, stub)
    expect(prompt).toMatchObject({ mode: 'uuid', title: '[game.choose_mode]', message: 'Choose a mode' })
  })

  it('routes voting/mulligan flags without the translator', () => {
    const voting = parseFeedback('GAME_ASK', 'g', { message: 'Vote now', options: { a: 'A' } }, stub)
    expect(voting?.isVoting).toBe(true)
    expect(voting?.title).toBe('[dialogs.voting_title]')
    const mulligan = parseFeedback('GAME_ASK', 'g', { message: 'Mulligan?', options: {} }, stub)
    expect(mulligan?.isMulligan).toBe(true)
    expect(mulligan?.options).toEqual([
      { id: 'keep', label: '[dialogs.mulligan_keep]', value: 'false' },
      { id: 'mulligan', label: '[dialogs.mulligan_btn]', value: 'true' },
    ])
  })

  it('uses injected fallbacks for unknown targets and multi-amounts', () => {
    const target = parseFeedback('GAME_TARGET', 'g', { message: 'Choose', targets: ['abc'] }, stub)
    expect(target?.options).toEqual([{ id: 'abc', label: '[game.target_fallback {"index":"1","id":"abc"}]', value: 'abc' }])
    const multi = parseFeedback('GAME_GET_MULTI_AMOUNT', 'g', { messages: [{ id: 'x' }] }, stub)
    expect(multi?.items?.[0].label).toBe('[game.amount_fallback {"index":"1"}]')
  })
})
