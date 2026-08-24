import { describe, expect, it } from 'vitest'
import { isBlockingModal } from './selectors'
import { initialState } from './state'
import type { AppState } from './state'

const base = (): AppState => structuredClone(initialState)

describe('isBlockingModal', () => {
  it('is false on a normal in-game state', () => {
    expect(isBlockingModal(base())).toBe(false)
  })

  it('is true for mulligan feedback', () => {
    const s = base()
    s.feedback = { method: 'GAME_ASK', isMulligan: true, gameId: 'g', title: '', message: '', min: 0, max: 0 } as never
    expect(isBlockingModal(s)).toBe(true)
  })

  it('is true for starting-player feedback', () => {
    const s = base()
    s.feedback = { method: 'GAME_ASK', isStartingPlayer: true, gameId: 'g', title: '', message: '', options: [], min: 0, max: 0 } as never
    expect(isBlockingModal(s)).toBe(true)
  })

  it('is true for library-order (mode order) feedback', () => {
    const s = base()
    s.feedback = { method: 'GAME_CHOOSE_CARDS_ORDER', mode: 'order', gameId: 'g', title: '', message: '', items: [], min: 0, max: 0 } as never
    expect(isBlockingModal(s)).toBe(true)
  })

  it('is true for a card-grid GAME_TARGET feedback', () => {
    const s = base()
    s.feedback = { method: 'GAME_TARGET', options: [], cards: [{ id: 'c1', name: 'Forest' }], sourceName: '', min: 0, max: 0, gameId: 'g' } as never
    expect(isBlockingModal(s)).toBe(true)
  })

  it('is false for a plain GAME_TARGET (in-board targeting bar)', () => {
    const s = base()
    s.feedback = { method: 'GAME_TARGET', options: [], sourceName: '', min: 0, max: 0, gameId: 'g' } as never
    expect(isBlockingModal(s)).toBe(false)
  })

  it('is true when userRequest, sideboardScreen or viewer are open', () => {
    const a = base()
    a.userRequest = { title: '', message: '', buttons: [] }
    expect(isBlockingModal(a)).toBe(true)

    const b = base()
    b.sideboardScreen = { deckName: '', maindeck: [], sideboard: [], tableId: 't', parentTableId: null, timeLeft: 0, limited: false }
    expect(isBlockingModal(b)).toBe(true)

    const c = base()
    c.viewer = { title: '', cards: [] }
    expect(isBlockingModal(c)).toBe(true)
  })
})
