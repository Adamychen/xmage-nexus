import { describe, expect, it } from 'vitest'
import { meaningfulPlayables } from './smartStops'
import { makeCard, makeGameView } from '../__fixtures__/gameViews'
import dayNightFrame from '../../fixtures/recorded/day-night.json'
import alwaysAttackFrame from '../../fixtures/recorded/always-attack.json'
import type { GameView } from '../net/types'

const mana = { basicManaAbilities: [{ id: 'm', value: '{T}: Add {R}.' }], basicPlayAbilities: [], basicCastAbilities: [], other: [] }
const cast = { basicManaAbilities: [], basicPlayAbilities: [], basicCastAbilities: [{ id: 'c', value: 'Cast Shock' }], other: [] }
const land = { basicManaAbilities: [], basicPlayAbilities: [{ id: 'p', value: 'Play Forest' }], basicCastAbilities: [], other: [] }
const ability = { basicManaAbilities: [], basicPlayAbilities: [], basicCastAbilities: [], other: [{ id: 'o', value: '{2}: Draw a card' }] }

describe('smartStops', () => {
  it('ignores sources that only produce mana', () => {
    const game = makeGameView({ canPlayObjects: { objects: { mountain: mana, elves: mana } } })
    expect(meaningfulPlayables(game, ['mountain', 'elves'])).toEqual([])
  })

  it('counts spells, land drops and non-mana abilities', () => {
    const game = makeGameView({ canPlayObjects: { objects: { shock: cast, forest: land, relic: ability, mountain: mana } } })
    expect(meaningfulPlayables(game, []).sort()).toEqual(['forest', 'relic', 'shock'])
  })

  it('counts hand cards the client marked playable (basic land drop)', () => {
    const game = makeGameView({ myHand: { h1: makeCard({ name: 'Forest', parentId: 'h1' }) } })
    expect(meaningfulPlayables(game, ['h1', 'bf-land'])).toEqual(['h1'])
  })

  it('real server frames: an opponent-turn window with only untapped lands is not worth a stop', () => {
    for (const frame of [dayNightFrame, alwaysAttackFrame]) {
      const game = (frame as unknown as { gameView: GameView }).gameView
      expect(Object.keys(game.canPlayObjects?.objects ?? {}).length).toBeGreaterThan(0)
      expect(meaningfulPlayables(game, [])).toEqual([])
    }
  })
})
