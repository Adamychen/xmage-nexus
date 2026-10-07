import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setGateway } from '../net/commands'
import type { Gateway } from '../net/Gateway'
import { fetchFormatIssues, xmageDeckTypeFor, applySuggestion, applySuggestions, autoResolveFixes, deckIssueKey, fixesForIssue, issuePrintings, findFlaggedSameName, issueKeysFromReport } from './deckIssues'
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

  it('applySuggestion arrastra comandante/pareja/portada a la nueva impresión (AUDIT)', () => {
    const deck = {
      name: 'CMD',
      cards: [{ cardName: 'Sidar Kondo of Jamuraa', setCode: 'PC2', cardNumber: '1', amount: 1 }],
      sideboard: [],
      commanderCard: { cardName: 'Sidar Kondo of Jamuraa', setCode: 'PC2', cardNumber: '1', amount: 1 },
      coverCard: { cardName: 'Sidar Kondo of Jamuraa', setCode: 'PC2', cardNumber: '1', amount: 1 },
    }
    const next = applySuggestion(deck, { cardName: 'Sidar Kondo of Jamuraa', setCode: 'PC2', cardNumber: '1' }, { cardName: 'Sidar Kondo of Jamuraa', setCode: 'CMR', cardNumber: '535' })
    expect(next.commanderCard).toMatchObject({ setCode: 'CMR', cardNumber: '535' })
    expect(next.coverCard).toMatchObject({ setCode: 'CMR', cardNumber: '535' })
    expect(next.cards[0]).toMatchObject({ setCode: 'CMR', cardNumber: '535' })
  })

  it('autoResolveFixes takes the first suggestion of every flagged card that has one', () => {
    const withMismatchSuggestion: DeckValidationResult = {
      ...report,
      mismatches: [
        { ...report.mismatches[0], suggestions: [{ cardName: 'Banisher Priest', setCode: 'M14', cardNumber: '7' }, { cardName: 'Banisher Priest', setCode: 'C20', cardNumber: '1' }] },
      ],
    }
    expect(autoResolveFixes(report)).toEqual([
      { from: { cardName: 'Rhystic Tutor', setCode: 'CY', cardNumber: '77' }, to: { cardName: 'Rhystic Tutor', setCode: 'PCY', cardNumber: '77' } },
    ])
    expect(autoResolveFixes(withMismatchSuggestion).map((f) => f.to.setCode)).toEqual(['PCY', 'M14'])
  })

  it('applySuggestions applies every fix across main and sideboard', () => {
    const deck = {
      name: 't',
      cards: [
        { cardName: 'Rhystic Tutor', setCode: 'CY', cardNumber: '77' },
        { cardName: 'Banisher Priest', setCode: 'C20', cardNumber: '77' },
      ],
      sideboard: [{ cardName: 'Rhystic Tutor', setCode: 'CY', cardNumber: '77' }],
    }
    const next = applySuggestions(deck, [
      { from: { cardName: 'Rhystic Tutor', setCode: 'CY', cardNumber: '77' }, to: { cardName: 'Rhystic Tutor', setCode: 'PCY', cardNumber: '77' } },
      { from: { cardName: 'Banisher Priest', setCode: 'C20', cardNumber: '77' }, to: { cardName: 'Banisher Priest', setCode: 'M14', cardNumber: '7' } },
    ])
    expect(next.cards.map((c) => c.setCode)).toEqual(['PCY', 'M14'])
    expect(next.sideboard[0].setCode).toBe('PCY')
    expect(applySuggestions(deck, [])).toBe(deck)
  })

  it('a normalized promo printing still reaches the raw entry stored in the deck', () => {
    const promo: DeckValidationResult = {
      ready: true,
      missing: [{
        cardName: "Agatha's Soul Cauldron", setCode: 'WOE', cardNumber: '242s', amount: 1, reason: 'OUTDATED_PRINTING',
        suggestions: [{ cardName: "Agatha's Soul Cauldron", setCode: 'WOE', cardNumber: '242' }],
        sources: [{ setCode: 'PWOE', cardNumber: '242s' }],
      }],
      mismatches: [],
    }
    expect(issueKeysFromReport(promo).has("Agatha's Soul Cauldron|PWOE|242s")).toBe(true)
    expect(issuePrintings(promo.missing[0]).map((p) => p.setCode)).toEqual(['WOE', 'PWOE'])
    const deck = { name: 't', cards: [{ cardName: "Agatha's Soul Cauldron", setCode: 'PWOE', cardNumber: '242s' }], sideboard: [] }
    const viaRow = applySuggestions(deck, fixesForIssue(promo.missing[0], promo.missing[0].suggestions![0]))
    expect(viaRow.cards[0]).toEqual({ cardName: "Agatha's Soul Cauldron", setCode: 'WOE', cardNumber: '242' })
    expect(applySuggestions(deck, autoResolveFixes(promo)).cards[0].setCode).toBe('WOE')
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

describe('fetchFormatIssues (official XMage DeckValidator)', () => {
  const send = vi.fn()
  const deck = { name: 'Test', cards: [], sideboard: [] }
  const formatReport = { ready: true, supported: true, valid: false, validator: 'Commander', errors: [{ type: 'DECK_SIZE', message: 'Must contain 100 cards' }] }

  beforeEach(() => {
    send.mockReset()
    setGateway({ send } as unknown as Gateway)
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    setGateway(null)
    vi.restoreAllMocks()
  })

  it('validates with the config.xml deck type matching the format', async () => {
    send.mockResolvedValue({ ok: true, data: formatReport })
    expect(await fetchFormatIssues(deck, 'Commander')).toBe(formatReport)
    expect(send).toHaveBeenCalledWith('validateDeckFormat', { deck, deckType: 'Variant Magic - Commander', gameType: undefined })
  })

  it('formats without an XMage validator keep the local validation', async () => {
    expect(xmageDeckTypeFor('Timeless')).toBeNull()
    expect(await fetchFormatIssues(deck, 'Timeless')).toBeNull()
    expect(send).not.toHaveBeenCalled()
  })

  it.each([
    ['card DB not ready', { ...formatReport, ready: false }],
    ['format without a validator in this release', { ...formatReport, supported: false }],
  ])('drops the report when: %s', async (_label, data) => {
    // Such a report says valid=false with no errors: using it would flag the deck as illegal for no reason.
    send.mockResolvedValue({ ok: true, data })
    expect(await fetchFormatIssues(deck, 'Modern')).toBeNull()
  })

  it('a proxy failure does not break the builder', async () => {
    send.mockRejectedValue(new Error('ws closed'))
    expect(await fetchFormatIssues(deck, 'Modern')).toBeNull()
    expect(console.warn).toHaveBeenCalled()
  })
})
