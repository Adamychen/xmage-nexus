import { describe, it, expect } from 'vitest'
import { parseDck, exportDck, exportArena, parseAnyDeck } from './parseDck'

describe('parseDck', () => {
  it('parses NAME and main+SB lines', () => {
    const text = `NAME:RB Aggro
1 [WAR:2*] Ugin, the Ineffable
1 [ODY:72+] Cephalid Looter
SB: 3 [ZNR:315] Archon of Emeria
SB: 1 [ZNR:133] Akoum Hellhound
LAYOUT MAIN:(1,2)(CARD_TYPE,false,68)|([ZNR:177])
`
    const d = parseDck(text)
    expect(d).not.toBeNull()
    expect(d!.name).toBe('RB Aggro')
    expect(d!.cards).toHaveLength(2)
    expect(d!.cards[0]).toEqual({ cardName: 'Ugin, the Ineffable', setCode: 'WAR', cardNumber: '2*', amount: 1 })
    expect(d!.sideboard).toHaveLength(2)
    expect(d!.sideboard[0].cardName).toBe('Archon of Emeria')
  })

  it('roundtrips exportDck', () => {
    const deck = {
      name: 'Test',
      cards: [
        { cardName: 'Lightning Bolt', setCode: 'M10', cardNumber: '146', amount: 4 },
        { cardName: 'Mountain', setCode: 'LEA', cardNumber: '292', amount: 20 },
      ],
      sideboard: [{ cardName: 'Red Elemental Blast', setCode: '4ED', cardNumber: '218', amount: 2 }],
    }
    const out = exportDck(deck)
    const back = parseDck(out)
    expect(back!.cards).toHaveLength(2)
    expect(back!.sideboard).toHaveLength(1)
    expect(back!.name).toBe('Test')
  })

  it('parses Arena format via parseAnyDeck', () => {
    const text = `Deck
4 Lightning Bolt (M10) 146
20 Mountain (LEA) 292

Sideboard
2 Red Elemental Blast (4ED) 218
`
    const d = parseAnyDeck(text)
    expect(d!.cards[0].cardName).toBe('Lightning Bolt')
    expect(d!.sideboard[0].cardName).toBe('Red Elemental Blast')
  })

  it('parses SB: prefix in txt', () => {
    const text = `4 Lightning Bolt
SB: 3 Pyroblast
`
    const d = parseAnyDeck(text)!
    expect(d.sideboard[0].cardName).toBe('Pyroblast')
  })

  it('exportArena format', () => {
    const deck = {
      name: 'A',
      cards: [{ cardName: 'Mountain', setCode: 'LEA', cardNumber: '292', amount: 20 }],
      sideboard: [],
    }
    const out = exportArena(deck)
    expect(out).toContain('Deck')
    expect(out).toContain('20 Mountain (LEA) 292')
  })
})
