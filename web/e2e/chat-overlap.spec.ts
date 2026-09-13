import { test, expect } from './fixtures'
import { withFakeServer } from './support/fake-backend'
import { proxyPort } from './dual'
import { decksGalleryScenario } from '../fixtures/scenarios/decksGallery'
import { dismissSetupWizard } from './support/start-game'

test.describe('FloatingChat overlap', () => {
  test('open chat does not cover gallery footer buttons @decks', async ({ page }) => {
    await withFakeServer(decksGalleryScenario, async () => {
      await page.goto(`/?proxyPort=${proxyPort()}`)
      await dismissSetupWizard(page)
      const username = `chatov_${Date.now()}`
      await page.getByPlaceholder(/Usuario|Username/i).fill(username)
      await page.getByPlaceholder(/Contraseña|Password/i).fill('pass')
      await page.getByRole('button', { name: /Conectar/i }).click()
      await expect(page.getByRole('button', { name: /Mesas/ })).toBeVisible({ timeout: 15000 })
      await page.getByRole('button', { name: /Mis Mazos|Mazos/i }).click()
      await expect(page.locator('.decks-gallery')).toBeVisible({ timeout: 8000 })
      await expect(page.locator('.decks-edit-btn')).toBeVisible()

      // abrir el chat flotante (cerrado por defecto)
      await page.locator('.floating-chat-fab').click()
      await expect(page.locator('aside.floating-chat')).toBeVisible({ timeout: 5000 })

      // el main reserva el hueco del panel en pantallas anchas
      const margin = await page.evaluate(
        () => getComputedStyle(document.querySelector('.lobby-main')!).marginRight,
      )
      expect(margin).toBe('380px')

      // el botón Editar del pie recibe el clic (antes lo interceptaba el panel)
      const hit = await page.evaluate(() => {
        const btn = document.querySelector('.decks-edit-btn')!
        const r = btn.getBoundingClientRect()
        const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
        if (!el) return 'none'
        if ((el as Element).closest?.('aside.floating-chat')) return 'floating-chat'
        return btn.contains(el) ? 'edit-btn' : (el as Element).tagName
      })
      expect(hit).toBe('edit-btn')
    })
  })
})
