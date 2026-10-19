import { test, expect, type Page } from '@playwright/test'
import { fakeOnly } from './support/fake-mode'
import { withFakeServer } from './support/fake-backend'
import { login } from './support/start-game'
import { makeBaseScenario } from '../fixtures/fake'
import { playerGameView } from '../src/__fixtures__/gameViews'

fakeOnly()

const scenario = () => makeBaseScenario({
  tableId: 'table-tabind-1',
  tableName: 'tab-indicator-e2e-room',
  gameId: 'game-tabind-1',
  gameView: playerGameView,
})

/** Box of the sliding pill and of the active tab button, in viewport pixels. */
function boxes(page: Page) {
  return page.evaluate(() => {
    const box = (el: Element | null) => {
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { x: r.x, y: r.y, w: r.width, h: r.height }
    }
    return {
      indicator: box(document.querySelector('[data-testid="top-nav-indicator"]')),
      active: box(document.querySelector('.lobby-top-nav .top-nav-btn.active')),
    }
  })
}

async function expectIndicatorOnActiveTab(page: Page) {
  // The pill transitions over ~0.3 s, so poll until it settles on the button.
  await expect(async () => {
    const { indicator, active } = await boxes(page)
    expect(indicator, 'indicator rendered').not.toBeNull()
    expect(active, 'active tab rendered').not.toBeNull()
    for (const key of ['x', 'y', 'w', 'h'] as const) {
      expect(Math.abs(indicator![key] - active![key]), `indicator ${key}`).toBeLessThanOrEqual(1)
    }
  }).toPass({ timeout: 3_000 })
}

test('the tab indicator stays on the active tab when the window is resized', { tag: '@lobby' }, async ({ page }) => {
  await withFakeServer(scenario, async () => {
    await page.setViewportSize({ width: 1400, height: 900 })
    await login(page, 'tabind-user')
    await expectIndicatorOnActiveTab(page)

    // Desktop grid: the nav is centred and moves when the window changes width
    // while its own size stays the same, so the pill must follow it.
    for (const width of [1100, 820, 600, 1400]) {
      await page.setViewportSize({ width, height: 900 })
      await expectIndicatorOnActiveTab(page)
    }
  })
})

test('the tab indicator follows the selected tab after a resize', { tag: '@lobby' }, async ({ page }) => {
  await withFakeServer(scenario, async () => {
    await page.setViewportSize({ width: 1100, height: 900 })
    await login(page, 'tabind-switch')
    await page.setViewportSize({ width: 760, height: 900 })
    // Labels follow the UI language (Mazos / Decks), so match either.
    await page.locator('.lobby-top-nav .top-nav-btn', { hasText: /Mazos|Decks/ }).click()
    await expect(page.locator('.lobby-top-nav .top-nav-btn.active')).toHaveText(/Mazos|Decks/)
    await expectIndicatorOnActiveTab(page)
  })
})
