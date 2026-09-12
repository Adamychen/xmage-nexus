import { describe, expect, it } from 'vitest'
import { isGameChatEntry } from './GameChat'

describe('isGameChatEntry (AUDIT)', () => {
  it('filtra por canal cuando existe', () => {
    expect(isGameChatEntry({ channel: 'chat', from: 'Bob' })).toBe(true)
    expect(isGameChatEntry({ channel: 'game', from: 'Bob' })).toBe(false)
    expect(isGameChatEntry({ channel: 'system', from: 'Bob' })).toBe(false)
  })

  it('excluye remitentes de sistema legacy sin canal, sin importar mayúsculas', () => {
    for (const from of ['partida', 'servidor', 'error', 'mesa', 'tú', 'torneo', 'replay', 'Torneo', 'SERVIDOR']) {
      expect(isGameChatEntry({ from })).toBe(false)
    }
  })

  it('conserva mensajes de jugadores legacy sin canal', () => {
    expect(isGameChatEntry({ from: 'Bob' })).toBe(true)
    expect(isGameChatEntry({ from: 'qa-ui-1345' })).toBe(true)
  })

  it('descarta entradas vacías', () => {
    expect(isGameChatEntry({})).toBe(false)
    expect(isGameChatEntry({ from: '' })).toBe(false)
  })
})
