import { describe, expect, it } from 'vitest'
import { normalizeDeckCard, prepareDeckForXMage } from './deckNormalize'
import type { DeckCard } from '../lobby/decks'

const c = (cardName: string, setCode: string, cardNumber: string): DeckCard => ({
  cardName,
  setCode,
  cardNumber,
  amount: 1,
})

describe('deckNormalize', () => {
  it('no mutila sets reales con prefijo P (PCY, PRO, PC2)', () => {
    expect(normalizeDeckCard(c('Rhystic Tutor', 'PCY', '77'))).toMatchObject({ setCode: 'PCY', cardNumber: '77' })
    expect(normalizeDeckCard(c('Rhystic Tutor', 'PRO', '77'))).toMatchObject({ setCode: 'PRO', cardNumber: '77' })
    expect(normalizeDeckCard(c('Bear', 'PC2', '1'))).toMatchObject({ setCode: 'PC2', cardNumber: '1' })
  })

  it('mantiene códigos P desconocidos tal cual (el proxy decide en el borde)', () => {
    expect(normalizeDeckCard(c('Foo', 'PZZZ', '1')).setCode).toBe('PZZZ')
  })

  it('PLST con número compuesto se reduce al set original', () => {
    expect(normalizeDeckCard(c('Bear', 'PLST', 'ORI-123'))).toMatchObject({ setCode: 'ORI', cardNumber: '123' })
  })

  it('número con prefijo de set se reduce al último tramo', () => {
    expect(normalizeDeckCard(c('Bear', 'SLD', 'SLD-456')).cardNumber).toBe('456')
  })

  it('sufijos promo del número se limpian', () => {
    expect(normalizeDeckCard(c('Bear', 'M21', '123p')).cardNumber).toBe('123')
    expect(normalizeDeckCard(c('Bear', 'M21', '123★')).cardNumber).toBe('123')
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
