import { describe, expect, it } from 'vitest'
import { itemModel, type ItemKind, type ItemOpts } from './itemModel'

const CLASSIC: ItemOpts = { compact: false, tilted: false }
const CLASSIC_TILTED: ItemOpts = { compact: false, tilted: true }
const COMPACT: ItemOpts = { compact: true, tilted: false }
const COMPACT_TILTED: ItemOpts = { compact: true, tilted: true }

const card = (over: Partial<Extract<ItemKind, { kind: 'card' }>> = {}): ItemKind => ({
  kind: 'card',
  tapped: false,
  attachments: 0,
  ...over,
})

function expectLinear(item: ItemKind, opts: ItemOpts, a: number, b: number): void {
  const model = itemModel(item, opts)
  expect(model.a).toBeCloseTo(a, 9)
  expect(model.b).toBeCloseTo(b, 9)
  for (const c of [44, 100, 160]) {
    expect(model.a * c + model.b).toBeCloseTo(a * c + b, 6)
  }
}

describe('itemModel: single cards (CardSlot.css)', () => {
  it('BRD-28: a classic untapped card is c wide (width: var(--card-w))', () => {
    expectLinear(card(), CLASSIC, 1, 0)
  })

  it('BRD-28: a classic tapped card is c + 0.4c wide (margin 0.2c each side, .card-slot.tapped)', () => {
    expectLinear(card({ tapped: true }), CLASSIC, 1.4, 0)
  })

  it('BRD-28: a classic tapped card tilted 45deg keeps the 90deg footprint, c + 0.4c (transform does not change layout)', () => {
    expectLinear(card({ tapped: true }), CLASSIC_TILTED, 1.4, 0)
  })

  it('BRD-28: a compact untapped tile is c wide (--card-h-ratio only changes its height)', () => {
    expectLinear(card(), COMPACT, 1, 0)
  })

  it('BRD-28: a compact tapped tile is 0.5625c wide (margin -0.21875c each side, .card-slot.is-compact.tapped)', () => {
    expectLinear(card({ tapped: true }), COMPACT, 0.5625, 0)
  })

  it('BRD-28: a compact tapped tile tilted is 0.75c wide (margin -0.125c each side under .tap-tilted)', () => {
    expectLinear(card({ tapped: true }), COMPACT_TILTED, 0.75, 0)
  })

  it('BRD-28: a card with one attachment is c + 24px wide (.card-attachment-group, --attach-step), tapped or not', () => {
    expectLinear(card({ attachments: 1 }), CLASSIC, 1, 24)
    expectLinear(card({ attachments: 1, tapped: true }), CLASSIC, 1, 24)
    expectLinear(card({ attachments: 1 }), COMPACT_TILTED, 1, 24)
  })

  it('BRD-28: a card with two attachments is c + 48px wide', () => {
    expectLinear(card({ attachments: 2 }), CLASSIC, 1, 48)
  })

  it('BRD-28: a mutated card with two parts and one attachment is c + 2 x 14px + 24px wide (.card-mutate-pile)', () => {
    expectLinear(card({ mutateParts: 2, attachments: 1 }), CLASSIC, 1, 52)
  })
})

describe('itemModel: land piles (.land-group, overlap .stack-group .card-slot + .card-slot)', () => {
  const land = (count: number, tapped = 0) => ({ kind: 'pile' as const, pile: 'land' as const, count, tapped })

  it('BRD-28: a classic land pile of 3 untapped is c + 2 x 0.28c (overlap -0.72c)', () => {
    expectLinear(land(3), CLASSIC, 1 + 2 * 0.28, 0)
  })

  it('BRD-28: a classic land pile of 3 tapped is 1.4c + 2 x 0.48c (tapped margins 0.2c on the right)', () => {
    expectLinear(land(3, 3), CLASSIC, 1.4 + 2 * 0.48, 0)
  })

  it('BRD-28: a compact land pile of 3 untapped is c + 2 x 0.14c (overlap -0.86c)', () => {
    expectLinear(land(3), COMPACT, 1 + 2 * 0.14, 0)
  })

  it('BRD-28: a compact land pile of 3 tapped is 0.5625c + 2 x 0.12125c (overlap -0.66c, margin -0.21875c)', () => {
    expectLinear(land(3, 3), COMPACT, 0.5625 + 2 * 0.12125, 0)
  })

  it('BRD-28: a compact tilted land pile of 3 tapped is 0.75c + 2 x 0.15c (overlap -0.725c, margin -0.125c)', () => {
    expectLinear(land(3, 3), COMPACT_TILTED, 0.75 + 2 * 0.15, 0)
  })
})

