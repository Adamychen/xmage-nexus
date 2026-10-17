import { afterEach, describe, expect, it } from 'vitest'
import { buildCombatLedger, ledgerWindowOpen } from './combatLedgerModel'
import { resetCommanderMemory } from '../board/commanders'
import type { ActionFeedItem } from './gameEventParser'
import { commanderInfoRule, makeCard, makeGameView, makePlayer } from '../__fixtures__/gameViews'

function item(partial: Partial<ActionFeedItem> & { type: ActionFeedItem['type'] }, i = 0): ActionFeedItem {
  return { id: `i${i}`, timestamp: i, description: '', rawText: '', ...partial }
}

const game = makeGameView({
  players: [
    makePlayer({ playerId: 'a', name: 'Adam', controlled: true }),
    makePlayer({
      playerId: 't',
      name: 'Tobias',
      commandList: [makeCard({ id: 'ct', name: 'Edgar Markov', mageObjectType: 'COMMANDER', rules: [commanderInfoRule(0)] })],
    }),
  ],
})

describe('buildCombatLedger', () => {
  afterEach(() => resetCommanderMemory())

  it('opens only on the damage and end of combat steps', () => {
    expect(ledgerWindowOpen('COMBAT_DAMAGE')).toBe(true)
    expect(ledgerWindowOpen('FIRST_COMBAT_DAMAGE')).toBe(true)
    expect(ledgerWindowOpen('END_COMBAT')).toBe(true)
    expect(ledgerWindowOpen('DECLARE_BLOCKERS')).toBe(false)
    expect(ledgerWindowOpen(null)).toBe(false)
  })

  it('merges repeated damage, tags commander damage to a player and totals per player', () => {
    const items = [
      item({ type: 'turn' }, 0),
      item({ type: 'attack' }, 1),
      item({ type: 'damage', cardName: 'Edgar Markov', targetName: 'Adam', amount: 4 }, 2),
      item({ type: 'damage', cardName: 'Vampire', targetName: 'Adam', amount: 1 }, 3),
      item({ type: 'damage', cardName: 'Vampire', targetName: 'Adam', amount: 1 }, 4),
      item({ type: 'damage', cardName: 'Korvold', targetName: 'Cathar Commando', amount: 7 }, 5),
    ]
    const ledger = buildCombatLedger(items, game)
    expect(ledger?.rows).toEqual([
      { source: 'Edgar Markov', target: 'Adam', amount: 4, toPlayer: true, commander: true, sourceOwnerId: 't', targetOwnerId: 'a', commanderTotal: null },
      { source: 'Vampire', target: 'Adam', amount: 2, toPlayer: true, commander: false, sourceOwnerId: null, targetOwnerId: 'a', commanderTotal: null },
      { source: 'Korvold', target: 'Cathar Commando', amount: 7, toPlayer: false, commander: false, sourceOwnerId: null, targetOwnerId: null, commanderTotal: null },
    ])
    expect(ledger?.totals).toEqual([{ name: 'Adam', amount: 6, playerId: 'a', lifeAfter: 20 }])
  })

  it('ignores damage from before the last attack', () => {
    const items = [
      item({ type: 'damage', cardName: 'Bolt', targetName: 'Adam', amount: 3 }, 0),
      item({ type: 'attack' }, 1),
      item({ type: 'damage', cardName: 'Edgar Markov', targetName: 'Adam', amount: 4 }, 2),
    ]
    expect(buildCombatLedger(items, game)?.rows.map((r) => r.source)).toEqual(['Edgar Markov'])
  })

  it('shows nothing once a new turn has started', () => {
    const items = [
      item({ type: 'attack' }, 0),
      item({ type: 'damage', cardName: 'Edgar Markov', targetName: 'Adam', amount: 4 }, 1),
      item({ type: 'turn' }, 2),
    ]
    expect(buildCombatLedger(items, game)).toBeNull()
  })

  it('returns null without an attack or without damage', () => {
    expect(buildCombatLedger([item({ type: 'damage', cardName: 'Bolt', targetName: 'Adam', amount: 3 })], game)).toBeNull()
    expect(buildCombatLedger([item({ type: 'attack' })], game)).toBeNull()
    expect(buildCombatLedger([], null)).toBeNull()
  })

  it('names the attacker, colours both sides by seat and reads the commander total off the view', () => {
    const withBoard = makeGameView({
      players: [
        makePlayer({ playerId: 'a', name: 'Adam', controlled: true, life: 33, battlefield: { k: makeCard({ id: 'k', name: 'Korvold' }) } }),
        makePlayer({
          playerId: 't',
          name: 'Tobias',
          battlefield: { c: makeCard({ id: 'c', name: 'Cathar Commando' }) },
          commandList: [makeCard({ id: 'ct', name: 'Edgar Markov', mageObjectType: 'COMMANDER', rules: [commanderInfoRule(0), '<b>Commander</b> did 16 combat damage to player Adam.'] })],
        }),
      ],
    })
    const ledger = buildCombatLedger([
      item({ type: 'attack', playerName: 'Tobias' }, 0),
      item({ type: 'damage', cardName: 'Edgar Markov', targetName: 'Adam', amount: 4 }, 1),
      item({ type: 'damage', cardName: 'Korvold', targetName: 'Cathar Commando', amount: 7 }, 2),
    ], withBoard)
    expect(ledger?.attacker).toBe('Tobias')
    expect(ledger?.rows[0]).toMatchObject({ sourceOwnerId: 't', targetOwnerId: 'a', commanderTotal: 16 })
    expect(ledger?.rows[1]).toMatchObject({ sourceOwnerId: 'a', targetOwnerId: 't', commanderTotal: null })
    expect(ledger?.totals).toEqual([{ name: 'Adam', amount: 4, playerId: 'a', lifeAfter: 33 }])
  })
})
