import { describe, expect, it } from 'vitest'
import { applySuggestion, deckIssueKey, findFlaggedSameName, issueKeysFromReport } from './deckIssues'
import type { DeckValidationResult } from '../net/types'

const report: DeckValidationResult = {
  ready: true,
  missing: [
    { cardName: 'Rhystic Tutor', setCode: 'CY', cardNumber: '77', amount: 1, reason: 'OUTDATED_PRINTING', suggestions: [{ cardName: 'Rhystic Tutor', setCode: 'PCY', cardNumber: '77' }] },
  ],
  mismatches: [
    { cardName: 'Banisher Priest', setCode: 'C20', cardNumber: '77', amount: 2, resolvedName: 'Banisher Priest' },
  ],
}

describe('deckIssues helpers', () => {
  it('deckIssueKey compone name|set|num', () => {
    expect(deckIssueKey('A', 'B', 'C')).toBe('A|B|C')
  })

  it('issueKeysFromReport marca missing y mismatches', () => {
    const keys = issueKeysFromReport(report)
    expect(keys.has('Rhystic Tutor|CY|77')).toBe(true)
    expect(keys.has('Banisher Priest|C20|77')).toBe(true)
    expect(keys.size).toBe(2)
  })

  it('applySuggestion reemplaza en main y sideboard conservando el resto', () => {
    const deck = {
      name: 't',
      cards: [
        { cardName: 'Island', setCode: 'M21', cardNumber: '265' },
        { cardName: 'Rhystic Tutor', setCode: 'CY', cardNumber: '77' },
      ],
      sideboard: [{ cardName: 'Rhystic Tutor', setCode: 'CY', cardNumber: '77' }],
    }
    const next = applySuggestion(deck, { cardName: 'Rhystic Tutor', setCode: 'CY', cardNumber: '77' }, { cardName: 'Rhystic Tutor', setCode: 'PCY', cardNumber: '77' })
    expect(next.cards[1]).toEqual({ cardName: 'Rhystic Tutor', setCode: 'PCY', cardNumber: '77' })
    expect(next.sideboard[0]).toEqual({ cardName: 'Rhystic Tutor', setCode: 'PCY', cardNumber: '77' })
    expect(next.cards[0]).toEqual({ cardName: 'Island', setCode: 'M21', cardNumber: '265' })
  })

  it('applySuggestion no toca otras impresiones del mismo nombre', () => {
    const deck = {
      name: 't',
      cards: [{ cardName: 'Rhystic Tutor', setCode: 'PRO', cardNumber: '77' }],
      sideboard: [],
    }
    const next = applySuggestion(deck, { cardName: 'Rhystic Tutor', setCode: 'CY', cardNumber: '77' }, { cardName: 'Rhystic Tutor', setCode: 'PCY', cardNumber: '77' })
    expect(next.cards[0].setCode).toBe('PRO')
  })

  it('findFlaggedSameName localiza solo entradas marcadas', () => {
    const cards = [
      { cardName: 'Island', setCode: 'M21', cardNumber: '265' },
      { cardName: 'Rhystic Tutor', setCode: 'CY', cardNumber: '77' },
    ]
    const flagged = issueKeysFromReport(report)
    expect(findFlaggedSameName(cards, flagged, 'Rhystic Tutor')).toBe(1)
    expect(findFlaggedSameName(cards, flagged, 'Island')).toBe(-1)
    const okCards = [{ cardName: 'Rhystic Tutor', setCode: 'PCY', cardNumber: '77' }]
    expect(findFlaggedSameName(okCards, flagged, 'Rhystic Tutor')).toBe(-1)
  })
})
