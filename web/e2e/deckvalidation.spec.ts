import { expect } from './fixtures'
import { test } from './fixtures'
import { withFakeServer } from './support/fake-backend'
import { getFakePort } from './support/fake-port'
import { FAKE_MODE, BACKEND_PORT } from './dual'
import { deckIssuesScenario } from '../fixtures/scenarios/deckIssues'
import { TABLE } from '../fixtures/table-names'
import { installCapture, type CaptureBuffers } from './support/start-game'

/**
 * @deckvalidation — Pre-validación de mazos contra la BD de cartas del proxy.
 * En fake el FixtureServer responde a `validateDeck` con un informe
 * declarativo; el flujo (diálogo → reparar/quitar → joinTable con el mazo
 * corregido) es idéntico al real.
 */

async function openJoinDialogWithBadDeck(page: import('@playwright/test').Page): Promise<CaptureBuffers> {
  const buffers: CaptureBuffers = { frames: [], sent: [], pageErrors: [] }
  installCapture(page, buffers)
  await page.goto(`/?proxyPort=${FAKE_MODE ? getFakePort() : BACKEND_PORT}`)
  const username = `dv_${Date.now()}`.slice(0, 13)
  await page.getByPlaceholder(/Usuario|Username/i).fill(username)
  await page.getByPlaceholder(/Contraseña|Password/i).fill('pass')
  await page.getByRole('button', { name: /Conectar/i }).click()
  await expect(page.getByRole('button', { name: /Mesas/ })).toBeVisible({ timeout: 15000 })

  const row = page.locator('.table-row', { hasText: TABLE.deckIssues }).first()
  await expect(row).toBeVisible({ timeout: 10_000 })
  await row.getByRole('button', { name: /Unirse \(Humano\)|Join \(Human\)/i }).click()
  await expect(page.getByTestId('join-table-dialog')).toBeVisible()

  // importar un mazo con la carta problemática (set "CY" inexistente en XMage)
  await page.locator('.join-import-toggle-btn').click()
  await page.locator('.import-textarea').fill(`1 [CY:77] Rhystic Tutor\n20 [LEA:288] Island`)
  await page.locator('.import-submit-btn').click()
  await expect(page.locator('.join-deck-card.selected', { hasText: /Rhystic Tutor/i })).toBeVisible()
  await page.locator('.join-submit-btn').click()
  return buffers
}

async function waitJoinSent(buffers: CaptureBuffers): Promise<Record<string, unknown>> {
  let joinSent: Record<string, unknown> | null | undefined
  await expect(async () => {
    joinSent = buffers.sent.find((f) => f?.action === 'joinTable')
    expect(joinSent, 'joinTable should be sent after the dialog resolves').toBeTruthy()
  }).toPass({ timeout: 15_000 })
  return joinSent as unknown as Record<string, unknown>
}

