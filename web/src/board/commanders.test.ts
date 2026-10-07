import { describe, expect, it } from 'vitest'
import { commanderPlaysCount, commanderTax, commandersOf } from './commanders'
import { commanderInfoRule } from '../__fixtures__/gameViews'
import type { GameView } from '../net/types'
import commanderZoneFrame from '../../fixtures/recorded/commander-zone.json'
import commanderPodFrame from '../../fixtures/recorded/commander-4.json'

function playsPerPlayer(frame: unknown): number[] {
  const gv = (frame as { gameView: GameView }).gameView
  return (gv.players ?? []).map((p) => commandersOf(p)[0]?.castCount ?? -1)
}

describe('commanderPlaysCount', () => {
  it('reads the count the server writes into the commander rules', () => {
    expect(playsPerPlayer(commanderZoneFrame)).toEqual([0, 2])
    expect(playsPerPlayer(commanderPodFrame)).toEqual([0, 0, 0, 1])
  })

  it('turns the recorded counts into the commander tax', () => {
    const gv = (commanderZoneFrame as unknown as { gameView: GameView }).gameView
    expect(commanderTax(commandersOf(gv.players?.[1])[0].castCount)).toBe(4)
  })

  it('ignores the commander damage lines that share the same prefix', () => {
    const rules = ["<b>Commander</b> did 3 combat damage to player <font color='#20B2AA'>sim</font>."]
    expect(commanderPlaysCount({ rules })).toBe(0)
  })

  it('matches the singular and plural sentences of the engine', () => {
    expect(commanderPlaysCount({ rules: [commanderInfoRule(1)] })).toBe(1)
    expect(commanderPlaysCount({ rules: [commanderInfoRule(5)] })).toBe(5)
    expect(commanderPlaysCount({ rules: [commanderInfoRule(0)] })).toBe(0)
    expect(commanderPlaysCount({})).toBe(0)
  })
})
