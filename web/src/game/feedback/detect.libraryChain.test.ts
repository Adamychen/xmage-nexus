import { describe, expect, it } from 'vitest'
import { isLibraryOrderPick, libraryChainStep } from './detect'
import { parseFeedback } from './parse'

const SURVEIL = 'Select card(s) to PUT into your GRAVEYARD (Surveil)'

describe('libraryChainStep', () => {
  it('detects the surveil pick', () => {
    expect(libraryChainStep(SURVEIL)).toBe('surveil-pick')
  })
  it('detects the scry pick', () => {
    expect(libraryChainStep('Select up to 3 cards to PUT on the BOTTOM of your library (Scry)')).toBe('scry-pick')
  })
  it('detects the top order', () => {
    expect(libraryChainStep('Select a card ORDER to put on the TOP of your library (last one chosen will be topmost)')).toBe('top-order')
  })
  it('detects the bottom order', () => {
    expect(libraryChainStep('Select a card ORDER to put on the BOTTOM of your library (last one chosen will be bottommost)')).toBe('bottom-order')
  })
  it('detects the graveyard order', () => {
    expect(libraryChainStep('Select a card to put on the top of your graveyard (last one chosen will be topmost)')).toBe('grave-order')
  })
  it('detects the graveyard order ask', () => {
    expect(libraryChainStep('Choose the order in which the cards go to the graveyard?')).toBe('grave-order-ask')
  })
  it('strips HTML and ignores case', () => {
    expect(libraryChainStep('<b>select card(s) to put into your graveyard (surveil)</b>')).toBe('surveil-pick')
  })
  it('returns null for unrelated prompts', () => {
    expect(libraryChainStep('Select a card to discard')).toBeNull()
  })
  it('isLibraryOrderPick is also true for the bottommost message', () => {
    expect(isLibraryOrderPick('Select a card ORDER to put on the BOTTOM of your library (last one chosen will be bottommost)')).toBe(true)
  })
  it("flags libraryStep only for the controlled player's library cards", () => {
    const withCards = parseFeedback('GAME_TARGET', 'game-1', {
      targets: ['c1'],
      message: SURVEIL,
      cardsView1: { c1: { id: 'c1', name: 'Forest' } },
    })
    expect(withCards?.libraryStep).toBe('surveil-pick')
    expect(withCards?.mode).toBe('uuid')
    const noCards = parseFeedback('GAME_TARGET', 'game-1', { targets: [], message: SURVEIL, cardsView1: {} })
    expect(noCards?.libraryStep).toBeUndefined()
  })
  it('flags the graveyard order ask on GAME_ASK', () => {
    const ask = parseFeedback('GAME_ASK', 'game-1', { message: 'Choose the order in which the cards go to the graveyard?' })
    expect(ask?.libraryStep).toBe('grave-order-ask')
  })
})
