import type { Page } from '@playwright/test'
import { test, expect } from './fixtures'

const HIDE_DEV_SIDEBAR = '.gallery-sidebar{display:none!important}.gallery{grid-template-columns:1fr!important}'

async function openLobbyGallery(page: Page) {
  await page.goto('/#/gallery')
  await expect(page.locator('[data-gallery]')).toBeVisible({ timeout: 30_000 })
  await page.locator('[data-gallery-entry="screen:lobby-overflow"]').click()
  await expect(page.locator('[data-gallery-stage="screen:lobby-overflow"]')).toBeAttached({ timeout: 10_000 })
  await page.addStyleTag({ content: HIDE_DEV_SIDEBAR })
  await expect(page.locator('.table-card').first()).toBeVisible({ timeout: 10_000 })
}

test.describe('LBY-18: table cards at phone width', () => {
  test.use({ viewport: { width: 390, height: 844 }, locale: 'en-US' })

  test('LBY-18: every table card stays inside the list at 390 px', async ({ page }) => {
    await openLobbyGallery(page)
    const overflowing = await page.locator('.tables-list .table-card').evaluateAll((cards) =>
      cards.filter((card) => {
        const list = card.parentElement?.getBoundingClientRect()
        return !!list && card.getBoundingClientRect().right > list.right + 0.5
      }).length,
    )
    expect(overflowing).toBe(0)
  })
})

test.describe('LBY-19: the lobby header at desktop width', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('LBY-19: the brand, the navigation and the user actions never overlap at 1280 px', async ({ page }) => {
    await openLobbyGallery(page)
    const parts = await page.evaluate(() =>
      ['.lobby-brand-col', '.lobby-top-center', '.lobby-user-actions'].map((sel) => {
        const box = document.querySelector(sel)?.getBoundingClientRect()
        return { sel, left: box?.left ?? 0, right: box?.right ?? 0 }
      }),
    )
    for (let i = 1; i < parts.length; i++) {
      expect(parts[i].left, `${parts[i - 1].sel} overlaps ${parts[i].sel}`).toBeGreaterThanOrEqual(parts[i - 1].right - 0.5)
    }
  })
})

test.describe('LBY-20: the table type badge', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('LBY-20: a tournament table shows the TOURNAMENT badge and a match table shows no type badge', async ({ page }) => {
    await openLobbyGallery(page)
    await expect(page.locator('.table-card', { hasText: 'Mesa de Alice #1' }).locator('.table-type-badge.tourney')).toHaveCount(1)
    await expect(page.locator('.table-card', { hasText: 'Mesa de Bora #2' }).locator('.table-type-badge')).toHaveCount(0)
  })
})

for (const width of [1800, 1440, 390]) {
  test.describe(`LBY-23: seats at ${width} px`, () => {
    test.use({ viewport: { width, height: 900 }, locale: 'en-US' })

    test(`LBY-23: every seated player's name stays readable and the seat's details stay inside it at ${width} px`, async ({ page }) => {
      await openLobbyGallery(page)
      const seats = await page.locator('.tables-list .seat-badge.occupied.interactive').evaluateAll((els) =>
        els.map((seat) => {
          const box = seat.getBoundingClientRect()
          const name = seat.querySelector('.seat-player-name') as HTMLElement
          const parts = Array.from(seat.querySelectorAll('.seat-main > *, .seat-rank')).map((p) => p.getBoundingClientRect())
          return {
            name: name.textContent,
            nameWidth: name.getBoundingClientRect().width,
            nameNeeds: name.scrollWidth,
            outside: parts.some((p) => p.right > box.right + 0.5),
          }
        }),
      )
      expect(seats.length).toBeGreaterThan(0)
      for (const seat of seats) {
        expect(seat.nameWidth, `${seat.name} is squeezed`).toBeGreaterThanOrEqual(Math.min(seat.nameNeeds - 1, 40))
        expect(seat.outside, `${seat.name}'s details leave the seat`).toBe(false)
      }
    })
  })
}
