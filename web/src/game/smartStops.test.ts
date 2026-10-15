import { describe, expect, it } from 'vitest'
import { meaningfulPlayables } from './smartStops'
import { makeGameView } from '../__fixtures__/gameViews'
import dayNightFrame from '../../fixtures/recorded/day-night.json'
import alwaysAttackFrame from '../../fixtures/recorded/always-attack.json'
import manaRocksFrame from '../../fixtures/recorded/mana-rocks.json'
import landDropFrame from '../../fixtures/recorded/land-drop.json'
import type { GameView } from '../net/types'

const mana = { basicManaAbilities: [{ id: 'm', value: '{T}: Add {R}.' }], basicPlayAbilities: [], basicCastAbilities: [], other: [] }
const cast = { basicManaAbilities: [], basicPlayAbilities: [], basicCastAbilities: [{ id: 'c', value: 'Cast Shock' }], other: [] }
const land = { basicManaAbilities: [], basicPlayAbilities: [{ id: 'p', value: 'Play Forest' }], basicCastAbilities: [], other: [] }
const ability = { basicManaAbilities: [], basicPlayAbilities: [], basicCastAbilities: [], other: [{ id: 'o', value: '{2}: Draw a card' }] }

const viewOf = (frame: unknown) => (frame as { gameView: GameView }).gameView

describe('smartStops', () => {
  it('ignores sources that only produce mana', () => {
    const game = makeGameView({ canPlayObjects: { objects: { mountain: mana, elves: mana } } })
    expect(meaningfulPlayables(game)).toEqual([])
  })

  it('counts spells, land drops and non-mana abilities', () => {
    const game = makeGameView({ canPlayObjects: { objects: { shock: cast, forest: land, relic: ability, mountain: mana } } })
    expect(meaningfulPlayables(game).sort()).toEqual(['forest', 'relic', 'shock'])
  })

  it('trusts the engine: a land in hand the engine does not list is not a window', () => {
    const game = makeGameView({ canPlayObjects: { objects: { bf: mana } } })
    expect(meaningfulPlayables(game)).toEqual([])
  })

  it('real server frames: an opponent-turn window with only untapped lands is not worth a stop', () => {
    for (const frame of [dayNightFrame, alwaysAttackFrame]) {
      const game = viewOf(frame)
      expect(Object.keys(game.canPlayObjects?.objects ?? {}).length).toBeGreaterThan(0)
      expect(meaningfulPlayables(game)).toEqual([])
    }
  })

  it('non-basic mana abilities filed under `other` do not count as a window', () => {
    const rock = { basicManaAbilities: [], basicPlayAbilities: [], basicCastAbilities: [], other: [{ id: 'r', value: '{T}: Add {C}{C}.' }] }
    const filter = { basicManaAbilities: [], basicPlayAbilities: [], basicCastAbilities: [], other: [{ id: 'f', value: '{U/R}, {T}: Add {U}{U}.' }] }
    const treasure = { basicManaAbilities: [], basicPlayAbilities: [], basicCastAbilities: [], other: [{ id: 't', value: '{T}, Sacrifice this artifact: Add one mana of any color.' }] }
    expect(meaningfulPlayables(makeGameView({ canPlayObjects: { objects: { rock, filter, treasure } } }))).toEqual([])
  })

  it('a real ability next to a mana ability still counts', () => {
    const both = { basicManaAbilities: [], basicPlayAbilities: [], basicCastAbilities: [], other: [{ id: 'r', value: '{T}: Add {C}{C}.' }, { id: 'd', value: '{2}: Draw a card' }] }
    expect(meaningfulPlayables(makeGameView({ canPlayObjects: { objects: { both } } }))).toEqual(['both'])
  })

  it('real server frame: Sol Ring and a filter land are not a window', () => {
    expect(meaningfulPlayables(viewOf(manaRocksFrame))).toEqual([])
  })

  it('real server frame: the first main phase with lands in hand is worth a stop', () => {
    const game = viewOf(landDropFrame)
    expect(meaningfulPlayables(game).sort()).toEqual(Object.keys(game.myHand ?? {}).sort())
  })
})
