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
  permanents: Box | null
  status: Box | null
  marquee: Box | null
  marqueeCards: Box[]
  marqueeChrome: number
  bandCardMax: number
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
      permanents: box(zone.querySelector('.bz-permanents-row')),
      status: box(zone.querySelector('.bz-status-row')),
      marquee: box(zone.querySelector('.bz-marquee--column')),
      marqueeCards: boxes('.bz-marquee--column .card-slot', zone),
      marqueeChrome: (() => {
        const column = zone.querySelector<HTMLElement>('.bz-marquee--column')
        if (!column) return 0
        const cs = getComputedStyle(column)
        return parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) + parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth)
      })(),
      bandCardMax: Math.max(0, ...boxes('.bz-band .card-slot', zone).map((b) => b.right - b.left)),
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

test('BRD-2: the marquee column spans the creatures and permanents rows at the right edge of every seat', async ({ page }) => {
  await showGame(page, withKinds(), V2_ARENA)
  await expect(page.getByTestId('arena-board')).toBeVisible({ timeout: 10_000 })
  await expect(page.locator('.arena-board .bz-marquee--column').first()).toBeVisible({ timeout: 10_000 })
  const seats = await seatBoxes(page)
  const withColumn = seats.filter((seat) => seat.marquee)
  expect(withColumn.length, 'seats with a planeswalker or saga').toBe(3)
  expect(withColumn.find((seat) => seat.name === 'Adam')?.marqueeCards.length, 'two planeswalkers stacked on Adam').toBe(2)
  for (const seat of seats) {
    if (!seat.marquee) {
      expect(seat.creatures, `${seat.name}: creatures row keeps the full width`).not.toBeNull()
      continue
    }
    const marquee = seat.marquee
    const cardW = seat.marqueeCards[0].right - seat.marqueeCards[0].left
    expect(marquee.right - marquee.left - cardW, `${seat.name}: column is no wider than one card plus its padding`).toBeLessThanOrEqual(seat.marqueeChrome + cardW * 0.05)
    expect(cardW, `${seat.name}: column cards are no larger than the band cards`).toBeLessThanOrEqual(seat.bandCardMax + 1)
    const creatures = seat.creatures!
    const permanents = seat.permanents!
    const status = seat.status!
    expect(marquee.top, `${seat.name}: column starts at the top of the creatures or permanents row`).toBeLessThanOrEqual(Math.min(creatures.top, permanents.top) + 1)
    expect(marquee.bottom, `${seat.name}: column ends at the bottom of the creatures or permanents row`).toBeGreaterThanOrEqual(Math.max(creatures.bottom, permanents.bottom) - 1)
    expect(marquee.left, `${seat.name}: column sits right of the battlefield rows`).toBeGreaterThanOrEqual(Math.max(creatures.right, permanents.right) - 1)
    if (seat.marqueeCards.length > 1) {
      const [first, second] = seat.marqueeCards
      expect(second.top, `${seat.name}: second marquee permanent sits below the first`).toBeGreaterThanOrEqual(first.bottom - 1)
      expect(Math.abs(second.left - first.left), `${seat.name}: marquee permanents share one column`).toBeLessThanOrEqual(1)
    }
    const overlapX = marquee.left < status.right && marquee.right > status.left
    const overlapY = marquee.top < status.bottom && marquee.bottom > status.top
    expect(overlapX && overlapY, `${seat.name}: column does not sit on the status row`).toBe(false)
  }
})
