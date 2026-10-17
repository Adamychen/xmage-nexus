import { test, expect, type Page } from '@playwright/test'

interface HandMetrics {
  barX: number
  barW: number
  cardW: number
  lastRight: number
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
  return bar.evaluate((el) => {
    const slots = Array.from(el.querySelectorAll<HTMLElement>('.hand-card-slot'))
    const last = slots[slots.length - 1]
    const card = last.querySelector<HTMLElement>('.hand-card')
    const r = el.getBoundingClientRect()
    const lastRect = last.getBoundingClientRect()
    return {
      barX: r.x,
      barW: r.width,
      cardW: el.querySelector<HTMLElement>('.hand-card')?.offsetWidth ?? 0,
      lastRight: lastRect.x + (card?.offsetWidth ?? 0),
    }
  })
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
      const containerRight = hand.barX + hand.barW
      expect(
        containerRight - hand.lastRight,
        `${label}: the last card ends near the right edge of the hand container`,
      ).toBeLessThanOrEqual(hand.barW * 0.03)
    }

    expect(twelve.cardW, '12 cards are not smaller than 3 cards').toBeGreaterThanOrEqual(three.cardW - 0.5)
    expect(fifteen.cardW, '15 cards are not smaller than 3 cards').toBeGreaterThanOrEqual(three.cardW - 0.5)
  })
})
