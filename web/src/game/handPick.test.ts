import { describe, expect, it } from 'vitest'
import { handPickIds, isPlainBooleanAsk } from './handPick'
import type { FeedbackPrompt } from './feedback'

const prompt = (partial: Partial<FeedbackPrompt>): FeedbackPrompt => ({
  method: 'GAME_TARGET',
  gameId: 'g',
  title: '',
  message: 'Select a card to discard',
  mode: 'uuid',
  options: [],
  min: 0,
  max: 1,
  ...partial,
})

describe('handPickIds', () => {
  it('returns the card ids when every card lives in the controller hand', () => {
    const cards = [{ id: 'h1', name: 'Forest' }, { id: 'h2', name: 'Bolt' }]
    expect(handPickIds(prompt({ cards }), new Set(['h1', 'h2']))).toEqual(['h1', 'h2'])
  })

  it('prefers the legal options when present (server-driven targets)', () => {
    const cards = [{ id: 'h1', name: 'Forest' }, { id: 'h2', name: 'Bolt' }]
    const options = [{ id: 'h1', label: 'Forest', value: 'h1' }]
    expect(handPickIds(prompt({ cards, options }), new Set(['h1', 'h2']))).toEqual(['h1'])
  })

  it('returns null when any card is outside the hand (grid stays source of truth)', () => {
    const cards = [{ id: 'h1', name: 'Forest' }, { id: 'b1', name: 'Bolt' }]
    expect(handPickIds(prompt({ cards }), new Set(['h1']))).toBeNull()
  })

  it('returns null when a legal option is outside the hand even if the shown cards are in it', () => {
    const cards = [{ id: 'h1', name: 'Forest' }]
    const options = [{ id: 'h1', label: 'Forest', value: 'h1' }, { id: 'g1', label: 'Bolt', value: 'g1' }]
    expect(handPickIds(prompt({ cards, options }), new Set(['h1']))).toBeNull()
  })

  it('returns null for other methods and for empty card lists', () => {
    expect(handPickIds(prompt({ method: 'GAME_CHOOSE_CARDS', cards: [{ id: 'h1', name: 'Forest' }] }), new Set(['h1']))).toBeNull()
    expect(handPickIds(prompt({ cards: [] }), new Set(['h1']))).toBeNull()
    expect(handPickIds(prompt({ cards: undefined }), new Set(['h1']))).toBeNull()
  })
})

describe('isPlainBooleanAsk', () => {
  it('accepts plain yes/no asks', () => {
    expect(isPlainBooleanAsk(prompt({ method: 'GAME_ASK', mode: 'boolean' }))).toBe(true)
  })

  it('rejects asks with a dedicated dialog or another mode', () => {
    expect(isPlainBooleanAsk(prompt({ method: 'GAME_ASK', mode: 'boolean', isMulligan: true }))).toBe(false)
    expect(isPlainBooleanAsk(prompt({ method: 'GAME_ASK', mode: 'boolean', isVoting: true }))).toBe(false)
    expect(isPlainBooleanAsk(prompt({ method: 'GAME_ASK', mode: 'boolean', isStartingPlayer: true }))).toBe(false)
    expect(isPlainBooleanAsk(prompt({ method: 'GAME_PLAY_XMANA', mode: 'boolean' }))).toBe(false)
    expect(isPlainBooleanAsk(prompt({ method: 'GAME_CHOOSE_CHOICE', mode: 'string' }))).toBe(false)
  })
})
