import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { TABLE } from '../fixtures/table-names'
import { test, expect } from './fixtures'
import { fakeOnly } from './support/fake-mode'
import { withFakeServer } from './support/fake-backend'
import { startGame } from './support/start-game'
import { mechanicsScenario } from '../fixtures/scenarios/mechanics'
import { DECK } from '../fixtures/deck-names'
fakeOnly()

test.describe('Feed unificado con diseño carta', () => {
  test('las líneas genéricas del log se ven como cartas con tint por tipo @mechanics @feed', async ({ page }) => {
    await withFakeServer(mechanicsScenario, async () => {
      const { pageErrors } = await startGame(page, {
        prefix: 'feed',
        tableName: TABLE.mechanics,
        deck: DECK.advanced,
      })

      const feed = page.locator('.action-feed-list')
      const chatTab = page.locator('.right-tab-btn', { hasText: /Chat/ })
      const logTab = page.locator('.right-tab-btn', { hasText: /Log|Registro/ })
      await expect(chatTab).toBeVisible({ timeout: 30_000 })

      const lines = [
        'feedp1 draws seven cards',
        'feedp1 keeps hand',
        'feedp1 skips Draw step',
        'Waiting for feedp1',
        'simx chooses that feedp1 take the first turn',
      ]
      for (const line of lines) {
        await chatTab.click()
        const chatInput = page.locator('.game-chat-input input')
        await expect(chatInput).toBeVisible({ timeout: 10_000 })
        await chatInput.fill(line)
        await chatInput.press('Enter')
        await logTab.click()
      }

      await expect(feed).toBeVisible({ timeout: 15_000 })

      await expect(feed).toContainText('feedp1 roba 7 cartas', { timeout: 15_000 })
      await expect(feed).toContainText('feedp1 se queda la mano')
      await expect(feed).toContainText('feedp1 salta Robo')
      await expect(feed).toContainText('Esperando a feedp1')
      await expect(feed).toContainText('simx elige que feedp1 juegue primero')

      await expect(
        page.locator('.action-feed-system-banner'),
        'ni un solo banner del diseño antiguo'
      ).toHaveCount(0)

      const drawCard = feed.locator('.action-feed-card.type-draw', { hasText: 'roba 7 cartas' })
      await expect(drawCard).toHaveCount(1)
      await expect(drawCard.locator('.action-card-bg--tint.tint-draw')).toHaveCount(1)
      await expect(drawCard.locator('.action-player-tag', { hasText: 'feedp1' })).toHaveCount(1)

      const waitCard = feed.locator('.action-feed-card.type-phase', { hasText: 'Esperando a feedp1' })
      await expect(waitCard).toHaveCount(1)
      await expect(waitCard.locator('.action-card-bg--tint.tint-phase')).toHaveCount(1)

      const shotsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'shots', 'feed-unified')
      fs.mkdirSync(shotsDir, { recursive: true })
      await feed.screenshot({ path: path.join(shotsDir, 'feed-unified.png') })

      expect(pageErrors).toEqual([])
    })
  })
})
