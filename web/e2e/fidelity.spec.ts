/**
 * P2 — comprobador de fidelidad de render: con el flag activo, un frame real
 * se pinta sin discrepancias servidor-vs-DOM. Cubre v1 (permanentes, pila,
 * turno, fase), v2 (P/T, contadores, girado, vida, lado y prompts) y v3
 * (adjuntos y tamaños de mano/biblioteca/cementerio/exilio).
 */
import { test, expect, type Page } from '@playwright/test'
import { fakeOnly } from './support/fake-mode'
import { withFakeServer } from './support/fake-backend'
import { startGame } from './support/start-game'
import { openDrawerTab } from './support/game-screen'
import { DECK } from '../fixtures/deck-names'
import { replayRecordedScenario, REPLAY_TABLE_NAME } from '../fixtures/scenarios/replay-recorded'

fakeOnly()

const FRAME_ASSERTS: Record<string, (page: Page) => Promise<void>> = {
  'aura.json': async (page) => {
    await expect(page.locator('.card-attachment-group').first()).toBeVisible()
    await expect(page.locator('.card-attachment-group .attachment-subcard').first()).toBeVisible()
    await expect(page.locator('[data-attachment-host]').first()).toBeVisible()
  },
  'flashback.json': async (page) => {
    expect(await page.locator('.player-zone [data-graveyard-count]').first().getAttribute('data-graveyard-count')).not.toBe('0')
    await expect(page.getByTestId('hand-bar')).toHaveAttribute('data-hand-count', '6')
  },
  'escape.json': async (page) => {
    expect(await page.locator('.player-zone [data-exile-count]').first().getAttribute('data-exile-count')).not.toBe('0')
  },
}

const FRAMES = [
  'mutate.json',
  'combat.json',
  'xcosts.json',
  'aura.json',
  'trigger-order.json',
  'flashback.json',
  'escape.json',
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
        await FRAME_ASSERTS[frame]?.(page)
        await page.waitForTimeout(2500)
        const runs = await page.evaluate(() => window.__mageFidelityRuns ?? 0)
        expect(runs, 'el checker debe haber corrido').toBeGreaterThan(0)
        await openDrawerTab(page, 'log')
        await expect(page.getByText('fidelidad')).toHaveCount(0)
      })
    })
  }
})
