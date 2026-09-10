import { test, expect } from '@playwright/test'
import { fakeOnly } from './support/fake-mode'
import { withFakeServer } from './support/fake-backend'
import { installCapture, login, type CaptureBuffers } from './support/start-game'
import { makeBaseScenario } from '../fixtures/fake'
import { playerGameView } from '../src/__fixtures__/gameViews'

fakeOnly()

function wizardScenario() {
  return makeBaseScenario({
    tableId: 'table-wiz-1',
    tableName: 'wizard-e2e',
    gameId: 'game-wiz-1',
    gameView: playerGameView,
  })
}

async function openWizard(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: /Nueva/i }).first().click()
  await expect(page.getByRole('heading', { name: /Nueva mesa|Crear Mesa/i })).toBeVisible()
}

test.describe('Wizard crear mesa (U3)', () => {
  test('U2: Siguiente bloquea con nombre vacío y avisa', async ({ page }) => {
    await withFakeServer(wizardScenario, async () => {
      const buffers: CaptureBuffers = { frames: [], sent: [], pageErrors: [] }
      installCapture(page, buffers)
      await login(page, 'wiz')
      await openWizard(page)
      await page.getByPlaceholder(/Ej\. Modern Casual Bo3/).fill('')
      await page.getByRole('button', { name: /Siguiente/ }).click()
      await expect(page.getByText(/necesita un nombre|needs a name/i)).toBeVisible()
      expect(pageErrorsOf(buffers)).toEqual([])
    })
  })

  test('F7+F2: vetados + skill por plaza llegan al submit y la mesa se crea', async ({ page }) => {
    await withFakeServer(wizardScenario, async () => {
      const buffers: CaptureBuffers = { frames: [], sent: [], pageErrors: [] }
      installCapture(page, buffers)
      await login(page, 'wiz')
      await openWizard(page)
      await page.getByPlaceholder(/Ej\. Modern Casual Bo3/).fill('wizard-e2e')
      await page.getByRole('button', { name: /Siguiente/ }).click()
      await page.getByRole('button', { name: /Siguiente/ }).click()
      await page.getByPlaceholder(/separados por comas|comma-separated/i).fill('griefer')
      await page.getByRole('button', { name: /Siguiente/ }).click()
      await page.getByTestId('seat-skill-0').selectOption('7')
      await page.getByRole('button', { name: /Siguiente/ }).click()
      await page.getByRole('button', { name: /Crear Mesa/ }).click()
      await expect(page.getByTestId('staging-player-actions')).toBeVisible({ timeout: 15_000 })
      const createFrame = buffers.sent.find(
        (f) => f && (f as { action?: string }).action === 'createTable',
      ) as unknown as { args?: { bannedUsers?: string[]; seatSkills?: number[] } } | undefined
      expect(createFrame?.args?.bannedUsers).toEqual(['griefer'])
      expect(createFrame?.args?.seatSkills).toContain(7)
      expect(pageErrorsOf(buffers)).toEqual([])
    })
  })

  test('HUMAN: plaza en espera llega al submit sin simDecks', async ({ page }) => {    await withFakeServer(wizardScenario, async () => {
      const buffers: CaptureBuffers = { frames: [], sent: [], pageErrors: [] }
      installCapture(page, buffers)
      await login(page, 'wiz')
      await openWizard(page)
      await page.getByPlaceholder(/Ej\. Modern Casual Bo3/).fill('humans-only')
      await page.getByRole('button', { name: /Siguiente/ }).click()
      await page.getByRole('button', { name: /Siguiente/ }).click()
      await page.getByRole('button', { name: /Siguiente/ }).click()
      await page.getByTestId('seat-type-0').selectOption('HUMAN')
      await page.getByRole('button', { name: /Siguiente/ }).click()
      await page.getByRole('button', { name: /Crear Mesa/ }).click()
      await expect(page.getByTestId('staging-player-actions')).toBeVisible({ timeout: 15_000 })
      const createFrame = buffers.sent.find(
        (f) => f && (f as { action?: string }).action === 'createTable',
      ) as unknown as { args?: { playerTypes?: string[]; simDecks?: unknown } } | undefined
      expect(createFrame?.args?.playerTypes).toEqual(['HUMAN', 'HUMAN'])
      expect(createFrame?.args?.simDecks).toBeUndefined()
      expect(pageErrorsOf(buffers)).toEqual([])
    })
  })

  test('DUEL: bot MAD se une con mazo construido', async ({ page }) => {
    await withFakeServer(wizardScenario, async () => {
      const buffers: CaptureBuffers = { frames: [], sent: [], pageErrors: [] }
      installCapture(page, buffers)
      await login(page, 'wiz')
      await openWizard(page)
      await page.getByPlaceholder(/Ej\. Modern Casual Bo3/).fill('mad-duel')
      await page.getByRole('button', { name: /Siguiente/ }).click()
      await page.getByRole('button', { name: /Siguiente/ }).click()
      await page.getByRole('button', { name: /Siguiente/ }).click()
      await page.getByTestId('seat-type-0').selectOption('COMPUTER_MAD')
      await page.getByRole('button', { name: /Siguiente/ }).click()
      await page.getByRole('button', { name: /Crear Mesa/ }).click()
      await expect(page.getByTestId('staging-player-actions')).toBeVisible({ timeout: 15_000 })
      const sent = buffers.sent as Array<{ action?: string; args?: Record<string, unknown> }>
      const createFrame = sent.find((f) => f?.action === 'createTable')
      expect(createFrame?.args?.playerTypes).toEqual(['HUMAN', 'COMPUTER_MAD'])
      const botJoin = sent.find(
        (f) => f?.action === 'joinTable' && (f.args as { playerType?: string })?.playerType === 'COMPUTER_MAD',
      )
      expect(botJoin?.args).toMatchObject({ deckType: 'Constructed - Modern' })
      expect(botJoin?.args?.deck).toBeDefined()
      expect(pageErrorsOf(buffers)).toEqual([])
    })
  })

  test('DRAFT: preset MH3 con draftbots se bloquea (no llegan a rondas)', async ({ page }) => {
    await withFakeServer(wizardScenario, async () => {
      const buffers: CaptureBuffers = { frames: [], sent: [], pageErrors: [] }
      installCapture(page, buffers)
      await login(page, 'wiz')
      await openWizard(page)
      await page.getByPlaceholder(/Ej\. Modern Casual Bo3/).fill('draft-e2e')
      await page.getByRole('button', { name: /Draft MH3/ }).click()
      for (let i = 0; i < 3; i++) {
        await page.getByRole('button', { name: /Siguiente/ }).click()
      }
      await page.getByRole('button', { name: /IA Draftbot/ }).click()
      for (let i = 0; i < 8; i++) {
        const submit = page.getByRole('button', { name: /Crear torneo|Create Draft/i })
        if ((await submit.count()) > 0 && (await submit.first().isVisible())) break
        await page.getByRole('button', { name: /Siguiente/ }).click()
      }
      await page.getByRole('button', { name: /Crear torneo|Create Draft/i }).click()
      await expect(page.getByText(/no llegan a rondas/)).toBeVisible({ timeout: 15_000 })
      await expect(page.getByRole('heading', { name: /Nueva mesa|Crear Mesa/i })).toBeVisible()
      const sent = buffers.sent as Array<{ action?: string; args?: Record<string, unknown> }>
      expect(sent.find((f) => f?.action === 'createTournamentTable')).toBeUndefined()
      expect(pageErrorsOf(buffers)).toEqual([])
    })
  })

  test('TORNEO: preset Swiss crea construido y une bots con mazo', async ({ page }) => {    await withFakeServer(wizardScenario, async () => {
      const buffers: CaptureBuffers = { frames: [], sent: [], pageErrors: [] }
      installCapture(page, buffers)
      await login(page, 'wiz')
      await openWizard(page)
      await page.getByPlaceholder(/Ej\. Modern Casual Bo3/).fill('swiss-e2e')
      await page.getByRole('button', { name: /Modern Swiss/ }).click()
      for (let i = 0; i < 3; i++) {
        await page.getByRole('button', { name: /Siguiente/ }).click()
      }
      await page.getByRole('button', { name: /IA Mad/ }).click()
      for (let i = 0; i < 8; i++) {
        const submit = page.getByRole('button', { name: /Crear torneo|Create Draft/i })
        if ((await submit.count()) > 0 && (await submit.first().isVisible())) break
        await page.getByRole('button', { name: /Siguiente/ }).click()
      }
      await page.getByRole('button', { name: /Crear torneo|Create Draft/i }).click()
      await expect(page.getByRole('heading', { name: /Nueva mesa|Crear Mesa/i })).toBeHidden({ timeout: 15_000 })
      const sent = buffers.sent as Array<{ action?: string; args?: Record<string, unknown> }>
      const createFrame = sent.find((f) => f?.action === 'createTournamentTable')
      expect(createFrame?.args?.tournamentType).toBe('Constructed Swiss')
      expect(createFrame?.args?.deckType).toBe('Constructed - Modern')
      expect(createFrame?.args?.limited).toBe(false)
      const joins = sent.filter((f) => f?.action === 'joinTournamentTable')
      expect(joins.length).toBeGreaterThan(1)
      for (const j of joins) {
        expect(j.args?.deck).toBeDefined()
        expect(j.args?.deckType).toBe('Constructed - Modern')
      }
      expect(pageErrorsOf(buffers)).toEqual([])
    })
  })

  test('MATCH-LIMITED: duelo Limited sin draft no ofrece sobres y avisa', async ({ page }) => {
    await withFakeServer(wizardScenario, async () => {
      const buffers: CaptureBuffers = { frames: [], sent: [], pageErrors: [] }
      installCapture(page, buffers)
      await login(page, 'wiz')
      await openWizard(page)
      await page.getByPlaceholder(/Ej\. Modern Casual Bo3/).fill('limited-match')
      await page.getByLabel(/Formato \(Tipo de Mazo\)|Format \(Deck Type\)/i).selectOption('Limited')
      await expect(page.getByText(/no genera sobres/)).toBeVisible()
      await expect(page.getByPlaceholder(/Ej\. M21, MH3, BLB/)).toBeHidden()
      for (let i = 0; i < 8; i++) {
        const submit = page.getByRole('button', { name: /Crear Mesa/i })
        if ((await submit.count()) > 0 && (await submit.first().isVisible())) break
        await page.getByRole('button', { name: /Siguiente/ }).click()
      }
      await page.getByRole('button', { name: /Crear Mesa/i }).click()
      await expect(page.getByTestId('staging-player-actions')).toBeVisible({ timeout: 15_000 })
      const sent = buffers.sent as Array<{ action?: string; args?: Record<string, unknown> }>
      const createFrame = sent.find((f) => f?.action === 'createTable')
      expect(createFrame?.args?.deckType).toBe('Limited')
      expect(createFrame?.args?.limited).toBe(true)
      expect(sent.some((f) => f?.action === 'createTournamentTable')).toBe(false)
      expect(pageErrorsOf(buffers)).toEqual([])
    })
  })
})

function pageErrorsOf(buffers: CaptureBuffers): Error[] {
  return buffers.pageErrors
}
