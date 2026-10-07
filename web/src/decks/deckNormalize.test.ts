import { describe, expect, it } from 'vitest'
import { normalizeDeckCard, prepareDeckForXMage } from './deckNormalize'
import { BASIC_LAND_PRESETS } from './deckUtils'
import type { DeckCard } from '../lobby/decks'

const c = (cardName: string, setCode: string, cardNumber: string): DeckCard => ({
  cardName,
  setCode,
  cardNumber,
  amount: 1,
})

describe('deckNormalize', () => {
  it('conserva la impresión de Scryfall tal cual (la normalización para el servidor es del proxy)', () => {
    expect(normalizeDeckCard(c('Rhystic Tutor', 'PCY', '77'))).toMatchObject({ setCode: 'PCY', cardNumber: '77' })
    expect(normalizeDeckCard(c('Bear', 'PLST', 'ORI-123'))).toMatchObject({ setCode: 'PLST', cardNumber: 'ORI-123' })
    expect(normalizeDeckCard(c('Bear', 'M21', '123p')).cardNumber).toBe('123p')
    expect(normalizeDeckCard(c('Bear', 'M21', '123★')).cardNumber).toBe('123★')
  })

  it('no toca una básica que ya trae impresión', () => {
    expect(normalizeDeckCard(c('Forest', 'LEA', '294'))).toMatchObject({ setCode: 'LEA', cardNumber: '294' })
  })

  it('rellena la impresión de una básica importada sin set/número (mazo de texto plano)', () => {
    for (const preset of BASIC_LAND_PRESETS) {
      expect(normalizeDeckCard(c(preset.name, '', ''))).toMatchObject({
        setCode: preset.setCode,
        cardNumber: preset.cardNumber,
      })
    }
  })

  it('no toca una no-básica sin impresión (queda para validateDeck/DeckIssuesDialog)', () => {
    expect(normalizeDeckCard(c('Sol Ring', '', ''))).toMatchObject({ setCode: '', cardNumber: '' })
  })

  it('prepareDeckForXMage rellena básicas sin impresión en cards y sideboard (mazos ya guardados antes del fix)', () => {
    const blankForest = c('Forest', '', '')
    const blankIsland = c('Island', '', '')
    const out = prepareDeckForXMage({ name: 'D', cards: [blankForest], sideboard: [blankIsland] })
    expect(out.cards[0]).toMatchObject({ setCode: 'DMU', cardNumber: '281' })
    expect(out.sideboard[0]).toMatchObject({ setCode: 'DMU', cardNumber: '278' })
  })

  it('prepareDeckForXMage adjunta los comandantes designados (1 o 2) y los pone primero', () => {
    const atraxa = { ...c("Atraxa, Praetors' Voice", '2XM', '190') }
    const sidar = { ...c('Sidar Kondo of Jamuraa', 'PC2', '1') }
    const tana = { ...c('Tana, the Bloodsower', 'C16', '56') }
    const forest = { ...c('Forest', 'LEA', '294'), amount: 98 }

    const one = prepareDeckForXMage({ name: 'D', cards: [forest, atraxa], sideboard: [], commanderCard: atraxa }, 'Variant Magic - Commander', 'Commander Two Player Duel')
    expect(one.commanders).toEqual([atraxa])
    expect(one.cards[0]).toEqual(atraxa)

    const pair = prepareDeckForXMage({ name: 'D', cards: [forest, tana, sidar], sideboard: [], commanderCard: sidar, partnerCard: tana }, 'Variant Magic - Commander', 'Commander Two Player Duel')
    expect(pair.commanders).toEqual([sidar, tana])
    expect(pair.cards.slice(0, 2)).toEqual([sidar, tana])

    // No es formato comandante: no se toca nada
    const freeform = prepareDeckForXMage({ name: 'D', cards: [forest, atraxa], sideboard: [], commanderCard: atraxa }, 'Variant Magic - Freeform', 'Two Player Duel')
    expect(freeform.commanders).toBeUndefined()
  })
})
