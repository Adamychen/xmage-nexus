import { describe, it, expect } from 'vitest'
import { parseDck, exportDck, exportArena, exportDek, parseAnyDeck, parseDekXml, parseCodXml, parseO8dXml, parseDraftLog, parseMtgjson } from './parseDck'

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

  it('parses Spanish and Japanese Arena formats with basic land normalization', () => {
    const spanishDeck = `Mazo
4 Lightning Bolt (M10) 146
20 Montaña (DMU) 280

Banquillo
2 Red Elemental Blast (4ED) 218
`
    const dSpanish = parseAnyDeck(spanishDeck)!
    expect(dSpanish.cards[0].cardName).toBe('Lightning Bolt')
    expect(dSpanish.cards[1].cardName).toBe('Mountain') // Montaña -> Mountain
    expect(dSpanish.sideboard[0].cardName).toBe('Red Elemental Blast')

    const japaneseDeck = `デッキ
4 Counterspell (MH2) 267
20 島 (DMU) 278

サイドボード
2 Spell Pierce (XLN) 81
`
    const dJapanese = parseAnyDeck(japaneseDeck)!
    expect(dJapanese.cards[0].cardName).toBe('Counterspell')
    expect(dJapanese.cards[1].cardName).toBe('Island') // 島 -> Island
    expect(dJapanese.sideboard[0].cardName).toBe('Spell Pierce')
  })

  it('parses MTGO .dek XML via parseAnyDeck (U6-4)', () => {
    const text = `<?xml version="1.0" encoding="utf-8"?>
<Deck>
<Cards CatID="61202" Quantity="4" Sideboard="false" Name="Lightning Bolt" />
<Cards CatID="100" Quantity="20" Sideboard="false" Name="Mountain" />
<Cards CatID="200" Quantity="2" Sideboard="true" Name="Pyroblast" />
<Cards CatID="300" Quantity="1" Sideboard="false" Name="Refuse/Cooperate" />
</Deck>
`
    const d = parseAnyDeck(text)!
    expect(d.cards).toHaveLength(3)
    expect(d.cards[0]).toMatchObject({ cardName: 'Lightning Bolt', amount: 4 })
    expect(d.sideboard).toHaveLength(1)
    expect(d.sideboard[0].cardName).toBe('Pyroblast')
    expect(d.cards[2].cardName).toBe('Refuse // Cooperate')
  })

  it('parses Cockatrice .cod XML (U6-4)', () => {
    const text = `<?xml version="1.0" encoding="UTF-8"?>
<cockatrice_deck version="1">
<deckname>Burn</deckname>
<comments></comments>
<zone name="main">
<card number="4" name="Lightning Bolt"/>
<card number="20" name="Mountain"/>
</zone>
<zone name="side">
<card number="2" name="Pyroblast"/>
</zone>
</cockatrice_deck>
`
    const d = parseCodXml(text)!
    expect(d.name).toBe('Burn')
    expect(d.cards).toHaveLength(2)
    expect(d.cards[0]).toMatchObject({ cardName: 'Lightning Bolt', amount: 4 })
    expect(d.sideboard).toHaveLength(1)
    expect(parseAnyDeck(text)!.name).toBe('Burn')
  })

  it('parses OCTGN .o8d XML (U6-4)', () => {
    const text = `<?xml version="1.0" encoding="utf-8"?>
<deck game="5830">
<section name="Main">
<card qty="4">Lightning Bolt</card>
<card qty="20">Mountain</card>
</section>
<section name="Sideboard">
<card qty="2">Pyroblast</card>
</section>
</deck>
`
    const d = parseO8dXml(text)!
    expect(d.cards).toHaveLength(2)
    expect(d.cards[0]).toMatchObject({ cardName: 'Lightning Bolt', amount: 4 })
    expect(d.sideboard).toHaveLength(1)
    expect(parseAnyDeck(text)!.sideboard[0].cardName).toBe('Pyroblast')
  })

  it('rejects malformed XML (U6-4)', () => {
    expect(parseCodXml('not xml at all {{{')).toBeNull()
    expect(parseO8dXml('<deck><section>unclosed')).toBeNull()
    expect(parseDekXml('4 Lightning Bolt')).toBeNull()
  })

  it('exports MTGO .dek shape: sideboard without SB: prefix (U6-5)', () => {
    const deck = {
      name: 'Burn',
      cards: [{ cardName: 'Lightning Bolt', setCode: 'M10', cardNumber: '146', amount: 4 }],
      sideboard: [{ cardName: 'Pyroblast', setCode: '5ED', cardNumber: '150', amount: 2 }],
    }
    const out = exportDek(deck)
    expect(out).toBe('4 Lightning Bolt\n\n2 Pyroblast\n')
    expect(out).not.toContain('SB:')
  })

  it('roundtrips printing-less imports through exportDck (U6-5)', () => {
    const imported = parseCodXml(`<?xml version="1.0"?>
<cockatrice_deck version="1">
<zone name="main"><card number="4" name="Lightning Bolt"/></zone>
<zone name="side"><card number="2" name="Pyroblast"/></zone>
</cockatrice_deck>
`)!
    const out = exportDck({ name: 'X', cards: imported.cards, sideboard: imported.sideboard })
    expect(out).toContain('4 Lightning Bolt')
    const back = parseAnyDeck(out)!
    expect(back.cards[0].cardName).toBe('Lightning Bolt')
    expect(back.sideboard[0].cardName).toBe('Pyroblast')
  })

  it('parses draft logs via parseAnyDeck (U7-1)', () => {
    const text = `------ NEO ------
--> Light-Paws, Emperor's Voice
-->  Unstoppable Ogre
------ SNC ------
--> Light-Paws, Emperor's Voice
--> Mountain
`
    const d = parseAnyDeck(text, 'Draft')!
    expect(d.name).toBe('Draft')
    expect(d.sideboard).toHaveLength(0)
    const paws = d.cards.filter((c) => c.cardName === "Light-Paws, Emperor's Voice")
    expect(paws).toHaveLength(2)
    expect(paws[0].setCode).toBe('NEO')
    expect(paws[1].setCode).toBe('SNC')
    expect(parseDraftLog('no picks here')).toBeNull()
  })

  it('parses mtgjson via parseAnyDeck (U7-2)', () => {
    const text = JSON.stringify({
      data: {
        name: 'Atraxa',
        code: 'C16',
        mainBoard: [{ name: 'Sol Ring', setCode: 'C16', count: 1 }],
        sideBoard: [{ name: 'Pyroblast', setCode: '', count: 2 }],
        commander: [{ name: "Atraxa, Praetors' Voice", count: 1 }],
      },
    })
    const d = parseAnyDeck(text)!
    expect(d.name).toBe('Atraxa')
    expect(d.cards[0].cardName).toBe("Atraxa, Praetors' Voice")
    expect(d.cards).toHaveLength(2)
    expect(d.sideboard[0]).toMatchObject({ cardName: 'Pyroblast', setCode: 'C16', amount: 2 })
    expect(parseMtgjson('{"nope":true}')).toBeNull()
    expect(parseMtgjson('{invalid')).toBeNull()
  })

  it('parses MWS bracket printing + deckstats comments (U7-3)', () => {
    const d = parseAnyDeck(`4 [M10] Lightning Bolt #removal
20 [LEA] Mountain
`)!
    expect(d.cards[0]).toMatchObject({ cardName: 'Lightning Bolt', setCode: 'M10' })
    expect(d.cards[1]).toMatchObject({ cardName: 'Mountain', setCode: 'LEA', amount: 20 })
  })

  it('switches to sideboard on first blank line without marks, MTGO-style (U7-3)', () => {
    const d = parseAnyDeck(`4 Lightning Bolt
20 Mountain

2 Pyroblast
`)!
    expect(d.cards).toHaveLength(2)
    expect(d.sideboard).toHaveLength(1)
    expect(d.sideboard[0].cardName).toBe('Pyroblast')
  })

  it('roundtrips own .dek export (U7-3)', () => {
    const deck = {
      name: 'Burn',
      cards: [{ cardName: 'Lightning Bolt', setCode: 'M10', cardNumber: '146', amount: 4 }],
      sideboard: [{ cardName: 'Pyroblast', setCode: '5ED', cardNumber: '150', amount: 2 }],
    }
    const back = parseAnyDeck(exportDek(deck))!
    expect(back.cards[0].cardName).toBe('Lightning Bolt')
    expect(back.sideboard[0].cardName).toBe('Pyroblast')
  })

  it('routes Commander first and Maybeboard to sideboard (U7-6)', () => {    const d = parseAnyDeck(`Commander
1 Atraxa, Praetors' Voice
Deck
99 Sol Ring
Maybeboard
1 Doubling Season
`)!
    expect(d.cards[0].cardName).toBe("Atraxa, Praetors' Voice")
    expect(d.cards).toHaveLength(2)
    expect(d.sideboard).toHaveLength(1)
    expect(d.sideboard[0].cardName).toBe('Doubling Season')
  })

  it('tolerates categorized exports with counts (U7-3)', () => {
    const d = parseAnyDeck(`Creatures (4)
4 Lightning Bolt

Sideboard (2)
2 Pyroblast
`)!
    expect(d.cards).toHaveLength(1)
    expect(d.sideboard).toHaveLength(1)
    expect(d.sideboard[0].cardName).toBe('Pyroblast')
  })
})

