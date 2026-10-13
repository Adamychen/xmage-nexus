import { describe, expect, it } from 'vitest'
import { chooseLaneFit } from './laneFit'

/**
 * Measured in Chromium against the real walkway (two 14-char names, which is
 * the server's `maxUserNameLength` cap), read out of the hidden rulers by
 * `turn-lane.spec.ts`. Under the font this machine resolves the row is 300px
 * wide; under a wider fallback face the same markup measures 294px — the pair
 * is the point, not either number. `--font-ui` resolves to a different face on
 * every platform, so the walkway decides by measuring, never by budget.
 */
const ROW = { narrow: 300, wide: 294 } // every seat + the arrows between them
const SOLO = { narrow: 189, wide: 190 } // active seat alone, name unwrapped
const DOTS = { narrow: 88, wide: 84 } // active seat with the name dropped

const PAD = 14 // the walkway's own horizontal padding, added by useLaneFit

const input = (avail: number, key: 'narrow' | 'wide') => ({
  needAll: ROW[key] + PAD,
  needActive: SOLO[key] + PAD,
  needActiveDots: DOTS[key] + PAD,
  avail,
})

describe('chooseLaneFit', () => {
  it('keeps the whole row when it fits, under either font', () => {
    // The band hands the walkway 838px at a 1600px window, 518px at 1280px.
    for (const avail of [838, 518]) {
      for (const key of ['narrow', 'wide'] as const) {
        expect(chooseLaneFit(input(avail, key))).toBe('full')
      }
    }
  })

  it('drops to the active seat alone when the row does not fit', () => {
    // 244px at a 900px window, 240px with the band starved, 229px under the
    // wide font: too narrow for the row under any face, enough for one seat.
    for (const avail of [244, 240, 229]) {
      for (const key of ['narrow', 'wide'] as const) {
        expect(chooseLaneFit(input(avail, key))).toBe('solo')
      }
    }
  })

  it('drops the names before it clips one', () => {
    for (const key of ['narrow', 'wide'] as const) {
      expect(chooseLaneFit(input(120, key))).toBe('dots')
    }
  })

  it('shows everything when nothing was measured (jsdom, first paint)', () => {
    expect(chooseLaneFit({ needAll: 0, needActive: 0, needActiveDots: 0, avail: 0 })).toBe('full')
    expect(chooseLaneFit({ needAll: ROW.wide, needActive: 0, needActiveDots: 0, avail: 0 })).toBe('full')
    // a room of nothing is not a room: never degrade because of a bad measure
    expect(chooseLaneFit({ needAll: ROW.wide, needActive: SOLO.wide, needActiveDots: DOTS.wide, avail: -1 })).toBe('full')
  })

  it('never picks a layout that still overflows, for any room', () => {
    // The contract the e2e asserts: whatever it chooses has to fit, or there is
    // nothing left to give up.
    const needs = [
      [ROW.wide, SOLO.wide, DOTS.wide],
      [ROW.narrow, SOLO.narrow, DOTS.narrow],
      [320, 170, 60],
      [180, 170, 60],
      [180, 175, 60],
    ]
    for (const [needAll, needActive, needActiveDots] of needs) {
      for (let avail = 40; avail <= 900; avail += 5) {
        const fit = chooseLaneFit({ needAll, needActive, needActiveDots, avail })
        const used = fit === 'full' ? needAll : fit === 'solo' ? needActive : needActiveDots
        if (used > avail) {
          // only allowed when even the dots do not fit: there is no layout left
          expect(needActiveDots).toBeGreaterThan(avail)
        } else {
          expect(used).toBeLessThanOrEqual(avail)
        }
      }
    }
  })

  it('is driven by the content, not by a hard-coded budget', () => {
    // The bug this replaces: seat names carried `max-width: 96px`, which fitted
    // this machine's font by 1.1px and truncated Linux's. At the same room, a
    // shorter pair of names keeps the row and a long pair degrades it — a fixed
    // budget cannot tell those apart, the measurement can.
    const shortNames = ROW.narrow - 2 * (94.9 - 40)
    expect(chooseLaneFit({ needAll: shortNames, needActive: SOLO.narrow, needActiveDots: DOTS.narrow, avail: 244 })).toBe('full')
    expect(chooseLaneFit({ needAll: ROW.narrow, needActive: SOLO.narrow, needActiveDots: DOTS.narrow, avail: 244 })).toBe('solo')
  })
})
