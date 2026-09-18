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

  test('narrow viewport: dragged chat panel stays under gallery footer buttons @decks', async ({ page }) => {
    await page.setViewportSize({ width: 1000, height: 800 })
    await withFakeServer(decksGalleryScenario, async () => {
      // Panel arrastrado justo encima del pie: sin el fix (chat z-60) lo tapaba.
      await page.addInitScript(() => {
        try { localStorage.setItem('floating_chat_pos', JSON.stringify({ left: 600, top: 672 })) } catch {}
      })
      await page.goto(`/?proxyPort=${proxyPort()}`)
      await dismissSetupWizard(page)
      const username = `chatov_narrow_${Date.now()}`
      await page.getByPlaceholder(/Usuario|Username/i).fill(username)
      await page.getByPlaceholder(/Contraseña|Password/i).fill('pass')
      await page.getByRole('button', { name: /Conectar/i }).click()
      await expect(page.getByRole('button', { name: /Mesas/ })).toBeVisible({ timeout: 15000 })
      await page.getByRole('button', { name: /Mis Mazos|Mazos/i }).click()
      await expect(page.locator('.decks-gallery')).toBeVisible({ timeout: 8000 })
      await expect(page.locator('.decks-footer')).toBeVisible()

      await page.locator('.floating-chat-fab').click()
      const chat = page.locator('aside.floating-chat')
      await expect(chat).toBeVisible({ timeout: 5000 })
      await expect(chat).toHaveCSS('left', '600px')

      const overlap = await page.evaluate(() => {
        const panel = document.querySelector('aside.floating-chat')!.getBoundingClientRect()
        const btn = document.querySelector('.decks-edit-btn')!.getBoundingClientRect()
        return panel.left < btn.right && panel.right > btn.left && panel.top < btn.bottom && panel.bottom > btn.top
      })
      expect(overlap).toBe(true)

      const hits = await page.evaluate(() => {
        const panel = document.querySelector('aside.floating-chat')!.getBoundingClientRect()
        const out: Array<{ cls: string; hit: string }> = []
        document.querySelectorAll<HTMLElement>('.decks-footer-btn, .decks-edit-btn').forEach((btn) => {
          const r = btn.getBoundingClientRect()
          const cx = r.left + r.width / 2
          const cy = r.top + r.height / 2
          if (cx < panel.left || cx > panel.right || cy < panel.top || cy > panel.bottom) return
          const el = document.elementFromPoint(cx, cy)
          const hit = !el ? 'none' : el.closest('aside.floating-chat') ? 'floating-chat' : btn.contains(el) ? 'self' : el.tagName
          out.push({ cls: btn.className, hit })
        })
        return out
      })
      expect(hits.length, 'el panel debe solapar algún botón del pie').toBeGreaterThan(0)
      expect(hits.filter((h) => h.hit !== 'self')).toEqual([])
    })
  })
})
