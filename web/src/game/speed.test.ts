import { describe, expect, it } from 'vitest'

import { parseSpeedLevel, speedLevelKey } from './speed'

describe('parseSpeedLevel', () => {
  it('parses the initial speed broadcast', () => {
    expect(parseSpeedLevel("Bob's speed is now 1.")).toEqual({ player: 'Bob', level: 1 })
  })

  it('parses increases and decreases', () => {
    expect(parseSpeedLevel("Bob's speed has increased to 3")).toEqual({ player: 'Bob', level: 3 })
    expect(parseSpeedLevel("Bob's speed has decreased to 2.")).toEqual({ player: 'Bob', level: 2 })
  })

  it('strips the wire font tags and id suffixes before matching', () => {
    expect(parseSpeedLevel("<font color='#FF0000'>Bob [a1]</font>'s speed has increased to 4.")).toEqual({
      player: 'Bob',
      level: 4,
    })
  })

  it('handles player names containing an apostrophe', () => {
    expect(parseSpeedLevel("O'Brien's speed is now 1.")).toEqual({ player: "O'Brien", level: 1 })
  })

  it('rejects unrelated broadcasts', () => {
    expect(parseSpeedLevel('Bob has entered Oubliette (dungeon: Tomb of Annihilation)')).toBeNull()
    expect(parseSpeedLevel('Bob draws a card.')).toBeNull()
    expect(parseSpeedLevel("Bob's speed has increased to 5.")).toBeNull()
    expect(parseSpeedLevel('Speed')).toBeNull()
  })

  it('keys levels per game and normalized player name', () => {
    expect(speedLevelKey('g1', '  BoB ')).toBe('g1‖bob')
    expect(speedLevelKey('g1', 'Bob')).not.toBe(speedLevelKey('g2', 'Bob'))
  })
})
