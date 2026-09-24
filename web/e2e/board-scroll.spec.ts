import { fakeOnly } from './support/fake-mode'
import { test, expect } from './fixtures'
import { startGame } from './support/start-game'
import { withFakeServer } from './support/fake-backend'
import { spellsScenario } from '../fixtures/scenarios/spells'
import { TABLE } from '../fixtures/table-names'
import type { Page } from '@playwright/test'

fakeOnly()

async function scrolledBoxes(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = []
    if (window.scrollY) out.push(`window ${window.scrollY}`)
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('.game, .game *'))) {
      if (el.scrollTop <= 0) continue
      const ov = getComputedStyle(el).overflowY
      if (ov === 'auto' || ov === 'scroll') continue
      out.push(`${el.className} ${el.scrollTop}`)
    }
    return out
  })
}

test('focusing a hand card that peeks below the edge never scrolls the board @hand-bar', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 880 })
  await withFakeServer(() => spellsScenario('blaze'), async () => {
    const { pageErrors } = await startGame(page, { prefix: 'bsc', tableName: TABLE.spellsBlaze, skipAsks: true })
    const hand = page.locator('[data-testid="hand-bar"] .hand-card-slot')
    await expect(hand.first()).toBeVisible({ timeout: 30_000 })
    await expect(page.locator('.big-action-btn')).toBeEnabled({ timeout: 30_000 })

    await hand.first().click()
    await page.keyboard.press('Space')
    for (let i = 0; i < 20; i++) await page.keyboard.press('Tab')
    expect(await scrolledBoxes(page)).toEqual([])
    expect(pageErrors).toEqual([])
  })
})
