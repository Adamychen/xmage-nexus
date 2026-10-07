import { describe, expect, it } from 'vitest'
import recorded from '../../fixtures/recorded/commander-4.json'
import { commanderCastCount, commanderTax, commandersOf } from './commanders'
import type { PlayerView } from '../net/types'

describe('commanderCastCount', () => {
  it('reads the CommanderInfoWatcher line the real server writes into rules', () => {
    expect(commanderCastCount({ rules: ['<b>Commander</b> 1 time played from the command zone.'] })).toBe(1)
    expect(commanderCastCount({ rules: ['Flying', '<b>Commander</b> 3 times played from the command zone.'] })).toBe(3)
  })

  it('is zero for a commander never cast', () => {
    expect(commanderCastCount({ rules: ['<b>Commander</b>'] })).toBe(0)
    expect(commanderCastCount({})).toBe(0)
    expect(commanderCastCount(null)).toBe(0)
  })

  it('prefers an explicit numeric castCount', () => {
    expect(commanderCastCount({ castCount: 2, rules: ['<b>Commander</b> 5 times played from the command zone.'] })).toBe(2)
  })

  it('derives the tax from a recorded real frame', () => {
    const players = (recorded as unknown as { gameView: { players: PlayerView[] } }).gameView.players
    const counts = players.flatMap((p) => commandersOf(p).map((c) => c.castCount))
    expect(counts).toContain(1)
    expect(commanderTax(Math.max(...counts))).toBe(2)
  })
})
