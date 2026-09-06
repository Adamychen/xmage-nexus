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
})

function pageErrorsOf(buffers: CaptureBuffers): Error[] {
  return buffers.pageErrors
}
