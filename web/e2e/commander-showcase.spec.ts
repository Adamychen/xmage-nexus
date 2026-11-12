import { fakeOnly } from './support/fake-mode'
import { test, expect } from './fixtures'
import { quickStartGame } from './support/start-game'
import { withFakeServer } from './support/fake-backend'
import { commanderShowcaseScenario } from '../fixtures/scenarios/commanderShowcase'

fakeOnly()

test.describe('commander showcase @board', () => {
  test('TST-8: the showcase scenario opens the four-player Commander table on turn 11 @board', async ({ page }) => {
    await withFakeServer(commanderShowcaseScenario, async () => {
      const { pageErrors } = await quickStartGame(page, { prefix: 'show', skipAsks: true })
      await expect(page.locator('.hand-bar .hand-card-slot')).toHaveCount(6, { timeout: 30_000 })
      const view = await page.evaluate(() => (window as unknown as { __mageScene?: { gameView?: { turn: number; players: { name: string; controlled: boolean }[] } } }).__mageScene?.gameView)
      expect(view?.turn).toBe(11)
      expect(view?.players.filter((p) => !p.controlled).map((p) => p.name)).toEqual(['Kiko', 'Marta', 'Pablo'])
      await expect(page.locator('.card-slot').first()).toBeVisible()
      expect(await page.locator('.card-slot').count()).toBeGreaterThan(60)
      expect(pageErrors).toEqual([])
    })
  })
})
