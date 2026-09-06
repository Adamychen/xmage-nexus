import { test, expect } from '@playwright/test'
import { fakeOnly } from './support/fake-mode'
import { withFakeServer } from './support/fake-backend'
import { login } from './support/start-game'
import { makeBaseScenario } from '../fixtures/fake'
import { playerGameView } from '../src/__fixtures__/gameViews'

fakeOnly()

function lobbyScenario() {
  return makeBaseScenario({
    tableId: 'table-cjk-1',
    tableName: 'cjk-e2e',
    gameId: 'game-cjk-1',
    gameView: playerGameView,
  })
}

async function headingFontPx(page: import('@playwright/test').Page): Promise<number> {
  const raw = await page.evaluate(
    () => getComputedStyle(document.querySelector('.lobby-main-heading') as HTMLElement).fontSize,
  )
  return parseFloat(raw)
}

async function setCjkBoost(page: import('@playwright/test').Page, v: boolean): Promise<void> {
  await page.evaluate((boost) => {
    const store = (globalThis as unknown as { __mageStore?: { setSetting?: (k: string, val: unknown) => void } }).__mageStore
    store?.setSetting?.('cjkBoost', boost)
  }, v)
}

test.describe('CJK boost', () => {
  test('aumenta la tipografía rem en japonés y vuelve a base al apagarlo', async ({ page }) => {
    await withFakeServer(lobbyScenario, async () => {
      await page.addInitScript(() => {
        localStorage.setItem(
          'mage-web-appearance',
          JSON.stringify({ sleeveId: 'classic', boardLayout: 'standard', uiScale: 1, cjkBoost: true }),
        )
      })
      await login(page, 'cjk')
      const base = await headingFontPx(page)
      expect(base).toBeGreaterThan(0)

      await page.locator('.language-selector-btn').click()
      await page.locator('.dropdown-option-item', { hasText: '日本語' }).click()
      await expect(async () => {
        expect(await headingFontPx(page)).toBeCloseTo(base * 1.15, 0)
      }).toPass({ timeout: 5_000 })

      await setCjkBoost(page, false)
      await expect(async () => {
        expect(await headingFontPx(page)).toBeCloseTo(base, 0)
      }).toPass({ timeout: 5_000 })
    })
  })
})
