/**
 * P2 — comprobador de fidelidad de render: con el flag activo, un frame real
 * se pinta sin discrepancias servidor-vs-DOM. Cubre v1 (permanentes, pila,
 * turno, fase) y v2 (P/T, contadores, girado, vida, lado y prompts).
 */
import { test, expect } from '@playwright/test'
import { fakeOnly } from './support/fake-mode'
import { withFakeServer } from './support/fake-backend'
import { startGame } from './support/start-game'
import { DECK } from '../fixtures/deck-names'
import { replayRecordedScenario, REPLAY_TABLE_NAME } from '../fixtures/scenarios/replay-recorded'

fakeOnly()

const FRAMES = [
  'mutate.json',
  'combat.json',
  'xcosts.json',
  'aura.json',
  'trigger-order.json',
]

test.describe('fidelidad de render (P2)', () => {
  for (const frame of FRAMES) {
    test(`frame real ${frame}: el checker corre y no reporta discrepancias`, async ({ page }) => {
      await withFakeServer(() => replayRecordedScenario(frame), async () => {
        await page.addInitScript(() => {
          localStorage.setItem('mage-web-fidelity', '1')
        })
        const { pageErrors } = await startGame(page, {
          prefix: 'fi',
          tableName: REPLAY_TABLE_NAME,
          deck: DECK.advanced,
        })
        expect(pageErrors).toEqual([])
        await expect(page.getByTestId('game-status')).toBeVisible({ timeout: 15_000 })
        await page.waitForTimeout(2500)
        const runs = await page.evaluate(() => window.__mageFidelityRuns ?? 0)
        expect(runs, 'el checker debe haber corrido').toBeGreaterThan(0)
        await page.getByRole('button', { name: 'Log' }).click()
        await expect(page.getByText('fidelidad')).toHaveCount(0)
      })
    })
  }
})
