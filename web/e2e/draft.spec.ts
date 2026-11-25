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
      await login(page, `draft-${String(Date.now()).slice(-6)}`, { landsOn: '.draft-screen' })
      await expect(page.locator('.draft-screen').first()).toBeVisible({ timeout: 10_000 })
      await expect(page.getByTestId('draft-timeout').first()).toHaveText(/\d+:\d+/)
      const firstId = await page.getByTestId('draft-card').first().getAttribute('data-card-id')
      expect(firstId).toBeTruthy()
      // click the card whose id was read: `.first()` re-resolves on click and a
      // re-rendered booster (DRAFT_INIT + DRAFT_PICK) may put another card first
      await page.locator(`[data-testid="draft-card"][data-card-id="${firstId}"]`).click()
      // Acuse inmediato: banner con la carta elegida + espera (sin contador).
      const banner = page.getByTestId('draft-picked-banner')
      await expect(banner).toBeVisible({ timeout: 5_000 })
      await expect(banner).toContainText('Has elegido')
      await expect(banner).toContainText('Esperando a los demás jugadores')
      await expect(page.getByTestId('draft-waiting')).toContainText('Esperando')
      await expect(page.getByTestId('draft-timeout')).toHaveCount(0)
      await expect(page.locator('[data-testid="draft-picks"] .arena-stack-card[data-front="true"]').first()).toHaveAttribute('data-card-key', firstId!)
      await expect(page.locator(`[data-testid="draft-picks"] .arena-stack-card[data-front="true"].is-selected[data-card-key="${firstId}"]`)).toBeVisible()
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
      await login(page, `draftrl-${String(Date.now()).slice(-6)}`, { landsOn: '.draft-screen' })
      await expect(page.locator('.draft-screen').first()).toBeVisible({ timeout: 10_000 })
      await expect(page.getByTestId('draft-timeout').first()).toHaveText(/\d+:\d+/)
      const firstId = await page.getByTestId('draft-card').first().getAttribute('data-card-id')
      expect(firstId).toBeTruthy()
      await page.reload()
      await expect(page.locator('.draft-screen').first()).toBeVisible({ timeout: 15_000 })
      await expect(page.getByTestId('draft-timeout').first()).toHaveText(/\d+:\d+/)
      const card = page.locator(`[data-testid="draft-card"][data-card-id="${firstId}"]`)
      await expect(card).toBeEnabled()
      await card.click()
      await expect(page.getByTestId('draft-picked-banner')).toContainText('Has elegido', { timeout: 5_000 })
      await expect(page.locator('[data-testid="draft-picks"] .arena-stack-card[data-front="true"]').first()).toHaveAttribute('data-card-key', firstId ?? '')
      await page.screenshot({ path: 'e2e/shots/draft-reload-resync.png' })
    })
  })

  test('U9 · TRN-21: table, a pick moves to the sideboard, F9 brings it back, log button', async ({ page }) => {
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
    await expect(page.locator('[data-testid="draft-log-btn"]').first()).toBeVisible()

    const deckPicks = page.locator('[data-testid="draft-picks"] .arena-stack-card[data-front="true"]')
    const sidePicks = page.locator('[data-testid="draft-sideboard"] .arena-stack-card[data-front="true"]')
    await expect(deckPicks).toHaveCount(1)
    await deckPicks.first().click({ modifiers: ['Shift'] })
    await expect(deckPicks).toHaveCount(0)
    await expect(sidePicks).toHaveCount(1)
    await page.keyboard.press('F9')
    await expect(deckPicks).toHaveCount(1)
    await expect(sidePicks).toHaveCount(0)
  })

  test('TRN-21: 45 picks scroll in the band and no pile is clipped', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 })
    await page.goto('/')
    await dismissSetupWizard(page)
    await page.evaluate(() => {
      const picks = Object.fromEntries(Array.from({ length: 45 }, (_, i) => [`p-${i}`, { id: `p-${i}`, expansionSetCode: 'M21', cardNumber: String(1 + i * 6), name: '' }]))
      const store = (globalThis as unknown as { __mageStore?: { setState: (s: unknown) => void } }).__mageStore
      store?.setState({
        draft: {
          draftId: 'draft-test-45',
          message: {
            draftView: { setNames: ['Core Set 2021'], setCodes: ['M21', 'M21', 'M21'], boosterNum: 3, cardNum: 1, players: ['a', 'b'] },
            draftPickView: { booster: {}, picks, picking: false, timeout: 60 },
          },
        },
        phase: 'game',
      })
    })
    const area = page.locator('.draft-picks-area')
    await expect(area).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('[data-testid="draft-picks"] .arena-stack-card[data-front="true"]')).toHaveCount(45)
    const columns = page.locator('[data-testid="draft-picks"] .arena-stack-col')
    const last = columns.last().locator('.arena-stack-card[data-front="true"]').last()
    await last.scrollIntoViewIfNeeded()
    await expect(last).toBeVisible()
    const box = await last.boundingBox()
    const areaBox = await area.boundingBox()
    expect(box && areaBox).toBeTruthy()
    expect(box!.y).toBeGreaterThanOrEqual(areaBox!.y - 1)
    expect(box!.y + box!.height).toBeLessThanOrEqual(areaBox!.y + areaBox!.height + 1)
  })

  test('TRN-21: at pick 1 on a laptop the booster keeps most of the dialog', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 })
    await page.goto('/')
    await dismissSetupWizard(page)
    await page.evaluate(() => {
      const booster = Object.fromEntries(Array.from({ length: 15 }, (_, i) => [`b-${i}`, { id: `b-${i}`, expansionSetCode: 'M21', cardNumber: String(10 + i * 13), name: `Card ${i}` }]))
      const store = (globalThis as unknown as { __mageStore?: { setState: (s: unknown) => void } }).__mageStore
      store?.setState({
        draft: {
          draftId: 'draft-test-p1',
          message: {
            draftView: { setNames: ['Core Set 2021'], setCodes: ['M21', 'M21', 'M21'], boosterNum: 1, cardNum: 1, players: ['a', 'b'] },
            draftPickView: { booster, picks: {}, picking: true, timeout: 60 },
          },
        },
        phase: 'game',
      })
    })
    await expect(page.getByTestId('draft-booster')).toBeVisible({ timeout: 10_000 })
    const booster = await page.locator('.draft-booster-area').boundingBox()
    const picks = await page.locator('.draft-picks-area').boundingBox()
    expect(booster && picks).toBeTruthy()
    expect(booster!.height).toBeGreaterThan(picks!.height * 2)
  })
})
