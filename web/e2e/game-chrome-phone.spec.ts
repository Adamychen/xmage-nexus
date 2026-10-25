import { fakeOnly } from './support/fake-mode'
import { test, expect } from './fixtures'
import { quickStartGame } from './support/start-game'
import { withFakeServer } from './support/fake-backend'
import { spellsScenario } from '../fixtures/scenarios/spells'
import type { Page } from '@playwright/test'

fakeOnly()

test.use({ viewport: { width: 390, height: 844 } })

async function useV2(page: Page) {
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem('mage-web-appearance', JSON.stringify({ gameUi: 'v2', boardLayout: 'arena', boardLayoutManual: true }))
    } catch {
      // storage unavailable: the app default applies
    }
  })
}

interface Box { left: number; right: number; top: number; bottom: number }

function intersects(a: Box, b: Box): boolean {
  return a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5
}

async function boxesOf(page: Page, selector: string): Promise<Box[]> {
  return page.locator(selector).evaluateAll((els) =>
    els
      .map((el) => el.getBoundingClientRect())
      .filter((r) => r.width > 0 && r.height > 0)
      .map((r) => ({ left: r.left, right: r.right, top: r.top, bottom: r.bottom })),
  )
}

async function bootPhoneGame(page: Page, prefix: string) {
  await useV2(page)
  return withFakeServer(() => spellsScenario('blaze'), async () => {
    const { pageErrors } = await quickStartGame(page, { prefix, skipAsks: true })
    await expect(page.getByTestId('phase-dial')).toBeVisible({ timeout: 30_000 })
    await expect(page.locator('[data-testid="hand-bar"] .hand-card').first()).toBeVisible({ timeout: 30_000 })
    await page.waitForTimeout(400)
    return pageErrors
  })
}

test('ACC-5: the phase pips, the split toggle are at least 28 px and the dock is not zoomed on a phone', async ({ page }) => {
  await useV2(page)
  await withFakeServer(() => spellsScenario('blaze'), async () => {
    const { pageErrors } = await quickStartGame(page, { prefix: 'cpt', skipAsks: true })
    await expect(page.getByTestId('phase-dial')).toBeVisible({ timeout: 30_000 })
    await page.waitForTimeout(400)
    const pips = await boxesOf(page, '.phase-dial-pip')
    expect(pips.length).toBe(6)
    for (const pip of pips) {
      expect(pip.right - pip.left).toBeGreaterThanOrEqual(28)
      expect(pip.bottom - pip.top).toBeGreaterThanOrEqual(28)
    }
    const toggle = await boxesOf(page, '[data-testid="pass-split-toggle"]')
    expect(toggle.length).toBe(1)
    expect(toggle[0].right - toggle[0].left).toBeGreaterThanOrEqual(28)
    expect(toggle[0].bottom - toggle[0].top).toBeGreaterThanOrEqual(28)
    const zoom = await page.locator('.game-dock').evaluate((el) => getComputedStyle(el).zoom)
    expect(Number(zoom) || 1).toBe(1)
    expect(pageErrors).toEqual([])
  })
})

test('ACC-3: the phase labels are at least 11 px and the current phase name is shown beside the dial', async ({ page }) => {
  const pageErrors = await bootPhoneGame(page, 'cpl')
  const sizes = await page.locator('.phase-dial-pip').evaluateAll((els) => els.map((el) => parseFloat(getComputedStyle(el).fontSize)))
  expect(sizes.length).toBe(6)
  for (const size of sizes) expect(size).toBeGreaterThanOrEqual(11)
  const name = page.getByTestId('phase-dial-name')
  await expect(name).toBeVisible()
  await expect(name).not.toHaveText('')
  expect(pageErrors).toEqual([])
})

test("ACC-5: the hand and the player's own bar do not overlap on a phone", async ({ page }) => {
  const pageErrors = await bootPhoneGame(page, 'cph')
  const cards = await boxesOf(page, '[data-testid="hand-bar"] .hand-card')
  const bar = await boxesOf(page, '.pz-bottom-row .player-info-bar')
  expect(cards.length).toBeGreaterThan(0)
  expect(bar.length).toBeGreaterThan(0)
  for (const card of cards) {
    for (const b of bar) expect(intersects(card, b)).toBe(false)
  }
  expect(pageErrors).toEqual([])
})
