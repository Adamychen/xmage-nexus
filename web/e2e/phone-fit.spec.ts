import type { Page } from '@playwright/test'
import { test, expect } from './fixtures'

const HIDE_DEV_SIDEBAR = '.gallery-sidebar{display:none!important}.gallery{grid-template-columns:1fr!important}'

async function openGalleryEntry(page: Page, id: string) {
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem('mage-web-appearance', JSON.stringify({ gameUi: 'v2' }))
    } catch {
      return
    }
  })
  await page.goto('/#/gallery')
  await expect(page.locator('[data-gallery]')).toBeVisible({ timeout: 30_000 })
  await page.locator(`[data-gallery-entry="${id}"]`).click()
  await expect(page.locator(`[data-gallery-stage="${id}"]`)).toBeAttached({ timeout: 10_000 })
  await page.addStyleTag({ content: HIDE_DEV_SIDEBAR })
}

test.describe('BRD-19: life totals at phone width', () => {
  test.describe('390 px', () => {
    test.use({ viewport: { width: 390, height: 844 } })

    test('BRD-19: every life total in a four-seat pod sits inside its seat and on the screen', async ({ page }) => {
      await openGalleryEntry(page, 'board:pod-4')
      const seats = page.locator('.player-info-bar.is-portrait')
      await expect(seats).toHaveCount(4)
      const checks = await seats.evaluateAll((cards, width) => cards.map((card) => {
        const life = card.querySelector('.life-value')?.getBoundingClientRect()
        const seat = card.getBoundingClientRect()
        return {
          hasLife: !!life,
          inSeat: !!life && life.left >= seat.left && life.right <= seat.right,
          onScreen: !!life && life.left >= 0 && life.right <= width,
        }
      }), 390)
      expect(checks.filter((c) => !c.hasLife || !c.inSeat || !c.onScreen)).toEqual([])
    })

    test('BRD-19: every piece of text in a seat, the stats row included, ends inside the seat', async ({ page }) => {
      await openGalleryEntry(page, 'board:pod-4')
      const escaping = await page.locator('.player-info-bar.is-portrait').evaluateAll((cards) =>
        cards.flatMap((card) => {
          const seat = card.getBoundingClientRect()
          return [...card.querySelectorAll('*')]
            .filter((el) => el.children.length === 0 && el.textContent?.trim())
            .filter((el) => el.getBoundingClientRect().right > seat.right + 0.5)
            .map((el) => el.textContent?.trim() ?? '')
        }),
      )
      expect(escaping).toEqual([])
    })
  })

  test.describe('1280 px', () => {
    test.use({ viewport: { width: 1280, height: 800 } })

    test('BRD-19: from 601 px up an opponent keeps the full-size life total', async ({ page }) => {
      await openGalleryEntry(page, 'board:pod-4')
      const size = await page.locator('.player-info-bar.is-portrait.opp .pp-life').first().evaluate((el) => getComputedStyle(el).fontSize)
      expect(size).toBe('38px')
    })
  })
})
