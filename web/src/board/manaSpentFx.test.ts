import { describe, expect, it } from 'vitest'
import { manaSpends } from './manaSpentFx'
import { makeGameView, makePlayer } from '../__fixtures__/gameViews'
import type { GameView, ManaPoolView } from '../net/types'

const pool = (p: Partial<ManaPoolView>): ManaPoolView => ({ red: 0, green: 0, blue: 0, white: 0, black: 0, colorless: 0, ...p })
const bolt = { id: 'spell-1', name: 'Lightning Bolt', controllerId: 'me' }

function game(manaPool: ManaPoolView, stack: Record<string, unknown> = {}): GameView {
  return makeGameView({ players: [makePlayer({ playerId: 'me', name: 'A', controlled: true, manaPool }), makePlayer({ playerId: 'opp', name: 'B' })], stack: stack as GameView['stack'] })
}

describe('manaSpends', () => {
  it('reports one orb per mana that left the pool when a spell joined the stack', () => {
    const prev = game(pool({ red: 2, colorless: 1 }))
    const next = game(pool({ red: 1 }), { 'spell-1': bolt })
    expect(manaSpends(prev, next)).toEqual([{ playerId: 'me', colors: ['R', 'C'], spellId: 'spell-1' }])
  })

  it('ignores a pool that empties with nothing new on the stack', () => {
    expect(manaSpends(game(pool({ red: 2 })), game(pool({})))).toEqual([])
    expect(manaSpends(game(pool({ red: 2 }), { 'spell-1': bolt }), game(pool({}), { 'spell-1': bolt }))).toEqual([])
  })

  it('ignores mana that was added', () => {
    expect(manaSpends(game(pool({})), game(pool({ red: 1 }), { 'spell-1': bolt }))).toEqual([])
  })

  it('links the orbs to the new object the player controls', () => {
    const prev = game(pool({ blue: 2 }), { old: { id: 'old', name: 'Counterspell', controllerId: 'opp' } })
    const next = game(pool({}), { old: { id: 'old', name: 'Counterspell', controllerId: 'opp' }, 'spell-2': { id: 'spell-2', name: 'Opt', controllerId: 'me' } })
    expect(manaSpends(prev, next)[0]).toEqual({ playerId: 'me', colors: ['U', 'U'], spellId: 'spell-2' })
  })
})
