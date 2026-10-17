import { test, expect, type Page } from '@playwright/test'

interface Rect {
  left: number
  right: number
  top: number
  bottom: number
}

interface HandMetrics {
  bar: Rect
  cards: Rect
  cardW: number
  lastRight: number
  pool: Rect | null
  dock: Rect | null
}

async function openHand(page: Page, entry: string): Promise<HandMetrics> {
  await page.goto('/#/gallery')
  await expect(page.locator('[data-gallery]')).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  await page.locator(`[data-gallery-entry="${entry}"]`).click()
  const bar = page.locator('[data-testid="hand-bar"]')
  await expect(bar).toBeVisible()
  await expect(bar.locator('.hand-card-slot').first()).toBeVisible()
  await page.mouse.move(0, 0)
  await page.waitForTimeout(400)
  return page.evaluate((entry) => {
    const rect = (el: Element | null): Rect | null => {
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }
    }
    const bar = document.querySelector<HTMLElement>('[data-testid="hand-bar"]')
    if (!bar) throw new Error(`no hand bar for ${entry}`)
    const slots = Array.from(bar.querySelectorAll<HTMLElement>('.hand-card-slot'))
    const cards = Array.from(bar.querySelectorAll<HTMLElement>('.hand-card'))
    const union = (rects: Rect[]): Rect => ({
      left: Math.min(...rects.map((r) => r.left)),
      right: Math.max(...rects.map((r) => r.right)),
      top: Math.min(...rects.map((r) => r.top)),
      bottom: Math.max(...rects.map((r) => r.bottom)),
    })
    return {
      bar: rect(bar)!,
      cards: union(cards.map((c) => rect(c)!)),
      cardW: cards[0]?.offsetWidth ?? 0,
      lastRight: rect(cards[cards.length - 1] ?? slots[slots.length - 1])!.right,
      pool: rect(document.querySelector('.pp-pool')),
      dock: rect(document.querySelector('[data-testid="game-dock"]')),
    }
  }, entry)
}

test.describe('the hand spreads across the width as cards are added @hand-bar', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('12 and 15 cards reach the container edge and keep the card size of a short hand', async ({ page }) => {
    const three = await openHand(page, 'game:hand-3')
    const twelve = await openHand(page, 'game:hand-12')
    const fifteen = await openHand(page, 'game:hand-15')

    for (const [label, hand] of [
      ['12 cards', twelve],
      ['15 cards', fifteen],
    ] as const) {
      const containerRight = hand.bar.right
      expect(
        containerRight - hand.lastRight,
        `${label}: the last card ends near the right edge of the hand container`,
      ).toBeLessThanOrEqual((hand.bar.right - hand.bar.left) * 0.03)
    }

    expect(fifteen.cardW, '15 cards are not larger than 3 cards').toBeLessThanOrEqual(three.cardW)
    expect(twelve.cardW, '12 cards are not smaller than the minimum card').toBeGreaterThanOrEqual(64)
    expect(fifteen.cardW, '15 cards are not smaller than the minimum card').toBeGreaterThanOrEqual(64)
  })

  for (const entry of ['game:hand-8', 'game:hand-15']) {
    test(`${entry} stays in the centre band between the side panels`, async ({ page }) => {
    const hand = await openHand(page, entry)
    expect(hand.pool, 'the bottom-left pool row is on screen').not.toBeNull()
    expect(hand.dock, 'the command wheel dock is on screen').not.toBeNull()
    const pool = hand.pool!
    const dock = hand.dock!

    const overlaps = (a: Rect, b: Rect) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
    expect(overlaps(hand.cards, pool), 'the hand does not cover the pool row').toBe(false)
    expect(overlaps(hand.cards, dock), 'the hand does not cover the command wheel').toBe(false)
    expect(hand.bar.left, 'the centre band starts after the pool row').toBeGreaterThanOrEqual(pool.right)
    expect(hand.bar.right, 'the centre band ends before the command wheel').toBeLessThanOrEqual(dock.left)
    expect(hand.bar.right - hand.lastRight, 'the last card reaches the centre band edge').toBeLessThanOrEqual((hand.bar.right - hand.bar.left) * 0.03)
    })
  }
})
