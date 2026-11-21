import { describe, expect, it } from 'vitest'
import {
  CASCADE_CARD_MAX,
  CASCADE_CARD_MIN,
  CASCADE_MAX_SHOWN,
  CASCADE_PEEK_X,
  CASCADE_PEEK_Y,
  CASCADE_RATIO,
  stackCascadeFit,
} from './stackCascadeFit'

/** The width and height the cascade asks for with this answer, which must fit the room it was given. */
function claimed(fit: ReturnType<typeof stackCascadeFit>) {
  return {
    width: fit.cardW + fit.stepX * (fit.shown - 1),
    height: fit.cardW * CASCADE_RATIO + fit.stepY * (fit.shown - 1),
  }
}

describe('stackCascadeFit', () => {
  it('STK-1: the cascade fits the room it is given, on both sides', () => {
    for (const [w, h, n] of [[420, 620, 1], [420, 620, 4], [300, 300, 6], [200, 900, 3], [900, 240, 5]] as const) {
      const fit = stackCascadeFit(w, h, n)
      const box = claimed(fit)
      // A card clamped at its smallest can overflow a room nothing would fit in; everything above
      // that floor has to stay inside.
      if (fit.cardW > CASCADE_CARD_MIN) {
        expect(box.width, `width for ${w}x${h} n=${n}`).toBeLessThanOrEqual(w + 1)
        expect(box.height, `height for ${w}x${h} n=${n}`).toBeLessThanOrEqual(h + 1)
      }
    }
  })

  it('STK-1: the card is as large as both sides allow, never larger', () => {
    const wide = stackCascadeFit(900, 300, 3)
    const tall = stackCascadeFit(900, 900, 3)
    expect(wide.cardW).toBeLessThan(tall.cardW)
    expect(tall.cardW).toBe(CASCADE_CARD_MAX)
  })

  it('STK-1: a deeper stack gives each card less room, because the slivers are drawn too', () => {
    // A room small enough that the answer is the room, not the ceiling on a card.
    const shallow = stackCascadeFit(200, 280, 1)
    const deep = stackCascadeFit(200, 280, 6)
    expect(deep.cardW).toBeLessThan(shallow.cardW)
  })

  it('STK-1: the offsets are a share of the card, so the shape holds at any size', () => {
    const fit = stackCascadeFit(420, 620, 4)
    expect(fit.stepX).toBe(Math.round(fit.cardW * CASCADE_PEEK_X))
    expect(fit.stepY).toBe(Math.round(fit.cardW * CASCADE_RATIO * CASCADE_PEEK_Y))
  })

  it('STK-1: past six objects the tail is folded away rather than drawn as thinner slivers', () => {
    expect(stackCascadeFit(420, 620, 6).shown).toBe(CASCADE_MAX_SHOWN)
    expect(stackCascadeFit(420, 620, 12).shown).toBe(CASCADE_MAX_SHOWN)
    expect(stackCascadeFit(420, 620, 12).cardW).toBe(stackCascadeFit(420, 620, 6).cardW)
  })

  it('STK-1: a room of nothing still answers with a card that can be drawn', () => {
    const fit = stackCascadeFit(0, 0, 3)
    expect(fit.cardW).toBe(CASCADE_CARD_MIN)
    expect(fit.shown).toBe(3)
    expect(stackCascadeFit(420, 620, 0).shown).toBe(1)
  })
})
