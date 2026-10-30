import { test, expect } from './fixtures'
import { fakeOnly } from './support/fake-mode'
import { dismissSetupWizard } from './support/start-game'
import { richCommanderGame, showGame } from './support/rich-game'

fakeOnly()

type Rec = Record<string, unknown>

const V2_ARENA = { gameUi: 'v2', boardLayout: 'arena', boardLayoutManual: true }

function token(id: string, name: string, types: string[]): Rec {
  return { id, parentId: id, name, displayName: name, cardTypes: types, isToken: true, mageObjectType: 'TOKEN', manaValue: 0, expansionSetCode: '', cardNumber: '0' }
}

function permanent(id: string, name: string, types: string[]): Rec {
  return { id, parentId: id, name, displayName: name, cardTypes: types, manaValue: 3, expansionSetCode: '', cardNumber: '0' }
}

function withKinds(): Rec {
  const game = richCommanderGame() as { players: Rec[] }
  const extras: Record<string, Rec[]> = {
    'p-adam': [token('adam-treasure', 'Treasure', ['ARTIFACT']), permanent('adam-jace', 'Jace, the Mind Sculptor', ['PLANESWALKER']), permanent('adam-liliana', 'Liliana, Dreadhorde General', ['PLANESWALKER'])],
    'p-mira': [token('mira-clue', 'Clue', ['ARTIFACT']), permanent('mira-saga', 'Saga of Ancient Lore', ['ENCHANTMENT', 'SAGA'])],
    'p-tobias': [token('tobias-treasure', 'Treasure', ['ARTIFACT'])],
    'p-ilse': [token('ilse-treasure', 'Treasure', ['ARTIFACT']), permanent('ilse-walker', 'Liliana', ['PLANESWALKER'])],
  }
  return {
    ...game,
    players: game.players.map((p) => {
      const added = extras[String(p.playerId)] ?? []
      const battlefield = { ...(p.battlefield as Record<string, Rec>) }
      for (const card of added) battlefield[String(card.id)] = card
      return { ...p, battlefield }
    }),
  }
}

interface Box {
  left: number
  right: number
  top: number
  bottom: number
}

interface SeatBoxes {
  name: string
  lands: Box | null
  others: Box | null
  landCards: Box[]
  otherCards: Box[]
  creatures: Box | null
  creatureBand: Box | null
  creatureCards: Box[]
  permanents: Box | null
  status: Box | null
  marquee: Box | null
  marqueeCards: Box[]
  marqueeBudget: number
}

function intersects(a: Box, b: Box): boolean {
  return a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1
}

async function seatBoxes(page: import('@playwright/test').Page): Promise<SeatBoxes[]> {
  return page.evaluate(() => {
    const box = (el: Element | null): Box | null => {
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }
    }
    const boxes = (sel: string, scope: Element): Box[] =>
      Array.from(scope.querySelectorAll(sel)).map((el) => box(el)!)
    return Array.from(document.querySelectorAll<HTMLElement>('.arena-board .board-zone')).map((zone) => ({
      name: zone.dataset.playerName ?? '',
      lands: box(zone.querySelector('[data-testid="lands-band"]')),
      others: box(zone.querySelector('[data-testid="others-band"]')),
      landCards: boxes('[data-testid="lands-band"] .card-slot', zone),
      otherCards: boxes('[data-testid="others-band"] .card-slot', zone),
      creatures: box(zone.querySelector('.bz-creatures-row')),
      creatureBand: box(zone.querySelector('.creatures-band')),
      creatureCards: boxes('.creatures-band .card-slot', zone),
      permanents: box(zone.querySelector('.bz-permanents-row')),
      status: box(zone.querySelector('.bz-status-row')),
      marquee: box(zone.querySelector('[data-testid="marquee-band"]')),
      marqueeCards: boxes('[data-testid="marquee-band"] .card-slot', zone),
      marqueeBudget: (() => {
        const band = zone.querySelector<HTMLElement>('[data-testid="marquee-band"]')
        if (!band) return 0
        const slots = parseFloat(band.style.getPropertyValue('--marquee-slots'))
        const zoneW = parseFloat(getComputedStyle(zone).getPropertyValue('--zone-card-w'))
        const cs = getComputedStyle(band)
        const chrome = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) + parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth)
        return slots * zoneW + (slots - 1) * parseFloat(cs.columnGap) + chrome
      })(),
    }))
  })
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await dismissSetupWizard(page)
  await expect(page.locator('body')).toBeVisible({ timeout: 10_000 })
  await page.waitForTimeout(300)
})

