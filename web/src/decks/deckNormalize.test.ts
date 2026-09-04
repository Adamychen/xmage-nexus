import { describe, expect, it } from 'vitest'
import { normalizeDeckCard } from './deckNormalize'
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
})
