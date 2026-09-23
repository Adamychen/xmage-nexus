import { afterEach, describe, expect, it } from 'vitest'
import { attentionReason, attentionSnapshot, clearAttention, raiseAttention, type AttentionSnapshot } from './attentionAlerts'
import { makeGameView, makePlayer } from '../__fixtures__/gameViews'
import type { FeedbackPrompt } from './feedback'

const snap = (partial: Partial<AttentionSnapshot>): AttentionSnapshot => ({ gameId: 'g', turn: 1, myTurn: false, promptSig: null, ...partial })

describe('attentionAlerts', () => {
  afterEach(() => clearAttention())

  it('flags the start of my turn once', () => {
    expect(attentionReason(snap({ turn: 2 }), snap({ turn: 3, myTurn: true }))).toBe('turn')
    expect(attentionReason(snap({ turn: 3, myTurn: true }), snap({ turn: 3, myTurn: true }))).toBeNull()
    expect(attentionReason(snap({ turn: 3, myTurn: true }), snap({ turn: 4, myTurn: true }))).toBe('turn')
  })

  it('flags a new prompt, even during the opponent turn', () => {
    expect(attentionReason(snap({}), snap({ promptSig: 'a' }))).toBe('response')
    expect(attentionReason(snap({ promptSig: 'a' }), snap({ promptSig: 'a' }))).toBeNull()
    expect(attentionReason(snap({ promptSig: 'a' }), snap({ promptSig: 'b' }))).toBe('response')
    expect(attentionReason(snap({ promptSig: 'a' }), snap({ promptSig: null }))).toBeNull()
  })

  it('builds snapshots from the controlled player only', () => {
    const game = makeGameView({ turn: 4, activePlayerId: 'me', players: [makePlayer({ playerId: 'me', name: 'Me', controlled: true })] })
    const fb = { method: 'GAME_ASK', gameId: 'g', title: '', message: 'Keep?', mode: 'boolean', options: [], min: 0, max: 0 } as FeedbackPrompt
    expect(attentionSnapshot(game, 'g', null, null)).toEqual({ gameId: 'g', turn: 4, myTurn: true, promptSig: null })
    expect(attentionSnapshot(game, 'g', fb, null)?.promptSig).toContain('Keep?')
    expect(attentionSnapshot(game, 'g', null, { mode: 'block', selectable: [], special: false, chosen: [] })?.promptSig).toContain('combat|block')
    const spectator = makeGameView({ players: [makePlayer({ playerId: 'x', name: 'X' })] })
    expect(attentionSnapshot(spectator, 'g', null, null)).toBeNull()
  })

  it('counts pending alerts in the title and restores it', () => {
    document.title = 'XMage Nexus'
    raiseAttention({ label: 'Your turn', title: 'Your turn', body: '', tag: 't', notify: false })
    raiseAttention({ label: 'Response', title: 'Response', body: '', tag: 't', notify: false })
    expect(document.title).toBe('(2) Response · XMage Nexus')
    clearAttention()
    expect(document.title).toBe('XMage Nexus')
  })
})
