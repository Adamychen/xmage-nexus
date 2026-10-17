import { describe, expect, it } from 'vitest'
import { DECK_CARD_MAX, DECK_CARD_MIN, stackDeckFit } from './stackDeckFit'

describe('stackDeckFit', () => {
  it('keeps the full card and every tab when the board is tall', () => {
    const fit = stackDeckFit(1000, 120, 8, 7)
    expect(fit.cardW).toBe(DECK_CARD_MAX)
    expect(fit.maxTabs).toBe(7)
  })

  it('drops tabs before it shrinks the card', () => {
    const tall = stackDeckFit(900, 110, 7, 7)
    const short = stackDeckFit(780, 110, 7, 7)
    expect(short.maxTabs).toBeLessThan(tall.maxTabs)
    expect(short.cardW).toBeGreaterThanOrEqual(170)
  })

  it('shrinks the card when even two tabs do not fit, never below the minimum', () => {
    const fit = stackDeckFit(720, 100, 7, 7)
    expect(fit.maxTabs).toBe(2)
    expect(fit.cardW).toBeLessThan(DECK_CARD_MAX)
    expect(stackDeckFit(300, 100, 7, 7).cardW).toBe(DECK_CARD_MIN)
  })

  it('never asks for more tabs than there are', () => {
    expect(stackDeckFit(1000, 120, 1, 7).maxTabs).toBe(1)
    expect(stackDeckFit(1000, 120, 0, 7).maxTabs).toBe(0)
  })

  it('leaves room for the dial: the deck never reaches below the dial top', () => {
    const wrap = 720
    const dock = 100
    const fit = stackDeckFit(wrap, dock, 4, 7)
    const used = 16 + 36 + 26 + Math.ceil(fit.cardW * 1.4) + 34 + fit.maxTabs * 30
    expect(used).toBeLessThanOrEqual(wrap - dock - 188)
  })
})
