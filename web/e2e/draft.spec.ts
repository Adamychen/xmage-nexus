import { test, expect } from './fixtures'
import { fakeOnly } from './support/fake-mode'
import { dismissSetupWizard, login } from './support/start-game'
import { withFakeServer } from './support/fake-backend'
import { makeDraftScenario } from '../fixtures/scenarios/draft'
fakeOnly()

test.describe('Draft', { tag: '@draft' }, () => {
  test('booster se renderiza, timeout y pick', async ({ page }) => {
    await page.goto('/')
    await dismissSetupWizard(page)
    await expect(page.locator('body')).toBeVisible({ timeout: 10_000 })
    await page.waitForTimeout(500)
    await page.evaluate(() => {
      const store = (globalThis as unknown as { __mageStore?: { setState: (s: unknown) => void } }).__mageStore
      store?.setState({
        draft: {
          draftId: 'draft-test-1',
          message: {
            draftView: { setNames: ['Core Set 2021'], setCodes: ['M21'], boosterNum: 1, cardNum: 2, players: ['a','b','c','d','e','f','g','h'] },
            draftPickView: {
              booster: {
                'c-1': { id: 'c-1', expansionSetCode: 'M21', cardNumber: '1', name: 'Lightning Bolt' },
                'c-2': { id: 'c-2', expansionSetCode: 'M21', cardNumber: '2', name: 'Grizzly Bears' },
                'c-3': { id: 'c-3', expansionSetCode: 'M21', cardNumber: '3', name: 'Island' },
              },
              picks: {},
              picking: true,
              timeout: 60,
            },
          },
        },
        phase: 'game',
      })
    })
    const draft = page.locator('.draft-screen').first()
    await expect(draft).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('draft-booster').first()).toBeVisible()
    await expect(page.getByTestId('draft-timeout').first()).toHaveText(/\d+:\d+/)
    const card = page.getByTestId('draft-card').first()
    await expect(card).toBeVisible()
  })

  test('después del draft aparece CONSTRUCT', async ({ page }) => {
    await page.goto('/')
    await dismissSetupWizard(page)
    await expect(page.locator('body')).toBeVisible({ timeout: 10_000 })
    await page.waitForTimeout(500)
    await page.evaluate(() => {
      const store = (globalThis as unknown as { __mageStore?: { setState: (s: unknown) => void } }).__mageStore
      store?.setState({
        draft: null,
        construct: {
          deckName: 'Draft Pool',
          pool: {
            'c-1': { id: 'c-1', expansionSetCode: 'M21', cardNumber: '1', name: 'Lightning Bolt' },
            'c-2': { id: 'c-2', expansionSetCode: 'M21', cardNumber: '2', name: 'Grizzly Bears' },
            'c-3': { id: 'c-3', expansionSetCode: 'M21', cardNumber: '3', name: 'Forest' },
            'c-4': { id: 'c-4', expansionSetCode: 'M21', cardNumber: '4', name: 'Mountain' },
            'c-5': { id: 'c-5', expansionSetCode: 'M21', cardNumber: '5', name: 'Island' },
          },
          tableId: 'table-draft-1',
          parentTableId: null,
          timeLeft: 600,
        },
        phase: 'game',
      })
    })
    const construct = page.locator('.construct-screen').first()
    await expect(construct).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('construct-submit').first()).toBeVisible()
    await expect(page.locator('.construct-screen').first()).toContainText(/Pool/)
  })

  test('el pick acusa al instante y espera a los demás (sin contador fantasma)', { tag: '@draft' }, async ({ page }) => {
    await withFakeServer(() => makeDraftScenario({ nextPickDelayMs: 2500 }), async () => {
      await login(page, `draft-${String(Date.now()).slice(-6)}`)
      await expect(page.locator('.draft-screen').first()).toBeVisible({ timeout: 10_000 })
      await expect(page.getByTestId('draft-timeout').first()).toHaveText(/\d+:\d+/)
      const first = page.getByTestId('draft-card').first()
      const firstId = await first.getAttribute('data-card-id')
      await first.click()
      // Acuse inmediato: banner con la carta elegida + espera (sin contador).
      const banner = page.getByTestId('draft-picked-banner')
      await expect(banner).toBeVisible({ timeout: 5_000 })
      await expect(banner).toContainText('Has elegido')
      await expect(banner).toContainText('Esperando a los demás jugadores')
      await expect(page.getByTestId('draft-waiting')).toContainText('Esperando')
      await expect(page.getByTestId('draft-timeout')).toHaveCount(0)
      await expect(page.getByTestId('draft-pick-card').first()).toHaveAttribute('data-card-id', firstId ?? '')
      await expect(page.getByTestId('draft-pick-new')).toBeVisible()
      for (const card of await page.getByTestId('draft-card').all()) {
        await expect(card).toBeDisabled()
      }
      await page.screenshot({ path: 'e2e/shots/draft-waiting.png' })
      // El resto de la mesa termina: llega el siguiente DRAFT_PICK y vuelve a tocarte.
      await expect(page.getByTestId('draft-timeout').first()).toBeVisible({ timeout: 8_000 })
      await expect(page.getByTestId('draft-picked-banner')).toHaveCount(0)
      await expect(page.getByTestId('draft-card').first()).toBeEnabled()
    })
  })

  test('recargar a mitad de draft re-sincroniza solo (instantánea + joinDraft)', { tag: '@draft' }, async ({ page }) => {
    // joinDraftSilent: el server real no reenvía DRAFT_INIT al re-unirse a un
    // draft ya empezado; la pantalla solo puede volver con la instantánea local.
    await withFakeServer(() => makeDraftScenario({ nextPickDelayMs: 60_000, joinDraftSilent: true }), async () => {
      await login(page, `draftrl-${String(Date.now()).slice(-6)}`)
      await expect(page.locator('.draft-screen').first()).toBeVisible({ timeout: 10_000 })
      await expect(page.getByTestId('draft-timeout').first()).toHaveText(/\d+:\d+/)
      const firstId = await page.getByTestId('draft-card').first().getAttribute('data-card-id')
      await page.reload()
      await expect(page.locator('.draft-screen').first()).toBeVisible({ timeout: 15_000 })
      await expect(page.getByTestId('draft-timeout').first()).toHaveText(/\d+:\d+/)
      const card = page.getByTestId('draft-card').first()
      await expect(card).toBeEnabled()
      await card.click()
      await expect(page.getByTestId('draft-picked-banner')).toContainText('Has elegido', { timeout: 5_000 })
      await expect(page.getByTestId('draft-pick-card').first()).toHaveAttribute('data-card-id', firstId ?? '')
      await page.screenshot({ path: 'e2e/shots/draft-reload-resync.png' })
    })
  })

  test('U9: mesa, ocultar pick con F9 y botón de log', async ({ page }) => {
    await page.goto('/')
    await dismissSetupWizard(page)
    await expect(page.locator('body')).toBeVisible({ timeout: 10_000 })
    await page.waitForTimeout(500)
    await page.evaluate(() => {
      const store = (globalThis as unknown as { __mageStore?: { setState: (s: unknown) => void } }).__mageStore
      store?.setState({
        draft: {
          draftId: 'draft-test-u9',
          message: {
            draftView: { setNames: ['Core Set 2021'], setCodes: ['M21'], boosterNum: 1, cardNum: 2, players: ['a','b','c','d','e','f','g','h'] },
            draftPickView: {
              booster: {
                'c-1': { id: 'c-1', expansionSetCode: 'M21', cardNumber: '1', name: 'Lightning Bolt' },
              },
              picks: {
                'p-1': { id: 'p-1', expansionSetCode: 'M21', cardNumber: '99', name: 'Grizzly Bears' },
              },
              picking: true,
              timeout: 60,
            },
          },
        },
        phase: 'game',
      })
    })
    const draft = page.locator('.draft-screen').first()
    await expect(draft).toBeVisible({ timeout: 10_000 })
    const table = page.getByTestId('draft-table').first()
    await expect(table).toBeVisible()
    await expect(table).toContainText('←')
    await expect(table.locator('.draft-seat')).toHaveCount(8)
    await expect(page.locator('.draft-log-btn').first()).toBeVisible()

    const pick = page.getByTestId('draft-pick-card').first()
    await expect(pick).toBeVisible()
    await page.getByTestId('draft-pick-hide').first().click()
    await expect(page.getByTestId('draft-pick-card')).toHaveCount(0)
    await expect(page.locator('.draft-hidden-link').first()).toBeVisible()
    await page.keyboard.press('F9')
    await expect(page.getByTestId('draft-pick-card')).toHaveCount(1)
  })
})
