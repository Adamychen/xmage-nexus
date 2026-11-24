import { test, expect } from './fixtures'
import { fakeOnly } from './support/fake-mode'
import { dismissSetupWizard } from './support/start-game'
import { richCommanderGame, showGame } from './support/rich-game'

fakeOnly()

function duel() {
  const game = richCommanderGame() as { players: Array<Record<string, unknown>> }
  game.players = [game.players.find((p) => p.controlled)!, game.players.find((p) => !p.controlled)!]
  return game
}

for (const viewport of [{ width: 1920, height: 1080 }, { width: 1366, height: 768 }]) {
  test.describe(`duel ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport })

    test('BRD-6: a duel with the switch off is the Arena board, its opponent across the whole row @board', async ({ page }, testInfo) => {
      const pageErrors: Error[] = []
      page.on('pageerror', (err) => pageErrors.push(err))
      await page.goto('/')
      await dismissSetupWizard(page)
      await showGame(page, duel(), { boardSpotlight: false })
      await expect(page.getByTestId('arena-board')).toBeVisible({ timeout: 10_000 })
      await expect(page.getByTestId('spotlight-board')).toHaveCount(0)
      await expect(page.locator('[data-testid^="arena-opp-cell-"]')).toHaveCount(1)
      await expect(page.getByTestId('game-strip')).toBeVisible()
      await expect(page.locator('.action-button-container')).toBeVisible()
      await expect(page.getByTestId('hand-bar')).toBeVisible()
      await page.waitForTimeout(600)
      const clipped = await page.evaluate(() => {
        const vw = window.innerWidth
        return [...document.querySelectorAll('.arena-board .bz-band .card-slot')]
          .map((el) => el.getBoundingClientRect())
          .filter((r) => r.width > 0 && (r.left < -1 || r.right > vw + 1)).length
      })
      expect(clipped, 'no battlefield card sticks out of the window').toBe(0)
      expect(pageErrors).toEqual([])
      await page.screenshot({ path: testInfo.outputPath(`arena-duel-${viewport.width}.png`) })
    })
  })
}
