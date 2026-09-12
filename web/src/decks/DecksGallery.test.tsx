import { describe, expect, it } from 'vitest'
import { cloneDeckForEdit, mergeEnrichedColors } from './DecksGallery'
import type { DeckV2 } from './types'

describe('cloneDeckForEdit (AUDIT bloqueante)', () => {
  it('conserva comandante, pareja y favorito al clonar un precon Commander', () => {
    const atraxa = { cardName: "Atraxa, Praetors' Voice", setCode: 'C16', cardNumber: '28', amount: 1 }
    const sidar = { cardName: 'Sidar Kondo of Jamuraa', setCode: 'PC2', cardNumber: '1', amount: 1 }
    const tana = { cardName: 'Tana, the Bloodsower', setCode: 'C16', cardNumber: '56', amount: 1 }
    const precon = {
      id: 'precon-0-x',
      name: 'CMD',
      format: 'Commander',
      colors: ['W', 'U', 'B', 'G'],
      cards: [atraxa],
      sideboard: [],
      coverCard: atraxa,
      commanderCard: sidar,
      partnerCard: tana,
      favorite: true,
      createdAt: 1,
      updatedAt: 1,
      source: 'precon',
    } as unknown as DeckV2

    const clone = cloneDeckForEdit(precon)
    expect(clone.id).not.toBe(precon.id)
    expect(clone.source).toBe('custom')
    expect(clone.commanderCard).toEqual(sidar)
    expect(clone.partnerCard).toEqual(tana)
    expect(clone.favorite).toBe(true)
    expect(clone.coverCard).toEqual(atraxa)
  })
})

describe('mergeEnrichedColors (AUDIT)', () => {
  const mountain = { cardName: 'Mountain', setCode: 'LEA', cardNumber: '292', amount: 60 }
  const forest = { cardName: 'Forest', setCode: 'LEA', cardNumber: '294', amount: 60 }
  const deckOf = (over: Record<string, unknown>) => ({
    id: 'd1',
    name: 'D',
    format: 'Freeform',
    colors: [],
    cards: [mountain],
    sideboard: [],
    createdAt: 0,
    updatedAt: 0,
    source: 'custom',
    ...over,
  }) as unknown as DeckV2

  it('aplica colores cuando el mazo no cambió', () => {
    const cur = [deckOf({})]
    const enriched = [deckOf({ colors: ['R'] })]
    const merged = mergeEnrichedColors(cur, enriched)
    expect(merged[0].colors).toEqual(['R'])
  })

  it('no pisa ediciones del usuario hechas durante los fetches', () => {
    const cur = [deckOf({ cards: [mountain, forest] })]
    const enriched = [deckOf({ colors: ['R'] })]
    expect(mergeEnrichedColors(cur, enriched)).toBe(cur)
  })

  it('no toca mazos que ya tienen colores', () => {
    const cur = [deckOf({ colors: ['G'] })]
    const enriched = [deckOf({ colors: ['R'] })]
    expect(mergeEnrichedColors(cur, enriched)).toBe(cur)
  })
})