test('BRD-1: on every seat the lands band sits left of the others band and no card crosses', async ({ page }) => {
  await showGame(page, withKinds(), V2_ARENA)
  await expect(page.getByTestId('arena-board')).toBeVisible({ timeout: 10_000 })
  await expect(page.locator('.arena-board [data-testid="lands-band"]').first()).toBeVisible({ timeout: 10_000 })
  const seats = await seatBoxes(page)
  expect(seats.length, 'one board per seat').toBe(4)
  for (const seat of seats) {
    expect(seat.lands, `${seat.name}: lands band`).not.toBeNull()
    expect(seat.others, `${seat.name}: others band`).not.toBeNull()
    const lands = seat.lands!
    const others = seat.others!
    expect(lands.right, `${seat.name}: lands band is left of the others band`).toBeLessThanOrEqual(others.left + 1)
    for (const card of seat.landCards) {
      expect(card.right, `${seat.name}: a land overlaps the others band`).toBeLessThanOrEqual(others.left + 1)
    }
    for (const card of seat.otherCards) {
      expect(card.left, `${seat.name}: a permanent overlaps the lands band`).toBeGreaterThanOrEqual(lands.right - 1)
    }
  }
})

test('BRD-2: the marquee band sits at the right end of the creatures row on every seat with a planeswalker or saga', async ({ page }) => {
  await showGame(page, withKinds(), V2_ARENA)
  await expect(page.getByTestId('arena-board')).toBeVisible({ timeout: 10_000 })
  await expect(page.locator('.arena-board [data-testid="marquee-band"]').first()).toBeVisible({ timeout: 10_000 })
  const seats = await seatBoxes(page)
  const withBand = seats.filter((seat) => seat.marquee)
  expect(withBand.length, 'seats with a planeswalker or saga').toBe(3)
  expect(withBand.find((seat) => seat.name === 'Adam')?.marqueeCards.length, 'two planeswalkers on Adam').toBe(2)
  for (const seat of seats) {
    if (!seat.marquee) {
      expect(seat.creatures, `${seat.name}: creatures row keeps the full width`).not.toBeNull()
      continue
    }
    const band = seat.marquee
    const row = seat.creatures!
    const creatureBand = seat.creatureBand!
    expect(Math.abs(band.top - row.top), `${seat.name}: band starts at the top of the creatures row`).toBeLessThanOrEqual(1)
    expect(Math.abs(band.bottom - row.bottom), `${seat.name}: band ends at the bottom of the creatures row`).toBeLessThanOrEqual(1)
    expect(band.left, `${seat.name}: band sits right of the creatures band`).toBeGreaterThanOrEqual(creatureBand.right - 1)
    expect(seat.marqueeCards.length, `${seat.name}: band holds its permanents`).toBeGreaterThan(0)
    const cardW = seat.marqueeCards[0].right - seat.marqueeCards[0].left
    expect(band.right - band.left, `${seat.name}: band is at least one card wide`).toBeGreaterThanOrEqual(cardW - 1)
    for (const card of seat.marqueeCards) {
      expect(card.left, `${seat.name}: a marquee card is clipped on the left`).toBeGreaterThanOrEqual(band.left - 1)
      expect(card.right, `${seat.name}: a marquee card is clipped on the right`).toBeLessThanOrEqual(band.right + 1)
      for (const creature of seat.creatureCards) {
        expect(intersects(card, creature), `${seat.name}: a marquee card overlaps a creature`).toBe(false)
      }
    }
    expect(band.right - band.left, `${seat.name}: band is no wider than its cards need`).toBeLessThanOrEqual(seat.marqueeBudget + 2)
    if (seat.creatureCards.length === 2 && seat.marqueeCards.length === 2) {
      expect(creatureBand.right - creatureBand.left, `${seat.name}: creatures keep the rest of the row`).toBeGreaterThan(band.right - band.left)
    }
    seat.marqueeCards.forEach((card, i) => {
      seat.marqueeCards.slice(i + 1).forEach((other) => {
        expect(intersects(card, other), `${seat.name}: two marquee cards overlap`).toBe(false)
      })
    })
  }
})
