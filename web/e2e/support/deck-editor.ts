/**
 * Helpers for the deck editor (`.deck-builder`). Its Piles view is the default; the strip
 * list of `DeckListPanel` is the List view, which specs about strips switch to first.
 */

import { expect, type Page } from '@playwright/test'

export async function showDeckListView(page: Page) {
  const list = page.locator('.deck-editor-toolbar [data-control="view"] [data-value="list"]')
  await list.click()
  await expect(list).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.deck-editor-list')).toBeVisible()
}

export async function waitForStacksSettled(page: Page) {
  const piles = page.locator('[data-testid="deck-editor-piles"]')
  await expect(piles.locator('.arena-stack-card.is-loading')).toHaveCount(0, { timeout: 8000 })
  await expect.poll(() => piles.evaluate(async (el) => {
    const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    const layout = () => JSON.stringify(Array.from(el.querySelectorAll('.arena-stack-card')).map((card) => {
      const r = card.getBoundingClientRect()
      return [card.getAttribute('data-card-key'), card.getAttribute('data-front'), r.x, r.y, r.width, r.height]
    }))
    const before = layout()
    await frame()
    await frame()
    return before === layout()
  }), { timeout: 8000 }).toBe(true)
}
