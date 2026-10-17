import { describe, it, expect } from 'vitest'
import { cardDesignations, pairedPartnerName, evidenceCounts, protectorName, classLevelOf } from './designations'
import { commanderPlaysCount, commanderTax } from './commanders'
import { parseSpeedLevel } from '../game/speed'
import { parseRoomDoor } from '../game/rooms'

function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 0x100000000
  }
}

const FRAGMENTS = [
  '<b>Commander</b>', ' 2 times played from the command zone.', ' did 3 combat damage to player ', '<font color=\'#20B2AA\'>', '</font>',
  'Class level: ', 'is harnessed', 'Goaded by ', 'Paired with ', 'Protector: ', 'evidence', "'s speed is now ", ' increased to ', 'decreased to ',
  'unlocked the left door', 'right half', '99999999999999999999', '-1', '0', 'NaN', '\n', '\u0000', '{this}', '<', '>', '&amp;', 'x'.repeat(3000),
  'Krenko, Mob Boss', "O'Brien", '$1', '\\', '(?:', '[', '.*',
]

function noise(r: () => number): string {
  const n = Math.floor(r() * 8)
  let out = ''
  for (let i = 0; i < n; i++) out += FRAGMENTS[Math.floor(r() * FRAGMENTS.length)]
  return out
}

describe('rules-text parsers never throw and keep their contracts on noisy input', () => {
  it('designations, commander tax, speed and room doors', () => {
    const r = rng(14102026)
    const bad: string[] = []
    for (let i = 0; i < 6000; i++) {
      const rules = Array.from({ length: Math.floor(r() * 5) }, () => noise(r))
      const msg = noise(r)
      try {
        for (const d of cardDesignations(rules)) expect(typeof d).toBe('string')
        pairedPartnerName(rules)
        protectorName(rules)
        const ev = evidenceCounts(rules)
        if (ev) expect(Number.isFinite(ev.need) && Number.isFinite(ev.canCollect)).toBe(true)
        const lvl = classLevelOf(rules)
        if (lvl !== null) expect(Number.isFinite(lvl)).toBe(true)
        const plays = commanderPlaysCount({ rules } as never)
        expect(Number.isFinite(plays) && plays >= 0).toBe(true)
        expect(commanderTax(plays)).toBe(plays * 2)
        const sp = parseSpeedLevel(msg)
        if (sp !== null) expect([0, 1, 2, 3, 4]).toContain(sp)
        parseRoomDoor(msg)
      } catch (e) {
        bad.push(`${JSON.stringify(rules).slice(0, 140)} | ${JSON.stringify(msg).slice(0, 100)} -> ${String(e).slice(0, 120)}`)
        if (bad.length > 5) break
      }
    }
    expect(bad).toEqual([])
  })

  it('null and undefined rules are accepted', () => {
    expect(cardDesignations(null)).toEqual([])
    expect(cardDesignations(undefined)).toEqual([])
    expect(commanderPlaysCount({ rules: undefined } as never)).toBe(0)
  })
})
