import { describe, expect, it } from 'vitest'
import { musicIntensity } from './musicIntensity'
import { barSeconds, progressionFor } from './musicEngine'
import { makeCard, makeGameView, makePlayer } from '../__fixtures__/gameViews'

const players = (a: number, b: number) => [
  makePlayer({ playerId: 'me', name: 'Me', controlled: true, life: a }),
  makePlayer({ playerId: 'op', name: 'Op', life: b }),
]

describe('musicIntensity', () => {
  it('is calm with healthy life totals', () => {
    expect(musicIntensity(makeGameView({ players: players(20, 18) }))).toBe(0)
    expect(musicIntensity(null)).toBe(0)
  })

  it('gets tense at ten life and critical at five for any player', () => {
    expect(musicIntensity(makeGameView({ players: players(20, 10) }))).toBe(1)
    expect(musicIntensity(makeGameView({ players: players(4, 20) }))).toBe(2)
  })

  it('ignores players that left', () => {
    const ps = players(20, 20)
    ps.push(makePlayer({ playerId: 'gone', name: 'Gone', life: 1, hasLeft: true }))
    expect(musicIntensity(makeGameView({ players: ps }))).toBe(0)
  })

  it('rises during combat and on deep stacks', () => {
    expect(musicIntensity(makeGameView({ players: players(20, 20), combat: [{ attackers: ['a'], blockers: [], defenders: ['op'] }] as never }))).toBe(1)
    const stack = Object.fromEntries(['s1', 's2', 's3'].map((id) => [id, makeCard({ id, name: id })]))
    expect(musicIntensity(makeGameView({ players: players(9, 20), stack }))).toBe(2)
  })
})

describe('music engine timing', () => {
  it('speeds up bars with intensity and switches to the dire progression', () => {
    expect(barSeconds(2)).toBeLessThan(barSeconds(1))
    expect(barSeconds(1)).toBeLessThan(barSeconds(0))
    expect(progressionFor(2)).not.toEqual(progressionFor(0))
  })
})