test.describe('Deck validation pre-join @deckvalidation', () => {
  test('shows missing cards dialog and repairs via suggestion', async ({ page }) => {
    await withFakeServer(deckIssuesScenario, async () => {
      const buffers = await openJoinDialogWithBadDeck(page)

      // el diálogo de problemas aparece con la carta y el motivo
      const dialog = page.getByTestId('deck-issues-dialog')
      await expect(dialog).toBeVisible({ timeout: 10_000 })
      const missingRow = page.getByTestId('deck-issue-row').first()
      await expect(missingRow).toContainText('Rhystic Tutor')
      await expect(missingRow).toContainText('CY #77')

      // reparar con la sugerencia implementada (PCY #77) → re-valida limpio y une
      await page.getByTestId('deck-issue-suggestion').first().click()
      await expect(page.getByTestId('deck-issues-dialog')).toBeHidden({ timeout: 10_000 })

      const joinSent = await waitJoinSent(buffers)
      const deck = (joinSent.args as { deck?: { cards: Array<{ cardName: string; setCode: string }> } }).deck!
      expect(deck.cards.some((c) => c.setCode === 'CY')).toBe(false)
      expect(deck.cards.some((c) => c.setCode === 'PCY' && c.cardName === 'Rhystic Tutor')).toBe(true)
    })
  })

  test('remove-and-play joins with the fixed deck', async ({ page }) => {
    await withFakeServer(deckIssuesScenario, async () => {
      const buffers = await openJoinDialogWithBadDeck(page)

      await expect(page.getByTestId('deck-issues-dialog')).toBeVisible({ timeout: 10_000 })
      await page.getByTestId('deck-issues-remove-and-play').click()
      await expect(page.getByTestId('deck-issues-dialog')).toBeHidden({ timeout: 10_000 })

      const joinSent = await waitJoinSent(buffers)
      const deck = (joinSent.args as { deck?: { cards: Array<{ cardName: string; setCode: string; amount: number }> } }).deck!
      expect(deck.cards.some((c) => c.cardName === 'Rhystic Tutor')).toBe(false)
      const island = deck.cards.find((c) => c.cardName === 'Island')
      expect(island?.amount).toBe(20)
    })
  })

  test('deck builder re-validates live: badge appears on edit and clears when fixed', async ({ page }) => {
    await withFakeServer(deckIssuesScenario, async () => {
      await page.goto(`/?proxyPort=${FAKE_MODE ? getFakePort() : BACKEND_PORT}`)
      await page.getByPlaceholder(/Usuario|Username/i).fill(`dv_${Date.now()}`.slice(0, 13))
      await page.getByPlaceholder(/Contraseña|Password/i).fill('pass')
      await page.getByRole('button', { name: /Conectar/i }).click()
      await expect(page.getByRole('button', { name: /Mesas/ })).toBeVisible({ timeout: 15000 })

      await page.getByRole('button', { name: /Mis Mazos|Mazos/i }).click()
      await page.locator('.deck-box-create').click()
      await expect(page.locator('.deck-builder')).toBeVisible({ timeout: 8000 })

      // importar una carta problemática (set "CY" inexistente en XMage)
      await page.getByRole('button', { name: /Importar Mazo/i }).click()
      await page.locator('.deck-import-textarea').fill(`1 [CY:77] Rhystic Tutor\n20 [LEA:288] Island`)
      await page.locator('.import-submit-btn').click()
      // ojo: el strip muestra el nombre LOCALIZADO ("Tutor Rístico"); el nombre
      // original va en el atributo title
      await expect(page.locator('.arena-card-strip[title*="Rhystic Tutor"]')).toBeVisible({ timeout: 5000 })

      // re-validación en vivo (debounce 1.2s tras la edición): badge ⚠️ en la carta
      const badStrip = page.locator('.arena-card-strip.has-issue[title*="Rhystic Tutor"]')
      await expect(badStrip).toBeVisible({ timeout: 8000 })

      // banner de nivel mazo con el detalle (visible sin mirar la carta)
      const banner = page.getByTestId('builder-server-issues')
      await expect(banner).toBeVisible()
      await expect(banner).toContainText(/Rhystic Tutor/)
      await expect(banner).toContainText(/PCY/)

      // drag-reparación: soltar sobre el panel la misma carta con impresión
      // válida (PCY, la que ofrece la colección) CONVIERTE la ficha marcada
      // en vez de duplicarla
      await page.evaluate(() => {
        const dt = new DataTransfer()
        dt.setData('application/json', JSON.stringify({ cardName: 'Rhystic Tutor', setCode: 'PCY', cardNumber: '77', amount: 1, source: 'search' }))
        document.querySelector('.deck-list-panel')!.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }))
      })
      await expect(banner).not.toBeVisible({ timeout: 8000 })
      await expect(page.locator('.arena-card-strip.has-issue')).toHaveCount(0)
      await expect(page.locator('.arena-card-strip[title*="Rhystic Tutor"]')).toHaveCount(1)

      // banner con botón Reparar: re-importamos la carta rota y aplicamos la
      // sugerencia con un clic
      await page.getByRole('button', { name: /Importar Mazo/i }).click()
      await page.locator('.deck-import-textarea').fill(`1 [CY:77] Rhystic Tutor`)
      await page.locator('.import-submit-btn').click()
      await expect(banner).toBeVisible({ timeout: 8000 })
      await banner.getByTestId('builder-issue-repair').click()
      await expect(banner).not.toBeVisible({ timeout: 8000 })
      await expect(page.locator('.arena-card-strip.has-issue')).toHaveCount(0)

      // el mazo reparado no conserva ninguna entrada CY (el fake solo limpia
      // el informe cuando la CY ha desaparecido del mazo)
      await expect(banner).not.toBeVisible({ timeout: 8000 })
      await expect(page.locator('.arena-card-strip.has-issue')).toHaveCount(0)
    })
  })
})
