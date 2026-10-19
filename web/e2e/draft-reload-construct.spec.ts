import { test, expect } from './fixtures'
import { fakeOnly } from './support/fake-mode'
import { login } from './support/start-game'
import { withFakeServer } from './support/fake-backend'
import { makeDraftScenario } from '../fixtures/scenarios/draft'
fakeOnly()

test.describe('Draft reload', { tag: '@draft' }, () => {
  test('recargar en la construcción tras el draft vuelve a la construcción', async ({ page }) => {
    await withFakeServer(() => makeDraftScenario({ totalPicksBeforeOver: 1, nextPickDelayMs: 60 }), async () => {
      await login(page, `draftcn-${String(Date.now()).slice(-6)}`, { landsOn: '.draft-screen' })
      await expect(page.locator('.draft-screen').first()).toBeVisible({ timeout: 10_000 })
      await page.getByTestId('draft-card').first().click()
      await expect(page.locator('.construct-screen').first()).toBeVisible({ timeout: 15_000 })
      await page.reload()
      await expect(page.locator('.construct-screen').first()).toBeVisible({ timeout: 15_000 })
      await expect(page.getByTestId('construct-submit').first()).toBeVisible()
      await expect(page.locator('.construct-screen').first()).toContainText(/\d+:\d+/)
    })
  })

  test('el armado en curso sobrevive a la recarga y el mazo se puede enviar', async ({ page }) => {
    await withFakeServer(() => makeDraftScenario({ totalPicksBeforeOver: 1, nextPickDelayMs: 60 }), async () => {
      await login(page, `draftsv-${String(Date.now()).slice(-6)}`, { landsOn: '.draft-screen' })
      await expect(page.locator('.draft-screen').first()).toBeVisible({ timeout: 10_000 })
      await page.getByTestId('draft-card').first().click()
      await expect(page.locator('.construct-screen').first()).toBeVisible({ timeout: 15_000 })

      const poolStrip = page.locator('[data-fly-target="pool"] .arena-card-strip').first()
      const cardKey = await poolStrip.getAttribute('data-card-key')
      expect(cardKey).toBeTruthy()
      const mainCardSelector = `[data-fly-target="main"] .arena-card-strip[data-card-key="${cardKey}"]`
      await poolStrip.hover()
      await poolStrip.locator('.strip-btn.swap').click()
      await expect(page.locator(mainCardSelector)).toHaveCount(1)

      const plains = page.locator('.basic-land-btn').first()
      for (let i = 0; i < 39; i++) await plains.click()
      const mainCount = page.locator('[data-fly-target="main"] .construct-col-count')
      await expect(mainCount).toHaveText('40')
      await expect(page.getByTestId('construct-submit').first()).toBeEnabled()

      await page.reload()
      await expect(page.locator('.construct-screen').first()).toBeVisible({ timeout: 15_000 })
      await expect(page.locator(mainCardSelector)).toHaveCount(1)
      await expect(page.locator('[data-fly-target="main"] .construct-col-count')).toHaveText('40')
      await expect(page.getByTestId('construct-submit').first()).toBeEnabled()

      await page.getByTestId('construct-submit').first().click()
      await expect.poll(() => page.evaluate(() => localStorage.getItem('mage-web-construct-selection'))).toBeNull()
    })
  })
})
