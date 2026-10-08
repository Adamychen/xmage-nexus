import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, renderHook } from '@testing-library/react'
import { useDeckValidation } from './useDeckValidation'
import type { DeckV2 } from './types'
import type { CardStripMeta } from './ArenaCardStrip'
import type { DeckFormatValidationResult, DeckValidationResult } from '../net/types'

const deckOf = (cards: DeckV2['cards'], sideboard: DeckV2['sideboard'] = []): DeckV2 => ({
  id: 'd1',
  name: 'Test',
  format: 'Modern',
  cards,
  sideboard,
  colors: ['R'],
  createdAt: 0,
  updatedAt: 0,
  source: 'custom',
})

// 5 Lightning Bolt: the local Modern validation rejects it.
const fiveBolts = deckOf([
  { cardName: 'Mountain', setCode: 'LEA', cardNumber: '292', amount: 55 },
  { cardName: 'Lightning Bolt', setCode: 'M10', cardNumber: '146', amount: 5 },
])

const noMeta = new Map<string, CardStripMeta>()

afterEach(cleanup)

const xmageReport = (over: Partial<DeckFormatValidationResult>): DeckFormatValidationResult => ({
  ready: true,
  supported: true,
  valid: true,
  validator: 'Modern',
  errors: [],
  ...over,
})

const serverReport = (over: Partial<DeckValidationResult>): DeckValidationResult => ({
  ready: true,
  missing: [],
  mismatches: [],
  ...over,
})

function run(deck: DeckV2 | null, opts: { server?: DeckValidationResult | null; format?: DeckFormatValidationResult | null } = {}) {
  return renderHook(() => useDeckValidation(deck, noMeta, opts.server ?? null, 'Modern', null, opts.format ?? null)).result.current
}

