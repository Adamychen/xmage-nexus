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

    const d = base()
    d.rollbackDialogOpen = true
    expect(isBlockingModal(d)).toBe(true)

    const e = base()
    e.draft = {} as never
    expect(isBlockingModal(e)).toBe(true)

    const f = base()
    f.construct = {} as never
    expect(isBlockingModal(f)).toBe(true)
  })

  it('is true for any general modal feedback prompts like ask, mode, color', () => {
    const s1 = base()
    s1.feedback = { method: 'GAME_ASK', title: 'Confirm', message: 'Pay?', min: 0, max: 0, gameId: 'g' } as never
    expect(isBlockingModal(s1)).toBe(true)

    const s2 = base()
    s2.feedback = { method: 'GAME_CHOOSE_MODE', title: 'Mode', message: '', min: 0, max: 0, gameId: 'g' } as never
    expect(isBlockingModal(s2)).toBe(true)

    const s3 = base()
    s3.feedback = { method: 'GAME_CHOOSE_COLOR', title: 'Color', message: '', min: 0, max: 0, gameId: 'g' } as never
    expect(isBlockingModal(s3)).toBe(true)
  })

  it('is false for in-board action bars (mana and combat)', () => {
    const s1 = base()
    s1.feedback = { method: 'GAME_PLAY_MANA', mode: 'mana', title: '', message: '', min: 0, max: 0, gameId: 'g' } as never
    expect(isBlockingModal(s1)).toBe(false)

    const s2 = base()
    s2.feedback = { method: 'GAME_DECLARE_ATTACKERS', mode: 'combat', title: '', message: '', min: 0, max: 0, gameId: 'g' } as never
    expect(isBlockingModal(s2)).toBe(false)
  })
})
