import { describe, expect, it } from 'vitest'
import { gainedIconKeys, iconKey, isGoadIcon } from './cardIconFx'
import goadFrame from '../../fixtures/recorded/goad.json'
import type { GameView } from '../net/types'

const goaded = Object.values((goadFrame as unknown as { gameView: GameView }).gameView.players ?? [])
  .flatMap((p) => Object.values(p.battlefield ?? {}))
  .find((c) => (c.cardIcons ?? []).length > 0)!

describe('cardIconFx', () => {
  it('recognises the goad restriction icon the server sends', () => {
    const icon = goaded.cardIcons![0]
    expect(isGoadIcon(icon)).toBe(true)
    expect(isGoadIcon({ cardIconType: 'OTHER_HAS_RESTRICTIONS', hint: 'Must block' })).toBe(false)
    expect(isGoadIcon({ cardIconType: 'ABILITY_FLYING', hint: 'Goad' })).toBe(false)
  })

  it('reports only the icons that were not there before', () => {
    const goad = goaded.cardIcons![0]
    const flying = { cardIconType: 'ABILITY_FLYING', hint: 'Flying' }
    expect(gainedIconKeys([], [goad])).toEqual([iconKey(goad)])
    expect(gainedIconKeys(undefined, [flying])).toEqual([iconKey(flying)])
    expect(gainedIconKeys([flying], [flying, goad])).toEqual([iconKey(goad)])
    expect(gainedIconKeys([goad], [goad])).toEqual([])
    expect(gainedIconKeys([goad], [])).toEqual([])
  })
})