describe('itemModel: token and creature-token piles (.token-pile, --pile-edge = --sp-1h = 6px)', () => {
  const tokens = (count: number, tapped = 0) => ({ kind: 'pile' as const, pile: 'token' as const, count, tapped })

  it('BRD-28: a classic token pile of 5 untapped is c + 4 x 6px (overlap -c + 6px)', () => {
    expectLinear(tokens(5), CLASSIC, 1, 4 * 6)
  })

  it('BRD-28: a classic token pile of 3 tapped is 1.4c + 2 x 6px (tapped overlap -1.2c + 6px)', () => {
    expectLinear(tokens(3, 3), CLASSIC, 1.4, 2 * 6)
  })

  it('BRD-28: a compact token pile of 5 untapped is c + 4 x 6px', () => {
    expectLinear(tokens(5), COMPACT, 1, 4 * 6)
  })

  it('BRD-28: a compact token pile of 3 tapped is 0.5625c + 2 x 6px (tapped overlap -0.78125c, margin -0.21875c)', () => {
    expectLinear(tokens(3, 3), COMPACT, 0.5625, 2 * 6)
  })

  it('BRD-28: a compact tilted token pile of 4 tapped is 0.75c + 3 x 6px (tapped overlap -0.875c, margin -0.125c)', () => {
    expectLinear(tokens(4, 4), COMPACT_TILTED, 0.75, 3 * 6)
  })
})

describe('itemModel: command zone (.command-zone, CommandZone.css)', () => {
  const zone = (commanders: number, compactPod = false, planes = 0, emblems = 0): ItemKind => ({
    kind: 'commander',
    commanders,
    compactPod,
    planes,
    emblems,
  })

  it('BRD-28: one commander is c + 14px (padding 6px, 1px border each side)', () => {
    expectLinear(zone(1), CLASSIC, 1, 14)
  })

  it('BRD-28: two commanders outside a compact pod are 2c + 14px (padding 4px, gap 4px)', () => {
    expectLinear(zone(2), CLASSIC, 2, 4 * 2 + 2 + 4)
  })

  it('BRD-28: two commanders in a compact pod are 2 x 0.88c + 14px (.commander-slot --card-w = 0.88 of --cz-card-w, CommandZone.css:28-29)', () => {
    expectLinear(zone(2, true), COMPACT, 2 * 0.88, 14)
  })

  it('BRD-28: a plane beside one commander is 2c + 20px (the plane is a full card, one 6px gap)', () => {
    expectLinear(zone(1, false, 1), CLASSIC, 2, 14 + 6)
  })

  it('BRD-28: an emblem stack beside one commander is 2c + 20px (the whole emblem stack is one card-wide wrapper, plate CommandZone.css:108)', () => {
    expectLinear(zone(1, false, 0, 3), CLASSIC, 2, 14 + 6)
  })

  it('BRD-28: a commander, a plane and two emblems are 3c + 26px (the emblem stack counts once, two 6px gaps after the commander)', () => {
    expectLinear(zone(1, false, 1, 2), CLASSIC, 3, 14 + 2 * 6)
  })

  it('BRD-28: two commanders and an emblem in a compact pod are 2 x 0.88c + c + 18px (two 4px gaps, the emblem wrapper unscaled)', () => {
    expectLinear(zone(2, true, 0, 1), COMPACT, 2 * 0.88 + 1, 2 * (4 + 1) + 2 * 4)
  })

  it('BRD-28: a plane without a commander is c + 14px (the zone is only the plane)', () => {
    expectLinear(zone(0, false, 1), CLASSIC, 1, 14)
  })

  it('BRD-28: an emblem without a commander is c + 14px', () => {
    expectLinear(zone(0, false, 0, 1), CLASSIC, 1, 14)
  })
})
