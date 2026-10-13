import { afterEach, describe, expect, it } from 'vitest'
import { commanderChipTone, commanderDamageChips } from './commanderChips'
import { resetCommanderMemory } from '../board/commanders'
import { commanderDamageRule, commanderInfoRule, makeCard, makeGameView, makePlayer } from '../__fixtures__/gameViews'

function commander(id: string, name: string, damage: Array<[number, string]>) {
  return makeCard({ id, name, mageObjectType: 'COMMANDER', rules: [commanderInfoRule(0), ...damage.map(([n, who]) => commanderDamageRule(n, who))] })
}

function pod() {
  return makeGameView({
    players: [
      makePlayer({ playerId: 'a', name: 'Adam', controlled: true, commandList: [commander('ca', 'Korvold', [[7, 'Tobias']])] }),
      makePlayer({ playerId: 'm', name: 'Mira', commandList: [commander('cm', 'Yuriko', [[9, 'Adam']])] }),
      makePlayer({ playerId: 't', name: 'Tobias', commandList: [commander('ct', 'Edgar Markov', [[16, 'Adam'], [6, 'Mira']])] }),
    ],
  })
}

describe('commanderDamageChips', () => {
  afterEach(() => resetCommanderMemory())

  it('lists the damage a player has taken, biggest first, skipping zero and their own commander', () => {
    const game = pod()
    const adam = game.players![0]
    const chips = commanderDamageChips(game, adam)
    expect(chips.map((c) => [c.commander.name, c.dmg])).toEqual([['Edgar Markov', 16], ['Yuriko', 9]])
    expect(commanderDamageChips(game, game.players![1]).map((c) => [c.commander.name, c.dmg])).toEqual([['Edgar Markov', 6]])
  })

  it('returns nothing without a game or without commander damage', () => {
    expect(commanderDamageChips(null, makePlayer({ playerId: 'x', name: 'X' }))).toEqual([])
    const game = pod()
    expect(commanderDamageChips(game, game.players![2]).map((c) => c.commander.name)).toEqual(['Korvold'])
  })

  it('flags warning from 12 and lethal from 18', () => {
    expect(commanderChipTone(11)).toBe('normal')
    expect(commanderChipTone(12)).toBe('warning')
    expect(commanderChipTone(17)).toBe('warning')
    expect(commanderChipTone(18)).toBe('lethal')
    expect(commanderChipTone(21)).toBe('lethal')
  })

  it('merges partner commanders of one seat into a single chip', () => {
    const game = makeGameView({
      players: [
        makePlayer({ playerId: 'a', name: 'Adam', controlled: true }),
        makePlayer({ playerId: 'k', name: 'Kira', commandList: [commander('k1', 'Thrasios', [[5, 'Adam']]), commander('k2', 'Tymna', [[9, 'Adam']])] }),
      ],
    })
    const chips = commanderDamageChips(game, game.players![0])
    expect(chips).toHaveLength(1)
    expect(chips[0].dmgs).toEqual([5, 9])
    expect(chips[0].dmg).toBe(9)
    expect(chips[0].commander.name).toBe('Tymna')
  })
})