describe('useDeckValidation', () => {
  it('no deck is valid and flags nothing', () => {
    const r = run(null, { server: serverReport({ missing: [{ cardName: 'X', setCode: 'S', cardNumber: '1', amount: 1, reason: 'UNIMPLEMENTED' }] }) })
    expect(r.validationReport.isValid).toBe(true)
    expect(r.mergedCardIssues.size).toBe(0)
  })

  describe('format validation', () => {
    it('without an XMage report it falls back to the local validation', () => {
      const r = run(fiveBolts)
      expect(r.validationReport.isValid).toBe(false)
      expect(r.mergedCardIssues.has('Lightning Bolt')).toBe(true)
      expect(r.xmageDeckIssues).toEqual([])
    })

    it('the XMage report replaces the local one even when they disagree', () => {
      // XMage decides what the server accepts: if it says valid, nothing is flagged.
      const r = run(fiveBolts, { format: xmageReport({ valid: true }) })
      expect(r.validationReport.isValid).toBe(true)
      expect(r.validationReport.issues).toEqual([])
      expect(r.mergedCardIssues.size).toBe(0)
    })

    it('turns XMage errors into deck-level and card-level issues', () => {
      const r = run(deckOf([{ cardName: 'Mountain', setCode: 'LEA', cardNumber: '292', amount: 60 }]), {
        format: xmageReport({
          valid: false,
          errors: [
            { type: 'DECK_SIZE', group: 'Deck', message: 'Must contain at least 60 cards' },
            { type: 'BANNED', message: 'Banned', cardName: 'Splinter Twin' },
            { type: 'OTHER' },
          ],
        }),
      })

      expect(r.validationReport.isValid).toBe(false)
      // group + message (desktop shows both columns); a group equal to the
      // validator, the card name or the message is dropped as redundant.
      expect(r.xmageDeckIssues.map((i) => i.message)).toEqual([
        'Modern: Deck: Must contain at least 60 cards',
        'Modern: Banned',
        'Modern: OTHER',
      ])
      expect(r.xmageDeckIssues.every((i) => i.type === 'xmage' && i.severity === 'error')).toBe(true)
      expect(r.validationReport.issues).toEqual(r.xmageDeckIssues)
      // Only errors naming a card get a badge.
      expect([...r.validationReport.cardIssues.keys()]).toEqual(['Splinter Twin'])
      expect(r.mergedCardIssues.get('Splinter Twin')!.message).toBe('Modern: Banned')
    })

    it('a valid report ignores stray errors', () => {
      const r = run(fiveBolts, { format: xmageReport({ valid: true, errors: [{ type: 'OTHER', message: 'noise' }] }) })
      expect(r.xmageDeckIssues).toEqual([])
    })

    it('keeps the detailed message when group is only a category (commander sideboard)', () => {
      // Real AbstractCommander errors: group is "Commander"/"Deck"/the card name,
      // the explanation lives in message. None may be dropped on render.
      const r = renderHook(() =>
        useDeckValidation(fiveBolts, noMeta, null, 'Commander', null, xmageReport({
          validator: 'Commander',
          valid: false,
          errors: [
            { type: 'PRIMARY', group: 'Commander', message: 'Sideboard must contain only the commander(s) and up to 1 companion' },
            { type: 'DECK_SIZE', group: 'Deck', message: 'Must contain 101 cards: has 104 cards' },
            { type: 'OTHER', group: 'Shock', message: 'Invalid color identity (includes R, but your commander(s) allow only U)', cardName: 'Shock' },
            { type: 'OTHER', group: 'Deck rejected', message: 'Deck rejected' },
          ],
        })),
      ).result.current
      expect(r.xmageDeckIssues.map((i) => i.message)).toEqual([
        'Commander: Sideboard must contain only the commander(s) and up to 1 companion',
        'Commander: Deck: Must contain 101 cards: has 104 cards',
        'Commander: Invalid color identity (includes R, but your commander(s) allow only U)',
        'Commander: Deck rejected',
      ])
      expect(r.mergedCardIssues.get('Shock')!.message).toBe('Commander: Invalid color identity (includes R, but your commander(s) allow only U)')
    })
  })

  describe('server printing issues (validateDeck)', () => {
    const deck = deckOf(
      [
        { cardName: 'Mountain', setCode: 'LEA', cardNumber: '292', amount: 52 },
        { cardName: 'Lightning Bolt', setCode: 'M10', cardNumber: '146', amount: 4 },
        { cardName: 'Shock', setCode: 'ZZZ', cardNumber: '9', amount: 4 },
      ],
      [{ cardName: 'Unfinity Card', setCode: 'UNF', cardNumber: '1', amount: 1 }],
    )

    const server = serverReport({
      missing: [
        {
          cardName: 'Shock', setCode: 'ZZZ', cardNumber: '9', amount: 4, reason: 'OUTDATED_PRINTING',
          suggestions: [{ cardName: 'Shock', setCode: 'M21', cardNumber: '159' }, { cardName: 'Shock', setCode: 'M19', cardNumber: '156' }],
        },
        { cardName: 'Unfinity Card', setCode: 'UNF', cardNumber: '1', amount: 1, reason: 'UNIMPLEMENTED' },
      ],
      mismatches: [
        {
          cardName: 'Lightning Bolt', setCode: 'M10', cardNumber: '146', amount: 4, resolvedName: 'Lava Spike',
          suggestions: [{ cardName: 'Lightning Bolt', setCode: 'M11', cardNumber: '149' }],
        },
      ],
    })

    it('flags every affected printing, sideboard included', () => {
      const r = run(deck, { server })
      expect(r.mergedCardIssues.get('ZZZ:9:Shock')).toMatchObject({ type: 'server_issue', message: 'Esa impresión (set/número) no existe' })
      expect(r.mergedCardIssues.get('UNF:1:Unfinity Card')!.message).toBe('No implementada en el servidor')
      expect(r.mergedCardIssues.get('M10:146:Lightning Bolt')!.message).toBe('El servidor cargará «Lava Spike» en su lugar')
      expect(r.mergedCardIssues.has('LEA:292:Mountain')).toBe(false)
      expect(r.serverFlaggedKeys.size).toBe(3)
    })

    it('adds to the format issues instead of replacing them', () => {
      const r = run(deck, {
        server,
        format: xmageReport({ valid: false, errors: [{ type: 'BANNED', message: 'Banned', cardName: 'Shock' }] }),
      })
      expect(r.mergedCardIssues.get('Shock')!.type).toBe('xmage')
      expect(r.mergedCardIssues.get('ZZZ:9:Shock')!.type).toBe('server_issue')
    })

    it('matches the raw printing the client stored (sources)', () => {
      const promo = deckOf([{ cardName: 'Ragavan', setCode: 'PMH2', cardNumber: '138p', amount: 1 }])
      const r = run(promo, {
        server: serverReport({
          missing: [{
            cardName: 'Ragavan', setCode: 'MH2', cardNumber: '138p', amount: 1, reason: 'OUTDATED_PRINTING',
            sources: [{ setCode: 'PMH2', cardNumber: '138p' }],
          }],
        }),
      })
      expect(r.mergedCardIssues.has('PMH2:138p:Ragavan')).toBe(true)
    })

    it('lists the issues with the first suggestion as the fix', () => {
      const r = run(deck, { server })
      expect(r.serverIssueList).toEqual([
        {
          kind: 'missing', name: 'Shock', set: 'ZZZ', num: '9', amount: 4,
          message: 'Esa impresión (set/número) no existe',
          to: { cardName: 'Shock', setCode: 'M21', cardNumber: '159' },
          fixes: [{ from: { cardName: 'Shock', setCode: 'ZZZ', cardNumber: '9' }, to: { cardName: 'Shock', setCode: 'M21', cardNumber: '159' } }],
        },
        {
          kind: 'missing', name: 'Unfinity Card', set: 'UNF', num: '1', amount: 1,
          message: 'No implementada en el servidor',
          to: undefined,
          fixes: [],
        },
        {
          kind: 'mismatch', name: 'Lightning Bolt', set: 'M10', num: '146', amount: 4,
          message: 'El servidor cargará «Lava Spike» en su lugar',
          to: { cardName: 'Lightning Bolt', setCode: 'M11', cardNumber: '149' },
          fixes: [{ from: { cardName: 'Lightning Bolt', setCode: 'M10', cardNumber: '146' }, to: { cardName: 'Lightning Bolt', setCode: 'M11', cardNumber: '149' } }],
        },
      ])
    })

    it('without a server report there is no list and no keys', () => {
      const r = run(deck)
      expect(r.serverIssueList).toEqual([])
      expect(r.serverFlaggedKeys.size).toBe(0)
    })
  })
})
